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
  /** Skips the GPS distance check so check-ins work on stage. */
  demoMode: boolean;
  checkIns: CheckIn[];
  /** Local-only: simulated stamps from other students. */
  boosts: Boosts;
  alerts: GameAlert[];
  /** Shared-game session (server mode). */
  token?: string;
  playerId?: string;
  /** Not persisted: set when the API server is reachable. */
  server: ServerInfo | null;
  serverCounts: ZoneCounts | null;

  connect: () => Promise<void>;
  refreshTurf: () => Promise<void>;
  setProfile: (name: string, campusId: CampusId, withDemoHistory: boolean) => Promise<void>;
  checkIn: (placeId: string, opts?: { pos?: LatLng; photo?: { data: string; mimeType: string } }) => Promise<CheckInResult>;
  simulateRival: (zoneId: CampusId, campusId: CampusId, amount: number) => Promise<void>;
  resetTurf: () => Promise<void>;
  receiveCapture: (e: CaptureEvent) => void;
  dismissAlert: (id: string) => void;
  setDemoMode: (on: boolean) => void;
  reset: () => void;
}

const initial = {
  onboarded: false,
  name: '',
  campusId: 'neu' as CampusId,
  demoMode: true,
  checkIns: [] as CheckIn[],
  boosts: {} as Boosts,
  alerts: [] as GameAlert[],
  token: undefined as string | undefined,
  playerId: undefined as string | undefined,
};

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

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...initial,
      server: null,
      serverCounts: null,

      connect: async () => {
        let info: ServerInfo;
        try {
          info = await api.health();
        } catch {
          set({ server: null });
          return;
        }
        set({ server: info });
        const s = get();
        // Join the shared game with the same profile (played offline, or the server's database was reset).
        const join = async () => {
          const r = await api.createPlayer(s.name, s.campusId, s.checkIns.length > 0);
          set({ token: r.token, playerId: r.player.id, checkIns: r.checkIns });
        };
        try {
          if (s.onboarded && s.token) {
            try {
              const me = await api.me(s.token);
              set({ checkIns: me.checkIns, name: me.player.name, campusId: me.player.campusId, playerId: me.player.id });
            } catch (e) {
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
        const base = { onboarded: true, name: name.trim(), campusId, boosts: {}, alerts: [] };
        if (get().server) {
          try {
            const r = await api.createPlayer(name.trim(), campusId, withDemoHistory);
            set({ ...base, token: r.token, playerId: r.player.id, checkIns: r.checkIns });
            await get().refreshTurf();
            return;
          } catch {
            set({ server: null });
          }
        }
        set({ ...base, token: undefined, playerId: undefined, checkIns: withDemoHistory ? buildDemoHistory(campusId) : [] });
      },

      checkIn: async (placeId, opts = {}) => {
        const s = get();
        if (!placeById[placeId]) return { ok: false, error: 'Unknown place.' };
        if (s.checkIns.some((c) => c.placeId === placeId)) return { ok: false, error: "You've already stamped this spot." };
        const me = campusById[s.campusId];

        if (s.server && s.token) {
          try {
            const demo = s.demoMode && s.server.allowDemo;
            const { checkIn } = await api.checkIn(s.token, { placeId, demo, pos: opts.pos, photo: opts.photo });
            const alerts = (checkIn.captured ?? []).map((z) =>
              captureAlert({ zoneId: z, owner: s.campusId, previousOwner: z }, s.campusId),
            );
            set({ checkIns: [...get().checkIns, checkIn], alerts: [...alerts, ...get().alerts] });
            void get().refreshTurf();
            return { ok: true, checkIn };
          } catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : 'Check-in failed.' };
          }
        }

        // Offline / local mode.
        const before = computeZoneCounts(s.checkIns, s.campusId, s.boosts);
        const checkIn = makeCheckIn(s.checkIns, placeId, Date.now(), s.campusId);
        const checkIns = [...s.checkIns, checkIn];
        const events = changedOwners(before, computeZoneCounts(checkIns, s.campusId, s.boosts)).filter((e) => e.owner === me.id);
        if (events.length) checkIn.captured = events.map((e) => e.zoneId);
        set({ checkIns, alerts: [...events.map((e) => captureAlert(e, s.campusId)), ...s.alerts] });
        return { ok: true, checkIn };
      },

      simulateRival: async (zoneId, campusId, amount) => {
        const s = get();
        if (s.server) {
          // The server broadcasts any capture over the live event stream.
          const { counts } = await api.simulate(zoneId, campusId, amount);
          set({ serverCounts: counts });
          return;
        }
        const before = computeZoneCounts(s.checkIns, s.campusId, s.boosts);
        const boosts: Boosts = {
          ...s.boosts,
          [zoneId]: { ...s.boosts[zoneId], [campusId]: (s.boosts[zoneId]?.[campusId] ?? 0) + amount },
        };
        const events = changedOwners(before, computeZoneCounts(s.checkIns, s.campusId, boosts));
        set({ boosts, alerts: [...events.map((e) => captureAlert(e, s.campusId)), ...s.alerts] });
      },

      resetTurf: async () => {
        if (get().server) {
          const { counts } = await api.resetTurf();
          set({ serverCounts: counts });
        } else {
          set({ boosts: {} });
        }
      },

      receiveCapture: (e) => {
        const s = get();
        void s.refreshTurf();
        if (e.byPlayerId && e.byPlayerId === s.playerId) return; // already alerted from our own check-in
        set({ alerts: [captureAlert(e, s.campusId), ...s.alerts] });
      },

      dismissAlert: (id) => set({ alerts: get().alerts.filter((a) => a.id !== id) }),
      setDemoMode: (on) => set({ demoMode: on }),
      reset: () => set({ ...initial }),
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
        token: s.token,
        playerId: s.playerId,
      }),
    },
  ),
);

/** Zone counts from the shared server when connected, otherwise computed on this device. */
export function useZoneCounts(): ZoneCounts {
  const serverCounts = useGame((s) => (s.server ? s.serverCounts : null));
  const checkIns = useGame((s) => s.checkIns);
  const campusId = useGame((s) => s.campusId);
  const boosts = useGame((s) => s.boosts);
  return serverCounts ?? computeZoneCounts(checkIns, campusId, boosts);
}
