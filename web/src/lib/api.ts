import type { CampusId, CheckIn, LatLng } from '../data/types';
import type { ZoneCounts } from './game';

export interface ServerInfo {
  ok: boolean;
  db: 'postgres' | 'pglite';
  gemini: boolean;
  allowDemo: boolean;
}

export interface PlayerInfo {
  id: string;
  name: string;
  campusId: CampusId;
}

export interface QuestTip {
  neighborhoodId: string;
  title: string;
  pitch: string;
  ai: boolean;
}

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
  createPlayer: (name: string, campusId: CampusId, withDemoHistory: boolean) =>
    call<{ player: PlayerInfo; token: string; checkIns: CheckIn[] }>('/api/players', {
      method: 'POST',
      body: JSON.stringify({ name, campusId, withDemoHistory }),
    }),
  me: (token: string) => call<{ player: PlayerInfo; checkIns: CheckIn[] }>('/api/me', { token }),
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
  simulate: (zoneId: CampusId, campusId: CampusId, amount: number) =>
    call<{ counts: ZoneCounts }>('/api/simulate', { method: 'POST', body: JSON.stringify({ zoneId, campusId, amount }) }),
  resetTurf: () => call<{ counts: ZoneCounts }>('/api/demo/reset-turf', { method: 'POST' }),
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
