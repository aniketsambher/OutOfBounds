import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CampusId, CheckIn, GameAlert, LatLng } from '../data/types';
import { api, ApiError, type ServerInfo } from '../lib/api';
import {
  allZoneStatuses,
  buildDemoHistory,
  campusById,
  computeZoneCounts,
  makeCheckIn,
  placeById,
  rivalMove,
  weekStart,
  type Boosts,
  type ZoneCounts,
} from '../lib/game';

export type CheckInResult = { ok: true; checkIn: CheckIn } | { ok: false; error: string };

export interface CaptureEvent {
  zoneId: CampusId;
  owner: CampusId;
  previousOwner: CampusId;
  byPlayerId?: string;
}

interface GameState {
  onboarded: boolean;
  name: string;
  campusId: CampusId;
  /** Check in without GPS. On the shared server this needs a team account or visitor mode. */
  demoMode: boolean;
  checkIns: CheckIn[];
  /** Simulated stamps from other students that only this player sees (visitor or offline). */
  boosts: Boosts;
  /** "Reset turf" for one player: their own unshared stamps from before this time stop counting on their map. */
  turfResetAt: number;
  alerts: GameAlert[];
  /** Shared-game session (server mode). */
  token?: string;
  playerId?: string;
  /** Team account: check-ins without GPS count on the shared map, and the demo controls change the shared game. */
  isTeam: boolean;
  /** Not persisted: set when the API server is reachable. */
  server: ServerInfo | null;
  serverCounts: ZoneCounts | null;

  connect: () => Promise<void>;
  refreshTurf: () => Promise<void>;
  setProfile: (name: string, campusId: CampusId, withDemoHistory: boolean) => Promise<void>;
  checkIn: (placeId: string, opts?: { pos?: LatLng; photo?: { data: string; mimeType: string } }) => Promise<CheckInResult>;
  joinTeam: (key: string) => Promise<void>;
  simulateRival: () => Promise<void>;
  resetTurf: () => Promise<void>;
  resetProgress: () => Promise<void>;
  signOut: () => Promise<void>;
  receiveCapture: (e: CaptureEvent) => Promise<void>;
  dismissAlert: (id: string) => void;
  setDemoMode: (on: boolean) => void;
}

const initial = {
  onboarded: false,
  name: '',
  campusId: 'neu' as CampusId,
  demoMode: true,
  checkIns: [] as CheckIn[],
  boosts: {} as Boosts,
  turfResetAt: 0,
  alerts: [] as GameAlert[],
  token: undefined as string | undefined,
  playerId: undefined as string | undefined,
  isTeam: false,
};

/** Whether this player may check in without GPS right now. */
export const canSkipGps = (s: Pick<GameState, 'server' | 'isTeam'>) => !s.server || s.isTeam || s.server.visitorMode;

/** Visitor on the shared server: check-ins without GPS only show up for this player. */
export const isVisitor = (s: Pick<GameState, 'server' | 'isTeam'>) => Boolean(s.server) && !s.isTeam;

type ViewState = Pick<GameState, 'server' | 'serverCounts' | 'checkIns' | 'campusId' | 'boosts' | 'turfResetAt'>;

/**
 * The turf map as this player sees it: the shared counts (or the seed data when offline), plus rivals they
 * simulated, plus their own check-ins this week that the shared map doesn't include (visitor or offline stamps).
 */
export function viewCounts(s: ViewState): ZoneCounts {
  const since = Math.max(weekStart(), s.turfResetAt);
  if (s.server && s.serverCounts) {
    return computeZoneCounts(s.checkIns.filter((c) => !c.verified), s.campusId, s.boosts, { base: s.serverCounts, since });
  }
  return computeZoneCounts(s.checkIns, s.campusId, s.boosts, { since });
}

/** Counts a simulated rival move is planned on: the shared map for team accounts (that's what they change), else the player's own view. */
export function rivalBase(s: ViewState & Pick<GameState, 'isTeam'>): ZoneCounts {
  return s.server && s.isTeam && s.serverCounts ? s.serverCounts : viewCounts(s);
}

let alertSeq = 0;
const newAlertId = () => `alert-${Date.now()}-${alertSeq++}`;

/** Alert text for a zone changing hands, told from the viewer's campus. */
function captureAlert(e: CaptureEvent, myCampus: CampusId): GameAlert {
  const winner = campusById[e.owner];
  const zone = campusById[e.zoneId];
  let title: string;
  let body: string;
  if (e.owner === myCampus) {
    title = `${winner.team} captured ${zone.short}!`;
    body = `${winner.name} students now hold the most stamps around ${zone.name}. Keep collecting there for 2× points.`;
  } else if (e.previousOwner === myCampus) {
    title = e.owner === e.zoneId ? `${zone.short} took back its home turf` : `${winner.team} took ${zone.short} from you`;
    body = `Your campus lost the ${zone.short} zone. Get back out there!`;
  } else if (e.owner === e.zoneId) {
    title = `${zone.short} took back its home turf`;
    body = `${zone.name} students reclaimed their zone from the ${campusById[e.previousOwner].team}.`;
  } else {
    title = `${winner.team} captured ${zone.short}`;
    body = `${winner.name} now holds the most stamps around ${zone.name}.`;
  }
  return { id: newAlertId(), title, body, logo: winner.logo, at: Date.now() };
}

const changedOwners = (before: ZoneCounts, after: ZoneCounts): CaptureEvent[] => {
  const b = allZoneStatuses(before);
  const a = allZoneStatuses(after);
  return (Object.keys(a) as CampusId[])
    .filter((z) => b[z].owner !== a[z].owner)
    .map((z) => ({ zoneId: z, owner: a[z].owner, previousOwner: b[z].owner }));
};

/** One connection attempt at a time (React runs effects twice in development). */
let connecting: Promise<void> | null = null;

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...initial,
      server: null,
      serverCounts: null,

      connect: () => {
        connecting ??= (async () => {
          let info: ServerInfo;
          try {
            info = await api.health();
          } catch {
            set({ server: null });
            return;
          }
          set({ server: info });
          const s = get();
          const local = s.checkIns.map(({ placeId, at }) => ({ placeId, at }));
          // Join the shared game with the same profile, bringing along anything played offline.
          const join = async () => {
            const r = await api.createPlayer(s.name, s.campusId, false, local);
            set({ token: r.token, playerId: r.player.id, isTeam: r.player.isTeam, checkIns: r.checkIns });
          };
          try {
            if (s.onboarded && s.token) {
              try {
                const me = await api.me(s.token);
                let checkIns = me.checkIns;
                // Check-ins made on this device while the server was unreachable get added, not dropped.
                const missing = local.filter((l) => !checkIns.some((c) => c.placeId === l.placeId));
                if (missing.length) checkIns = (await api.importCheckIns(s.token, missing)).checkIns;
                set({ checkIns, name: me.player.name, campusId: me.player.campusId, playerId: me.player.id, isTeam: me.player.isTeam });
              } catch (e) {
                // 401: the server no longer knows this player (its database was reset).
                if (e instanceof ApiError && e.status === 401) await join();
                else throw e;
              }
            } else if (s.onboarded) {
              await join();
            }
          } catch {
            /* server reachable but the session couldn't be restored; stay on local data */
          }
          await get().refreshTurf();
        })().finally(() => {
          connecting = null;
        });
        return connecting;
      },

      refreshTurf: async () => {
        if (!get().server) return;
        try {
          const { counts } = await api.turf();
          set({ serverCounts: counts });
        } catch {
          /* keep the last counts */
        }
      },

      setProfile: async (name, campusId, withDemoHistory) => {
        const base = { onboarded: true, name: name.trim(), campusId, boosts: {}, turfResetAt: 0, alerts: [] };
        if (get().server) {
          try {
            const r = await api.createPlayer(name.trim(), campusId, withDemoHistory);
            set({ ...base, token: r.token, playerId: r.player.id, isTeam: r.player.isTeam, checkIns: r.checkIns });
            await get().refreshTurf();
            return;
          } catch {
            set({ server: null });
          }
        }
        set({ ...base, token: undefined, playerId: undefined, isTeam: false, checkIns: withDemoHistory ? buildDemoHistory(campusId) : [] });
      },

      checkIn: async (placeId, opts = {}) => {
        const s = get();
        if (!placeById[placeId]) return { ok: false, error: 'Unknown place.' };
        if (s.checkIns.some((c) => c.placeId === placeId)) return { ok: false, error: "You've already stamped this spot." };

        if (s.server && s.token) {
          let checkIn: CheckIn;
          try {
            const demo = s.demoMode && canSkipGps(s);
            ({ checkIn } = await api.checkIn(s.token, { placeId, demo, pos: opts.pos, photo: opts.photo }));
          } catch (e) {
            if (e instanceof ApiError) return { ok: false, error: e.message };
            set({ server: null }); // unreachable: show "Offline" and keep retrying in the background
            return { ok: false, error: "Can't reach the server right now. Try again in a moment." };
          }
          const cur = get();
          const before = viewCounts(cur);
          if (!checkIn.verified) {
            // Visitor stamp: the shared map doesn't change, but this player's own map can.
            const after = viewCounts({ ...cur, checkIns: [...cur.checkIns, checkIn] });
            const won = changedOwners(before, after).filter((e) => e.owner === cur.campusId).map((e) => e.zoneId);
            if (won.length) checkIn.captured = won;
          }
          const owners = allZoneStatuses(before);
          const alerts = (checkIn.captured ?? []).map((z) =>
            captureAlert({ zoneId: z, owner: cur.campusId, previousOwner: owners[z].owner }, cur.campusId),
          );
          set({ checkIns: [...cur.checkIns, checkIn], alerts: [...alerts, ...cur.alerts] });
          void get().refreshTurf();
          return { ok: true, checkIn };
        }

        // Offline / local mode.
        const before = viewCounts(s);
        const checkIn = makeCheckIn(s.checkIns, placeId, Date.now(), s.campusId);
        const checkIns = [...s.checkIns, checkIn];
        const events = changedOwners(before, viewCounts({ ...s, checkIns })).filter((e) => e.owner === s.campusId);
        if (events.length) checkIn.captured = events.map((e) => e.zoneId);
        set({ checkIns, alerts: [...events.map((e) => captureAlert(e, s.campusId)), ...s.alerts] });
        return { ok: true, checkIn };
      },

      joinTeam: async (key) => {
        const s = get();
        if (!s.server || !s.token) throw new Error('Connect to the live server first.');
        const { player } = await api.joinTeam(s.token, key);
        set({ isTeam: player.isTeam });
      },

      simulateRival: async () => {
        const s = get();
        const move = rivalMove(rivalBase(s), s.campusId);
        if (!move) throw new Error('Your campus holds no zones right now, so there is nothing to defend.');
        if (s.server && s.isTeam && s.token) {
          // Shared game: the server announces any capture to everyone over the live event stream.
          const { counts } = await api.simulate(s.token, move.zoneId, move.attacker, move.amount);
          set({ serverCounts: counts });
          return;
        }
        // Visitor or offline: the rival only shows up on this player's map.
        const boosts: Boosts = {
          ...s.boosts,
          [move.zoneId]: { ...s.boosts[move.zoneId], [move.attacker]: (s.boosts[move.zoneId]?.[move.attacker] ?? 0) + move.amount },
        };
        const events = changedOwners(viewCounts(s), viewCounts({ ...s, boosts }));
        set({ boosts, alerts: [...events.map((e) => captureAlert(e, s.campusId)), ...s.alerts] });
      },

      resetTurf: async () => {
        const s = get();
        if (s.server && s.isTeam && s.token) {
          const { counts } = await api.resetTurf(s.token);
          set({ serverCounts: counts });
          return;
        }
        set({ boosts: {}, turfResetAt: Date.now() });
      },

      resetProgress: async () => {
        const s = get();
        if (s.server && s.token) {
          // Same account on the server, so the old check-ins can't be counted twice.
          const { checkIns } = await api.resetMe(s.token, true);
          set({ checkIns, alerts: [] });
          void get().refreshTurf();
          return;
        }
        set({ checkIns: buildDemoHistory(s.campusId), alerts: [] });
      },

      signOut: async () => {
        const s = get();
        if (s.server && s.token) await api.deleteMe(s.token).catch(() => undefined);
        set({ ...initial });
      },

      receiveCapture: async (e) => {
        await get().refreshTurf();
        const s = get();
        if (e.byPlayerId && e.byPlayerId === s.playerId) return; // already alerted from our own check-in
        // A visitor's own stamps can keep a zone looking different on their map; only announce what they see.
        if (allZoneStatuses(viewCounts(s))[e.zoneId].owner !== e.owner) return;
        set({ alerts: [captureAlert(e, s.campusId), ...s.alerts] });
      },

      dismissAlert: (id) => set({ alerts: get().alerts.filter((a) => a.id !== id) }),
      setDemoMode: (on) => set({ demoMode: on }),
    }),
    {
      name: 'out-of-bounds-v1',
      partialize: (s) => ({
        onboarded: s.onboarded,
        name: s.name,
        campusId: s.campusId,
        demoMode: s.demoMode,
        checkIns: s.checkIns,
        boosts: s.boosts,
        turfResetAt: s.turfResetAt,
        token: s.token,
        playerId: s.playerId,
        isTeam: s.isTeam,
      }),
      // Drop saved check-ins for places that no longer exist, so old data can't break a screen.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>;
        return { ...current, ...p, checkIns: (p.checkIns ?? current.checkIns).filter((c) => placeById[c.placeId]) };
      },
    },
  ),
);

/** Zone counts as this player sees them (shared map plus their own unshared stamps, or local data offline). */
export function useZoneCounts(): ZoneCounts {
  const server = useGame((s) => s.server);
  const serverCounts = useGame((s) => s.serverCounts);
  const checkIns = useGame((s) => s.checkIns);
  const campusId = useGame((s) => s.campusId);
  const boosts = useGame((s) => s.boosts);
  const turfResetAt = useGame((s) => s.turfResetAt);
  return useMemo(
    () => viewCounts({ server, serverCounts, checkIns, campusId, boosts, turfResetAt }),
    [server, serverCounts, checkIns, campusId, boosts, turfResetAt],
  );
}
