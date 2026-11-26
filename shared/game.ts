import { campuses, demoHistory, neighborhoods, places, seedZoneCounts, weeklyChallenge } from './seed';
import type { Campus, CampusId, CheckIn, IconName, LatLng, Neighborhood, Place, PlaceType } from './types';
import { distanceM } from './geo';

/** Places you need to check in at to earn a neighborhood stamp. */
export const STAMP_GOAL = 2;
export const BASE_POINTS = 100;
export const MIX_BONUS = 100;
/** How close (meters) you must be to a place to check in when demo mode is off. */
export const CHECK_IN_RADIUS_M = 200;

export const campusById = Object.fromEntries(campuses.map((c) => [c.id, c])) as Record<CampusId, Campus>;
export const placeById: Record<string, Place> = Object.fromEntries(places.map((p) => [p.id, p]));
export const neighborhoodById: Record<string, Neighborhood> = Object.fromEntries(
  neighborhoods.map((n) => [n.id, n]),
);

export const typeMeta: Record<PlaceType, { label: string; icon: IconName; text: string; bg: string }> = {
  eat: { label: 'LOCAL EATS', icon: 'bowl', text: '#8A4A0B', bg: '#FBF1E4' },
  bakery: { label: 'BAKERY', icon: 'bread', text: '#8A4A0B', bg: '#FBF1E4' },
  landmark: { label: 'LANDMARK', icon: 'landmark', text: '#14213D', bg: '#E6EAF3' },
  park: { label: 'PARK', icon: 'tree', text: '#1A5C4C', bg: '#E3F0EA' },
};

export const isFood = (t: PlaceType) => t === 'eat' || t === 'bakery';

export function placesIn(neighborhoodId: string): Place[] {
  return places.filter((p) => p.neighborhoodId === neighborhoodId);
}

/** The campus zone a point falls in (nearest center wins when zones overlap). */
export function zoneForPos(pos: LatLng): CampusId | null {
  let best: { id: CampusId; d: number } | null = null;
  for (const c of campuses) {
    const d = distanceM(pos, c.center);
    if (d <= c.radiusM && (!best || d < best.d)) best = { id: c.id, d };
  }
  return best?.id ?? null;
}

export interface NeighborhoodProgress {
  done: number;
  complete: boolean;
  completedAt?: number;
  doneIds: Set<string>;
}

export function progressFor(checkIns: CheckIn[], neighborhoodId: string): NeighborhoodProgress {
  const mine = checkIns.filter((c) => placeById[c.placeId]?.neighborhoodId === neighborhoodId);
  const doneIds = new Set(mine.map((c) => c.placeId));
  const completing = mine.find((c) => c.completedNeighborhood === neighborhoodId);
  return { done: doneIds.size, complete: doneIds.size >= STAMP_GOAL, completedAt: completing?.at, doneIds };
}

/** Builds a check-in record (points, zone, neighborhood completion, mix bonus) from the history before it. */
export function makeCheckIn(prev: CheckIn[], placeId: string, at: number, campusId: CampusId): CheckIn {
  const place = placeById[placeId];
  const zoneId = zoneForPos(place.pos);
  const away = zoneId !== null && zoneId !== campusId;
  const challenge = place.neighborhoodId === weeklyChallenge.neighborhoodId;
  const checkIn: CheckIn = {
    id: `${placeId}-${at}`,
    placeId,
    at,
    points: BASE_POINTS * (away ? 2 : 1) * (challenge ? weeklyChallenge.multiplier : 1),
    away,
    zoneId,
    bonus: 0,
  };
  if (place.neighborhoodId) {
    const before = progressFor(prev, place.neighborhoodId);
    // The stamp (and its mix bonus) is earned once per neighborhood, by a check-in at a new place.
    const alreadyStamped = prev.some((c) => c.completedNeighborhood === place.neighborhoodId);
    const newPlace = !before.doneIds.has(placeId);
    if (newPlace && !alreadyStamped && !before.complete && before.done + 1 >= STAMP_GOAL) {
      checkIn.completedNeighborhood = place.neighborhoodId;
      const types = [...before.doneIds].map((id) => placeById[id].type).concat(place.type);
      if (types.some(isFood) && types.some((t) => !isFood(t))) checkIn.bonus = MIX_BONUS;
    }
  }
  return checkIn;
}

/** True when a stored check-in earned the weekly challenge multiplier (used for display). */
export const challengeBoosted = (c: CheckIn) => c.points > BASE_POINTS * (c.away ? 2 : 1);

export function buildDemoHistory(campusId: CampusId): CheckIn[] {
  const list: CheckIn[] = [];
  for (const [placeId, iso] of demoHistory) list.push(makeCheckIn(list, placeId, new Date(iso).getTime(), campusId));
  return list;
}

/**
 * Rebuilds check-ins from (place, time) pairs, for example progress made offline on a device.
 * Returns only the new check-ins. Skips unknown places, places already in `prev`, repeats and future times.
 */
export function replayHistory(
  items: Array<{ placeId: string; at: number }>,
  campusId: CampusId,
  prev: CheckIn[] = [],
): CheckIn[] {
  const all = [...prev];
  const added: CheckIn[] = [];
  const now = Date.now();
  for (const { placeId, at } of [...items].sort((a, b) => a.at - b.at)) {
    if (!placeById[placeId] || !Number.isFinite(at) || at <= 0 || at > now) continue;
    if (all.some((c) => c.placeId === placeId)) continue;
    const c = makeCheckIn(all, placeId, Math.round(at), campusId);
    all.push(c);
    added.push(c);
  }
  return added;
}

/** Start of the current game week: Monday 00:00 local time (turf resets at Sunday midnight). */
export function weekStart(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export type ZoneCounts = Record<CampusId, Record<CampusId, number>>;
export type Boosts = Partial<Record<CampusId, Partial<Record<CampusId, number>>>>;

const zeroCounts = (): Record<CampusId, number> =>
  Object.fromEntries(campuses.map((c) => [c.id, 0])) as Record<CampusId, number>;

function seedCounts(): ZoneCounts {
  const out = {} as ZoneCounts;
  for (const z of campuses) {
    const row = zeroCounts();
    for (const c of campuses) row[c.id] = seedZoneCounts[z.id][c.id] ?? 0;
    out[z.id] = row;
  }
  return out;
}

/**
 * Stamp counts per campus in each zone: a baseline (seed data, or the shared counts from the server),
 * plus simulated rival activity, plus the player's own check-ins made at or after `since`.
 */
export function computeZoneCounts(
  checkIns: CheckIn[],
  playerCampus: CampusId,
  boosts: Boosts,
  opts: { base?: ZoneCounts; since?: number } = {},
): ZoneCounts {
  const base = opts.base ?? seedCounts();
  const since = opts.since ?? -Infinity;
  const out = {} as ZoneCounts;
  for (const z of campuses) {
    const row = zeroCounts();
    for (const c of campuses) row[c.id] = (base[z.id]?.[c.id] ?? 0) + (boosts[z.id]?.[c.id] ?? 0);
    out[z.id] = row;
  }
  for (const ci of checkIns) if (ci.zoneId && ci.at >= since && out[ci.zoneId]) out[ci.zoneId][playerCampus] += 1;
  return out;
}

/** Seed baseline plus stamp counts loaded from the database (server mode). */
export function zoneCountsFrom(rows: Array<{ zoneId: CampusId; campusId: CampusId; count: number }>): ZoneCounts {
  const out = seedCounts();
  for (const r of rows) if (out[r.zoneId] && r.campusId in out[r.zoneId]) out[r.zoneId][r.campusId] += r.count;
  return out;
}

export const isCampusId = (v: unknown): v is CampusId => typeof v === 'string' && v in campusById;

export interface ZoneStatus {
  zoneId: CampusId;
  owner: CampusId;
  captured: boolean;
  contested: boolean;
  ranking: Array<{ campusId: CampusId; count: number }>;
}

/** Most stamps owns the zone; ties go to the home campus. Within 2 stamps counts as contested. */
export function zoneStatus(counts: ZoneCounts, zoneId: CampusId): ZoneStatus {
  const ranking = campuses
    .map((c) => ({ campusId: c.id, count: counts[zoneId][c.id] }))
    .filter((r) => r.count > 0 || r.campusId === zoneId)
    .sort((a, b) => b.count - a.count || (a.campusId === zoneId ? -1 : b.campusId === zoneId ? 1 : 0));
  const owner = ranking[0].campusId;
  const runnerUp = ranking[1];
  return {
    zoneId,
    owner,
    captured: owner !== zoneId,
    contested: runnerUp ? ranking[0].count - runnerUp.count <= 2 : false,
    ranking,
  };
}

export function allZoneStatuses(counts: ZoneCounts): Record<CampusId, ZoneStatus> {
  return Object.fromEntries(campuses.map((c) => [c.id, zoneStatus(counts, c.id)])) as Record<CampusId, ZoneStatus>;
}

export function zonesHeldBy(statuses: Record<CampusId, ZoneStatus>, campusId: CampusId): CampusId[] {
  return campuses.filter((z) => statuses[z.id].owner === campusId).map((z) => z.id);
}

export interface RivalMove {
  zoneId: CampusId;
  attacker: CampusId;
  /** Stamps the attacker needs to take the zone (capped at 50, the server's limit). */
  amount: number;
}

/**
 * Demo helper: a rival move that takes a zone away from the player's campus, so the "you lost a zone" alert
 * can be shown. A zone the campus captured gets retaken by its home campus; otherwise the strongest rival
 * attacks the home zone. Null when the player's campus holds no zones.
 */
export function rivalMove(counts: ZoneCounts, myCampus: CampusId): RivalMove | null {
  const statuses = allZoneStatuses(counts);
  const held = zonesHeldBy(statuses, myCampus);
  if (!held.length) return null;
  const captured = held.find((z) => z !== myCampus);
  const zoneId = captured ?? myCampus;
  const attacker =
    captured ?? statuses[zoneId].ranking.find((r) => r.campusId !== myCampus)?.campusId ?? (myCampus === 'bu' ? 'neu' : 'bu');
  const row = counts[zoneId];
  // Ties go to the home campus, so a campus retaking its own zone only needs to draw level.
  const needed = row[myCampus] - row[attacker] + (attacker === zoneId ? 0 : 1);
  return { zoneId, attacker, amount: Math.min(Math.max(needed, 1), 50) };
}

export function typeCounts(checkIns: CheckIn[]) {
  const counts = { eats: 0, landmarks: 0, parks: 0 };
  for (const ci of checkIns) {
    const t = placeById[ci.placeId]?.type;
    if (!t) continue;
    if (isFood(t)) counts.eats += 1;
    else if (t === 'landmark') counts.landmarks += 1;
    else counts.parks += 1;
  }
  return counts;
}

export const totalPoints = (checkIns: CheckIn[]) => checkIns.reduce((s, c) => s + c.points + c.bonus, 0);

/** Radius of the player's "bubble": how far from campus their stamps reach (minimum 800 m). */
export function bubbleRadiusM(checkIns: CheckIn[], campusId: CampusId): number {
  const center = campusById[campusId].center;
  return checkIns.reduce((max, ci) => {
    const place = placeById[ci.placeId];
    return place ? Math.max(max, distanceM(center, place.pos)) : max;
  }, 800);
}

/** Closest neighborhood (to campus) that the player hasn't stamped yet. */
export function nextNeighborhood(checkIns: CheckIn[], campusId: CampusId): Neighborhood | undefined {
  const center = campusById[campusId].center;
  return neighborhoods
    .filter((n) => !progressFor(checkIns, n.id).complete)
    .sort((a, b) => {
      const pa = progressFor(checkIns, a.id).done;
      const pb = progressFor(checkIns, b.id).done;
      return pb - pa || distanceM(center, a.center) - distanceM(center, b.center);
    })[0];
}

export function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
