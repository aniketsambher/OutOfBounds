import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { CHECK_IN_RADIUS_M, isCampusId, neighborhoodById, placeById, progressFor, campusById } from '../../shared/game';
import { neighborhoods } from '../../shared/seed';
import { distanceM, formatDistance } from '../../shared/geo';
import { createDb, migrate } from './db';
import { env } from './env';
import { subscribe } from './events';
import { GameService, type Player } from './game';
import { geminiEnabled, questTip, verifyPhoto } from './gemini';

const db = await createDb();
await migrate(db);
const game = new GameService(db);

type Env = { Variables: { player: Player } };
const app = new Hono<Env>();

const bad = (c: Context, status: 400 | 401 | 403 | 404 | 422 | 502, error: string, extra?: object) => c.json({ error, ...extra }, status);

app.get('/api/health', (c) => c.json({ ok: true, db: db.kind, gemini: geminiEnabled(), allowDemo: env.allowDemo }));

app.post('/api/players', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '';
  if (!isCampusId(body.campusId)) return bad(c, 400, 'Pick a valid campus.');
  const { player, token } = await game.createPlayer(name, body.campusId, Boolean(body.withDemoHistory));
  return c.json({ player, token, checkIns: await game.checkIns(player.id) });
});

// Everything below needs the player's token.
app.use('/api/me', auth);
app.use('/api/checkins', auth);
app.use('/api/quest-tip', auth);

async function auth(c: Context<Env>, next: () => Promise<void>) {
  const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const player = token ? await game.playerByToken(token) : null;
  if (!player) return bad(c, 401, 'Not signed in.');
  c.set('player', player);
  await next();
}

app.get('/api/me', async (c) => {
  const player = c.get('player');
  return c.json({ player, checkIns: await game.checkIns(player.id) });
});

app.post('/api/checkins', async (c) => {
  const player = c.get('player');
  const body = await c.req.json().catch(() => ({}));
  const place = placeById[body.placeId];
  if (!place) return bad(c, 400, 'Unknown place.');

  const demo = Boolean(body.demo) && env.allowDemo;
  if (!demo) {
    if (typeof body.lat !== 'number' || typeof body.lng !== 'number') return bad(c, 400, 'Location is required to check in.');
    const d = distanceM([body.lat, body.lng], place.pos);
    if (d > CHECK_IN_RADIUS_M) return bad(c, 422, `You're ${formatDistance(d)} away. Get within ${CHECK_IN_RADIUS_M} m to check in.`);
  }

  let verdict;
  if (body.photo?.data) {
    if (!geminiEnabled()) return bad(c, 400, 'Photo check-in is not set up on this server.');
    try {
      verdict = await verifyPhoto(place, String(body.photo.data), String(body.photo.mimeType ?? 'image/jpeg'));
    } catch (e) {
      console.error('[gemini]', (e as Error).message);
      return bad(c, 502, "Couldn't check the photo right now. Try again or check in without a photo.");
    }
    if (!verdict.match) return bad(c, 422, `Photo didn't match ${place.name}. ${verdict.reason}`, { verdict });
  }

  const result = await game.checkIn(player, place.id);
  if (!result.ok) return bad(c, 422, result.error);
  return c.json({ checkIn: result.checkIn, verdict });
});

app.get('/api/turf', async (c) => c.json({ counts: await game.zoneCounts() }));

app.post('/api/simulate', async (c) => {
  if (!env.allowDemo) return bad(c, 403, 'Demo controls are off.');
  const body = await c.req.json().catch(() => ({}));
  if (!isCampusId(body.zoneId) || !isCampusId(body.campusId)) return bad(c, 400, 'Unknown campus.');
  await game.simulate(body.zoneId, body.campusId, Math.min(Math.max(Number(body.amount) || 1, 1), 50));
  return c.json({ counts: await game.zoneCounts() });
});

/** Demo control: wipe this week's turf activity so zones go back to the seed baseline. */
app.post('/api/demo/reset-turf', async (c) => {
  if (!env.allowDemo) return bad(c, 403, 'Demo controls are off.');
  await game.resetTurf();
  return c.json({ counts: await game.zoneCounts() });
});

app.get('/api/quest-tip', async (c) => {
  const player = c.get('player');
  const checkIns = await game.checkIns(player.id);
  const stamped = neighborhoods.filter((n) => progressFor(checkIns, n.id).complete);
  const candidates = neighborhoods.filter((n) => !progressFor(checkIns, n.id).complete);
  if (!candidates.length) return c.json({ tip: null });
  const center = campusById[player.campusId].center;
  const nearest = [...candidates].sort((a, b) => distanceM(center, a.center) - distanceM(center, b.center));
  if (!geminiEnabled()) {
    const n = nearest[0];
    return c.json({ tip: { neighborhoodId: n.id, title: `Try ${n.name}`, pitch: `${n.tagline}. ${n.tLine}, ${n.travel} from campus.`, ai: false } });
  }
  try {
    const tip = await questTip(campusById[player.campusId].name, stamped, nearest.slice(0, 5));
    return c.json({ tip: { ...tip, ai: true, name: neighborhoodById[tip.neighborhoodId].name } });
  } catch (e) {
    console.error('[gemini]', (e as Error).message);
    const n = nearest[0];
    return c.json({ tip: { neighborhoodId: n.id, title: `Try ${n.name}`, pitch: n.tagline, ai: false } });
  }
});

// Live capture alerts (server-sent events).
app.get('/api/events', (c) =>
  streamSSE(c, async (stream) => {
    const unsubscribe = subscribe((e) => {
      void stream.writeSSE({ event: 'capture', data: JSON.stringify(e) });
    });
    stream.onAbort(() => {
      unsubscribe();
    });
    await stream.writeSSE({ event: 'ready', data: '{}' });
    while (!stream.aborted) {
      await stream.sleep(25000);
      await stream.writeSSE({ event: 'ping', data: '{}' });
    }
    unsubscribe();
  }),
);

// In production, serve the built web app from the same server.
const dist = resolve(env.webDist);
if (existsSync(join(dist, 'index.html'))) {
  const indexHtml = readFileSync(join(dist, 'index.html'), 'utf8');
  app.use('/*', serveStatic({ root: env.webDist }));
  app.get('*', (c) => (c.req.path.startsWith('/api/') ? c.notFound() : c.html(indexHtml)));
  console.log(`[web] serving ${dist}`);
}

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port} · db=${db.kind} · gemini=${geminiEnabled() ? 'on' : 'off'} · demo=${env.allowDemo}`);
});
