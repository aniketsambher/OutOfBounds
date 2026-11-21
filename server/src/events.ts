import type { CampusId } from '../../shared/types';

export interface CaptureEvent {
  type: 'capture';
  zoneId: CampusId;
  owner: CampusId;
  previousOwner: CampusId;
  /** Player whose check-in caused it (absent for simulated rival activity). */
  byPlayerId?: string;
  at: number;
}

type Listener = (e: CaptureEvent) => void;
const listeners = new Set<Listener>();

/** In-memory fan-out to every open /api/events stream (single server instance). */
export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function broadcast(e: CaptureEvent) {
  for (const fn of listeners) fn(e);
}
