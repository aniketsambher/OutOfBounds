import { campuses, demoHistory, neighborhoods, places, seedZoneCounts } from './seed';
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
  const checkIn: CheckIn = {
    id: `${placeId}-${at}`,
    placeId,
    at,
    points: away ? BASE_POINTS * 2 : BASE_POINTS,
    away,
    zoneId,
    bonus: 0,
  };
  if (place.neighborhoodId) {
    const before = progressFor(prev, place.neighborhoodId);
    if (!before.complete && before.done + 1 >= STAMP_GOAL) {
      checkIn.completedNeighborhood = place.neighborhoodId;
      const types = [...before.doneIds].map((id) => placeById[id].type).concat(place.type);
      if (types.some(isFood) && types.some((t) => !isFood(t))) checkIn.bonus = MIX_BONUS;
    }
  }
  return checkIn;
}

export function buildDemoHistory(campusId: CampusId): CheckIn[] {
  const list: CheckIn[] = [];
  for (const [placeId, iso] of demoHistory) list.push(makeCheckIn(list, placeId, new Date(iso).getTime(), campusId));
  return list;
}

export type ZoneCounts = Record<CampusId, Record<CampusId, number>>;
export type Boosts = Partial<Record<CampusId, Partial<Record<CampusId, number>>>>;

const zeroCounts = (): Record<CampusId, number> =>
  Object.fromEntries(campuses.map((c) => [c.id, 0])) as Record<CampusId, number>;

/** Stamp counts per campus in each zone: seed data + simulated rival activity + the player's own check-ins. */
export function computeZoneCounts(checkIns: CheckIn[], playerCampus: CampusId, boosts: Boosts): ZoneCounts {
  const out = {} as ZoneCounts;
  for (const z of campuses) {
    const row = zeroCounts();
    for (const c of campuses) row[c.id] = (seedZoneCounts[z.id][c.id] ?? 0) + (boosts[z.id]?.[c.id] ?? 0);
    out[z.id] = row;
  }
  for (const ci of checkIns) if (ci.zoneId) out[ci.zoneId][playerCampus] += 1;
  return out;
}

/** Seed baseline plus stamp counts loaded from the database (server mode). */
export function zoneCountsFrom(rows: Array<{ zoneId: CampusId; campusId: CampusId; count: number }>): ZoneCounts {
  const out = computeZoneCounts([], 'neu', {});
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
  return checkIns.reduce((max, ci) => Math.max(max, distanceM(center, placeById[ci.placeId].pos)), 800);
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
