import { randomBytes, randomUUID } from 'node:crypto';
import {
  allZoneStatuses,
  buildDemoHistory,
  campusById,
  makeCheckIn,
  zoneCountsFrom,
  type ZoneCounts,
} from '../../shared/game';
import type { CampusId, CheckIn } from '../../shared/types';
import type { Db } from './db';
import { broadcast } from './events';

export interface Player {
  id: string;
  name: string;
  campusId: CampusId;
}

interface PlayerRow { id: string; name: string; campus_id: string }
interface CheckInRow {
  id: string;
  place_id: string;
  zone_id: string | null;
  points: number;
  bonus: number;
  away: boolean;
  completed_neighborhood: string | null;
  captured: string | null;
  at: Date | string;
}

const toPlayer = (r: PlayerRow): Player => ({ id: r.id, name: r.name, campusId: r.campus_id as CampusId });

const toCheckIn = (r: CheckInRow): CheckIn => ({
  id: r.id,
  placeId: r.place_id,
  zoneId: (r.zone_id as CampusId | null) ?? null,
  points: r.points,
  bonus: r.bonus,
  away: r.away,
  completedNeighborhood: r.completed_neighborhood ?? undefined,
  captured: r.captured ? (r.captured.split(',') as CampusId[]) : undefined,
  at: new Date(r.at).getTime(),
});

export class GameService {
  constructor(private db: Db) {}

  async playerByToken(token: string): Promise<Player | null> {
    const { rows } = await this.db.query<PlayerRow>('select id, name, campus_id from players where token = $1 and not is_bot', [token]);
    return rows[0] ? toPlayer(rows[0]) : null;
  }

  async createPlayer(name: string, campusId: CampusId, withDemoHistory: boolean) {
    const id = randomUUID();
    const token = randomBytes(24).toString('base64url');
    await this.db.query('insert into players (id, token, name, campus_id) values ($1, $2, $3, $4)', [id, token, name || 'Explorer', campusId]);
    if (withDemoHistory) for (const c of buildDemoHistory(campusId)) await this.insertCheckIn(id, campusId, c);
    return { player: { id, name: name || 'Explorer', campusId } as Player, token };
  }

  async checkIns(playerId: string): Promise<CheckIn[]> {
    const { rows } = await this.db.query<CheckInRow>(
      `select id, place_id, zone_id, points, bonus, away, completed_neighborhood, captured, at
         from checkins where player_id = $1 order by at`,
      [playerId],
    );
    return rows.map(toCheckIn);
  }

  /** This week's stamps per campus per zone, on top of the seed baseline. */
  async zoneCounts(): Promise<ZoneCounts> {
    const { rows } = await this.db.query<{ zone_id: string; campus_id: string; n: string | number }>(
      `select zone_id, campus_id, count(*) as n from checkins
        where zone_id is not null and at >= date_trunc('week', now())
        group by zone_id, campus_id`,
    );
    return zoneCountsFrom(rows.map((r) => ({ zoneId: r.zone_id as CampusId, campusId: r.campus_id as CampusId, count: Number(r.n) })));
  }

  async checkIn(player: Player, placeId: string) {
    const prev = await this.checkIns(player.id);
    if (prev.some((c) => c.placeId === placeId)) return { ok: false as const, error: "You've already stamped this spot." };

    const before = allZoneStatuses(await this.zoneCounts());
    const checkIn = makeCheckIn(prev, placeId, Date.now(), player.campusId);
    await this.insertCheckIn(player.id, player.campusId, checkIn);
    const after = allZoneStatuses(await this.zoneCounts());

    const changed = (Object.keys(after) as CampusId[]).filter((z) => before[z].owner !== after[z].owner);
    const captured = changed.filter((z) => after[z].owner === player.campusId);
    if (captured.length) {
      checkIn.captured = captured;
      await this.db.query('update checkins set captured = $1 where id = $2', [captured.join(','), checkIn.id]);
    }
    for (const z of changed) {
      broadcast({ type: 'capture', zoneId: z, owner: after[z].owner, previousOwner: before[z].owner, byPlayerId: player.id, at: Date.now() });
    }
    return { ok: true as const, checkIn };
  }

  /** Demo control: adds stamps for a campus's "crew" bot in a zone. */
  async simulate(zoneId: CampusId, campusId: CampusId, amount: number) {
    const botId = `bot-${campusId}`;
    await this.db.query(
      `insert into players (id, token, name, campus_id, is_bot) values ($1, $2, $3, $4, true) on conflict (id) do nothing`,
      [botId, `bot-token-${randomUUID()}`, `${campusById[campusId].team} crew`, campusId],
    );
    const before = allZoneStatuses(await this.zoneCounts());
    for (let i = 0; i < amount; i++) {
      await this.db.query(
        `insert into checkins (id, player_id, campus_id, place_id, zone_id, points, away) values ($1, $2, $3, 'simulated', $4, 0, $5)`,
        [`sim-${randomUUID()}`, botId, campusId, zoneId, zoneId !== campusId],
      );
    }
    const after = allZoneStatuses(await this.zoneCounts());
    for (const z of Object.keys(after) as CampusId[]) {
      if (before[z].owner !== after[z].owner) {
        broadcast({ type: 'capture', zoneId: z, owner: after[z].owner, previousOwner: before[z].owner, at: Date.now() });
      }
    }
  }

  /** Removes simulated stamps and this week's zone check-ins (players keep their passport stamps elsewhere). */
  async resetTurf() {
    await this.db.query(`delete from checkins where zone_id is not null and at >= date_trunc('week', now())`);
    await this.db.query(`delete from players where is_bot`);
  }

  private async insertCheckIn(playerId: string, campusId: CampusId, c: CheckIn) {
    // Make ids unique across players (two players can stamp the same place).
    c.id = `${c.id}-${playerId.slice(0, 8)}`;
    await this.db.query(
      `insert into checkins (id, player_id, campus_id, place_id, zone_id, points, bonus, away, completed_neighborhood, captured, at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [c.id, playerId, campusId, c.placeId, c.zoneId, c.points, c.bonus, c.away, c.completedNeighborhood ?? null, c.captured?.join(',') ?? null, new Date(c.at)],
    );
  }
}
