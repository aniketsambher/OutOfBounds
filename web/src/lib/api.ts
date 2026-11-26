import type { CampusId, CheckIn, LatLng } from '../data/types';
import type { ZoneCounts } from './game';

export interface ServerInfo {
  ok: boolean;
  db: 'postgres' | 'pglite';
  gemini: boolean;
  /** Every account gets team powers (local development / private stage server). */
  allowDemo: boolean;
  /** The server has a team password, so the Profile shows the "Team access" box. */
  teamAccess: boolean;
  /** Non-team players can check in without GPS; those check-ins only show up for them. */
  visitorMode: boolean;
}

export interface PlayerInfo {
  id: string;
  name: string;
  campusId: CampusId;
  isTeam: boolean;
}

export interface QuestTip {
  neighborhoodId: string;
  title: string;
  pitch: string;
  ai: boolean;
}

/** A check-in made offline on this device, sent to the server to keep. */
export type CheckInImport = Pick<CheckIn, 'placeId' | 'at'>;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  const res = await fetch(path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export const api = {
  health: () => call<ServerInfo>('/api/health', { signal: AbortSignal.timeout(3000) }),
  createPlayer: (name: string, campusId: CampusId, withDemoHistory: boolean, checkIns: CheckInImport[] = []) =>
    call<{ player: PlayerInfo; token: string; checkIns: CheckIn[] }>('/api/players', {
      method: 'POST',
      body: JSON.stringify({ name, campusId, withDemoHistory, checkIns }),
    }),
  me: (token: string) => call<{ player: PlayerInfo; checkIns: CheckIn[] }>('/api/me', { token }),
  deleteMe: (token: string) => call<{ ok: boolean }>('/api/me', { method: 'DELETE', token }),
  joinTeam: (token: string, key: string) =>
    call<{ player: PlayerInfo }>('/api/me/team', { method: 'POST', token, body: JSON.stringify({ key }) }),
  importCheckIns: (token: string, checkIns: CheckInImport[]) =>
    call<{ checkIns: CheckIn[] }>('/api/me/import', { method: 'POST', token, body: JSON.stringify({ checkIns }) }),
  resetMe: (token: string, withDemoHistory: boolean) =>
    call<{ checkIns: CheckIn[] }>('/api/me/reset', { method: 'POST', token, body: JSON.stringify({ withDemoHistory }) }),
  checkIn: (
    token: string,
    body: { placeId: string; demo: boolean; pos?: LatLng; photo?: { data: string; mimeType: string } },
  ) =>
    call<{ checkIn: CheckIn; verdict?: { match: boolean; reason: string } }>('/api/checkins', {
      method: 'POST',
      token,
      body: JSON.stringify({ placeId: body.placeId, demo: body.demo, lat: body.pos?.[0], lng: body.pos?.[1], photo: body.photo }),
    }),
  turf: () => call<{ counts: ZoneCounts }>('/api/turf'),
  simulate: (token: string, zoneId: CampusId, campusId: CampusId, amount: number) =>
    call<{ counts: ZoneCounts }>('/api/simulate', { method: 'POST', token, body: JSON.stringify({ zoneId, campusId, amount }) }),
  resetTurf: (token: string) => call<{ counts: ZoneCounts }>('/api/demo/reset-turf', { method: 'POST', token }),
  questTip: (token: string) => call<{ tip: QuestTip | null }>('/api/quest-tip', { token }),
};

/** Shrinks a photo to at most 1024 px and returns base64 JPEG (keeps uploads small for Gemini). */
export async function photoToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  return { data: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
}
