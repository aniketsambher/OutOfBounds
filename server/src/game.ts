import { randomBytes, randomUUID } from 'node:crypto';
import {
  allZoneStatuses,
  buildDemoHistory,
  campusById,
  makeCheckIn,
  placeById,
  replayHistory,
  zoneCountsFrom,
  type ZoneCounts,
} from '../../shared/game';
import type { CampusId, CheckIn } from '../../shared/types';
import type { Db } from './db';
import { env } from './env';
import { broadcast } from './events';

export interface Player {
  id: string;
  name: string;
  campusId: CampusId;
  /** Team accounts can check in anywhere on the shared map and use the demo controls. */
  isTeam: boolean;
}

/** A check-in sent from a device (made offline), to be added to the player's server history. */
export interface CheckInImport {
  placeId: string;
  at: number;
}

interface PlayerRow { id: string; name: string; campus_id: string; is_team: boolean }
interface CheckInRow {
  id: string;
  place_id: string;
  zone_id: string | null;
  points: number;
  bonus: number;
  away: boolean;
  completed_neighborhood: string | null;
  captured: string | null;
  verified: boolean;
  at: Date | string;
}

/** Start of the game week in Boston time (Monday 00:00), so turf resets at Sunday midnight local time. */
const WEEK_START = `(date_trunc('week', now() at time zone 'America/New_York') at time zone 'America/New_York')`;
/** Turf counts check-ins since the week started or the last turf reset, whichever is later. */
const TURF_SINCE = `greatest(${WEEK_START}, (select coalesce(max(at), '-infinity'::timestamptz) from turf_resets))`;

const toPlayer = (r: PlayerRow): Player => ({
  id: r.id,
  name: r.name,
  campusId: r.campus_id as CampusId,
  isTeam: r.is_team || env.allowDemo,
});

const toCheckIn = (r: CheckInRow): CheckIn => ({
  id: r.id,
  placeId: r.place_id,
  zoneId: (r.zone_id as CampusId | null) ?? null,
  points: r.points,
  bonus: r.bonus,
  away: r.away,
  completedNeighborhood: r.completed_neighborhood ?? undefined,
  captured: r.captured ? (r.captured.split(',') as CampusId[]) : undefined,
  verified: r.verified,
  at: new Date(r.at).getTime(),
});

export class GameService {
  /** Changes run one at a time, so two requests can't both stamp the same place or both claim the same capture. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private db: Db) {}

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async playerByToken(token: string): Promise<Player | null> {
    const { rows } = await this.db.query<PlayerRow>(
      'select id, name, campus_id, is_team from players where token = $1 and not is_bot',
      [token],
    );
    return rows[0] ? toPlayer(rows[0]) : null;
  }

  /** New player. Their history is either the demo stamps or check-ins they made offline (never both). */
  async createPlayer(name: string, campusId: CampusId, withDemoHistory: boolean, imported: CheckInImport[] = []) {
    const id = randomUUID();
    const token = randomBytes(24).toString('base64url');
    await this.db.query('insert into players (id, token, name, campus_id) values ($1, $2, $3, $4)', [id, token, name || 'Explorer', campusId]);
    const history = withDemoHistory ? buildDemoHistory(campusId) : replayHistory(imported, campusId);
    // Demo and offline check-ins weren't location-checked by the server, so they stay off the shared map.
    for (const c of history) await this.insertCheckIn(id, campusId, { ...c, verified: false });
    const player: Player = { id, name: name || 'Explorer', campusId, isTeam: env.allowDemo };
    return { player, token };
  }

  async setTeam(playerId: string) {
    await this.db.query('update players set is_team = true where id = $1', [playerId]);
  }

  async checkIns(playerId: string): Promise<CheckIn[]> {
    const { rows } = await this.db.query<CheckInRow>(
      `select id, place_id, zone_id, points, bonus, away, completed_neighborhood, captured, verified, at
         from checkins where player_id = $1 order by at`,
      [playerId],
    );
    // Skip places that were removed from the seed data, so old check-ins can't break the app.
    return rows.map(toCheckIn).filter((c) => placeById[c.placeId]);
  }

  async hasCheckIn(playerId: string, placeId: string): Promise<boolean> {
    const { rows } = await this.db.query('select 1 from checkins where player_id = $1 and place_id = $2 limit 1', [playerId, placeId]);
    return rows.length > 0;
  }

  /** This week's verified stamps per campus per zone (since the last turf reset), on top of the seed baseline. */
  async zoneCounts(): Promise<ZoneCounts> {
    const { rows } = await this.db.query<{ zone_id: string; campus_id: string; n: string | number }>(
      `select zone_id, campus_id, count(*) as n from checkins
        where zone_id is not null and verified and at >= ${TURF_SINCE}
        group by zone_id, campus_id`,
    );
    return zoneCountsFrom(rows.map((r) => ({ zoneId: r.zone_id as CampusId, campusId: r.campus_id as CampusId, count: Number(r.n) })));
  }

  /** Records a check-in. Only verified ones (GPS, or a team account) count on the shared turf map. */
  checkIn(player: Player, placeId: string, verified: boolean) {
    return this.serial(async () => {
      const prev = await this.checkIns(player.id);
      if (prev.some((c) => c.placeId === placeId)) return { ok: false as const, error: "You've already stamped this spot." };

      const checkIn = makeCheckIn(prev, placeId, Date.now(), player.campusId);
      checkIn.verified = verified;
      if (!verified || !checkIn.zoneId) {
        await this.insertCheckIn(player.id, player.campusId, checkIn);
        return { ok: true as const, checkIn };
      }

      const before = allZoneStatuses(await this.zoneCounts());
      await this.insertCheckIn(player.id, player.campusId, checkIn);
      const after = allZoneStatuses(await this.zoneCounts());
      const changed = (Object.keys(after) as CampusId[]).filter((z) => before[z].owner !== after[z].owner);
      const captured = changed.filter((z) => after[z].owner === player.campusId);
      if (captured.length) {
        checkIn.captured = captured;
        await this.db.query('update checkins set captured = $1 where id = $2 and player_id = $3', [captured.join(','), checkIn.id, player.id]);
      }
      for (const z of changed) {
        broadcast({ type: 'capture', zoneId: z, owner: after[z].owner, previousOwner: before[z].owner, byPlayerId: player.id, at: Date.now() });
      }
      return { ok: true as const, checkIn };
    });
  }

  /** Adds check-ins a player made offline. They count for their passport, not for the shared turf map. */
  importCheckIns(player: Player, items: CheckInImport[]) {
    return this.serial(async () => {
      const prev = await this.checkIns(player.id);
      for (const c of replayHistory(items, player.campusId, prev)) {
        await this.insertCheckIn(player.id, player.campusId, { ...c, verified: false });
      }
    });
  }

  /** Clears a player's check-ins (optionally back to the demo stamps). Same account, so nothing is counted twice. */
  resetPlayer(player: Player, withDemoHistory: boolean) {
    return this.serial(async () => {
      await this.db.query('delete from checkins where player_id = $1', [player.id]);
      if (withDemoHistory) {
        for (const c of buildDemoHistory(player.campusId)) await this.insertCheckIn(player.id, player.campusId, { ...c, verified: false });
      }
      broadcast({ type: 'refresh', at: Date.now() });
    });
  }

  /** Deletes a player and their check-ins ("Sign out and start over"). */
  deletePlayer(player: Player) {
    return this.serial(async () => {
      await this.db.query('delete from players where id = $1 and not is_bot', [player.id]);
      broadcast({ type: 'refresh', at: Date.now() });
    });
  }

  /** Demo control: adds stamps for a campus's "crew" bot in a zone. */
  simulate(zoneId: CampusId, campusId: CampusId, amount: number) {
    return this.serial(async () => {
      const botId = `bot-${campusId}`;
      await this.db.query(
        `insert into players (id, token, name, campus_id, is_bot) values ($1, $2, $3, $4, true) on conflict (id) do nothing`,
        [botId, `bot-token-${randomUUID()}`, `${campusById[campusId].team} crew`, campusId],
      );
      const before = allZoneStatuses(await this.zoneCounts());
      for (let i = 0; i < amount; i++) {
        await this.db.query(
          `insert into checkins (id, player_id, campus_id, place_id, zone_id, points, away, verified)
           values ($1, $2, $3, 'simulated', $4, 0, $5, true)`,
          [`sim-${randomUUID()}`, botId, campusId, zoneId, zoneId !== campusId],
        );
      }
      const after = allZoneStatuses(await this.zoneCounts());
      for (const z of Object.keys(after) as CampusId[]) {
        if (before[z].owner !== after[z].owner) {
          broadcast({ type: 'capture', zoneId: z, owner: after[z].owner, previousOwner: before[z].owner, at: Date.now() });
        }
      }
    });
  }

  /**
   * Demo control: turf goes back to the seed baseline. Players keep every check-in (passport stamps, points);
   * the turf map just stops counting anything from before this moment.
   */
  resetTurf() {
    return this.serial(async () => {
      await this.db.query('delete from players where is_bot'); // their check-ins go with them
      await this.db.query('delete from turf_resets');
      await this.db.query('insert into turf_resets default values');
      broadcast({ type: 'refresh', at: Date.now() });
    });
  }

  private async insertCheckIn(playerId: string, campusId: CampusId, c: CheckIn) {
    // Make ids unique across players (two players can stamp the same place).
    c.id = `${c.id}-${playerId.slice(0, 8)}`;
    await this.db.query(
      `insert into checkins (id, player_id, campus_id, place_id, zone_id, points, bonus, away, completed_neighborhood, captured, verified, at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [c.id, playerId, campusId, c.placeId, c.zoneId, c.points, c.bonus, c.away, c.completedNeighborhood ?? null, c.captured?.join(',') ?? null, c.verified ?? false, new Date(c.at)],
    );
  }
}
