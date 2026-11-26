import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import { CHECK_IN_RADIUS_M, isCampusId, neighborhoodById, placeById, progressFor, campusById } from '../../shared/game';
import { neighborhoods } from '../../shared/seed';
import { distanceM, formatDistance } from '../../shared/geo';
import { createDb, migrate } from './db';
import { env } from './env';
import { subscribe } from './events';
import { GameService, type CheckInImport, type Player } from './game';
import { GeminiLimitError, geminiEnabled, questTip, verifyPhoto } from './gemini';
import { HOUR, MINUTE, allow, clientIp, teamKeyMatches } from './limits';

const db = await createDb();
await migrate(db);
const game = new GameService(db);

type Env = { Variables: { player: Player } };
const app = new Hono<Env>();

type ErrorStatus = 400 | 401 | 403 | 404 | 413 | 422 | 429 | 502;
const bad = (c: Context, status: ErrorStatus, error: string, extra?: object) => c.json({ error, ...extra }, status);

// The app shrinks photos to ~1024 px before upload, far below this.
app.use('/api/*', bodyLimit({ maxSize: 4 * 1024 * 1024, onError: (c) => bad(c, 413, 'That upload is too big.') }));

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    db: db.kind,
    gemini: geminiEnabled(),
    allowDemo: env.allowDemo,
    teamAccess: Boolean(env.teamKey),
    visitorMode: env.visitorMode,
  }),
);

/** Check-ins a device made offline, sent when it joins or reconnects. */
function parseImports(value: unknown): CheckInImport[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 100)
    .filter((x): x is CheckInImport => typeof x?.placeId === 'string' && typeof x?.at === 'number')
    .map((x) => ({ placeId: x.placeId, at: x.at }));
}

app.post('/api/players', async (c) => {
  if (!allow(`players:${clientIp(c)}`, 30, 10 * MINUTE)) {
    return bad(c, 429, 'Too many new players from this network. Try again in a few minutes.');
  }
  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '';
  if (!isCampusId(body.campusId)) return bad(c, 400, 'Pick a valid campus.');
  const { player, token } = await game.createPlayer(name, body.campusId, Boolean(body.withDemoHistory), parseImports(body.checkIns));
  return c.json({ player, token, checkIns: await game.checkIns(player.id) });
});

async function auth(c: Context<Env>, next: () => Promise<void>) {
  const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const player = token ? await game.playerByToken(token) : null;
  if (!player) return bad(c, 401, 'Not signed in.');
  c.set('player', player);
  await next();
}

async function teamOnly(c: Context<Env>, next: () => Promise<void>) {
  if (!c.get('player').isTeam) return bad(c, 403, 'Only team accounts can use the demo controls.');
  await next();
}

// Everything below needs the player's token; demo controls also need a team account.
app.use('/api/me', auth);
app.use('/api/me/*', auth);
app.use('/api/checkins', auth);
app.use('/api/quest-tip', auth);
app.use('/api/simulate', auth, teamOnly);
app.use('/api/demo/*', auth, teamOnly);

app.get('/api/me', async (c) => {
  const player = c.get('player');
  return c.json({ player, checkIns: await game.checkIns(player.id) });
});

/** "Sign out and start over": removes the player and their check-ins. */
app.delete('/api/me', async (c) => {
  await game.deletePlayer(c.get('player'));
  return c.json({ ok: true });
});

/** Turns this account into a team account when the right TEAM_KEY is given. */
app.post('/api/me/team', async (c) => {
  const player = c.get('player');
  if (!env.teamKey) return bad(c, 404, 'Team access is not set up on this server.');
  if (!allow(`team-ip:${clientIp(c)}`, 5, 10 * MINUTE) || !allow(`team:${player.id}`, 5, 10 * MINUTE)) {
    return bad(c, 429, 'Too many tries. Wait 10 minutes and try again.');
  }
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.key !== 'string' || !teamKeyMatches(body.key.trim())) return bad(c, 403, "That team password isn't right.");
  await game.setTeam(player.id);
  return c.json({ player: { ...player, isTeam: true } });
});

/** Adds check-ins made offline on this device to the player's history. */
app.post('/api/me/import', async (c) => {
  const player = c.get('player');
  if (!allow(`import:${player.id}`, 10, HOUR)) return bad(c, 429, 'Too many syncs. Try again later.');
  const body = await c.req.json().catch(() => ({}));
  await game.importCheckIns(player, parseImports(body.checkIns));
  return c.json({ checkIns: await game.checkIns(player.id) });
});

/** "Reset my progress": same account, check-ins cleared (optionally back to the demo stamps). */
app.post('/api/me/reset', async (c) => {
  const player = c.get('player');
  const body = await c.req.json().catch(() => ({}));
  await game.resetPlayer(player, Boolean(body.withDemoHistory));
  return c.json({ checkIns: await game.checkIns(player.id) });
});

app.post('/api/checkins', async (c) => {
  const player = c.get('player');
  if (!allow(`checkin:${player.id}`, 30, MINUTE)) return bad(c, 429, 'Slow down a little and try again in a minute.');
  const body = await c.req.json().catch(() => ({}));
  const place = placeById[body.placeId];
  if (!place) return bad(c, 400, 'Unknown place.');
  if (await game.hasCheckIn(player.id, place.id)) return bad(c, 422, "You've already stamped this spot.");

  // Team accounts can skip GPS and still count on the shared map. Visitors can skip GPS too, but then the
  // check-in only shows up for them. Everyone else needs to be within range.
  let verified = true;
  if (body.demo === true && player.isTeam) verified = true;
  else if (body.demo === true && env.visitorMode) verified = false;
  else {
    if (typeof body.lat !== 'number' || typeof body.lng !== 'number') return bad(c, 400, 'Location is required to check in.');
    const d = distanceM([body.lat, body.lng], place.pos);
    if (d > CHECK_IN_RADIUS_M) return bad(c, 422, `You're ${formatDistance(d)} away. Get within ${CHECK_IN_RADIUS_M} m to check in.`);
  }

  let verdict;
  if (body.photo?.data) {
    if (!geminiEnabled()) return bad(c, 400, 'Photo check-in is not set up on this server.');
    const mimeType = String(body.photo.mimeType ?? 'image/jpeg');
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) return bad(c, 400, 'Photos must be JPEG, PNG or WebP.');
    if (!allow(`photo:${player.id}`, 10, HOUR)) return bad(c, 429, "You've reached the photo check limit for now. Check in without a photo.");
    try {
      verdict = await verifyPhoto(place, String(body.photo.data), mimeType);
    } catch (e) {
      if (e instanceof GeminiLimitError) return bad(c, 429, 'Photo checks are paused for today. Check in without a photo.');
      console.error('[gemini]', (e as Error).message);
      return bad(c, 502, "Couldn't check the photo right now. Try again or check in without a photo.");
    }
    if (!verdict.match) return bad(c, 422, `Photo didn't match ${place.name}. ${verdict.reason}`, { verdict });
  }

  const result = await game.checkIn(player, place.id, verified);
  if (!result.ok) return bad(c, 422, result.error);
  return c.json({ checkIn: result.checkIn, verdict });
});

app.get('/api/turf', async (c) => c.json({ counts: await game.zoneCounts() }));

/** Demo control (team accounts): add rival stamps in a zone. */
app.post('/api/simulate', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!isCampusId(body.zoneId) || !isCampusId(body.campusId)) return bad(c, 400, 'Unknown campus.');
  await game.simulate(body.zoneId, body.campusId, Math.min(Math.max(Number(body.amount) || 1, 1), 50));
  return c.json({ counts: await game.zoneCounts() });
});

/** Demo control (team accounts): turf goes back to the seed baseline; everyone keeps their stamps. */
app.post('/api/demo/reset-turf', async (c) => {
  await game.resetTurf();
  return c.json({ counts: await game.zoneCounts() });
});

/** Gemini tips are cached per player and check-in count, so opening the Passport tab doesn't call it every time. */
const tipCache = new Map<string, object>();

app.get('/api/quest-tip', async (c) => {
  const player = c.get('player');
  const checkIns = await game.checkIns(player.id);
  const stamped = neighborhoods.filter((n) => progressFor(checkIns, n.id).complete);
  const candidates = neighborhoods.filter((n) => !progressFor(checkIns, n.id).complete);
  if (!candidates.length) return c.json({ tip: null });
  const center = campusById[player.campusId].center;
  const nearest = [...candidates].sort((a, b) => distanceM(center, a.center) - distanceM(center, b.center));
  const fallback = (n = nearest[0]) => ({ neighborhoodId: n.id, title: `Try ${n.name}`, pitch: `${n.tagline}. ${n.tLine}, ${n.travel} from campus.`, ai: false });
  if (!geminiEnabled()) return c.json({ tip: fallback() });

  const cacheKey = `${player.id}:${checkIns.length}`;
  const cached = tipCache.get(cacheKey);
  if (cached) return c.json({ tip: cached });
  try {
    const tip = await questTip(campusById[player.campusId].name, stamped, nearest.slice(0, 5));
    const result = { ...tip, ai: true, name: neighborhoodById[tip.neighborhoodId].name };
    tipCache.set(cacheKey, result);
    if (tipCache.size > 2000) tipCache.delete(tipCache.keys().next().value!);
    return c.json({ tip: result });
  } catch (e) {
    if (!(e instanceof GeminiLimitError)) console.error('[gemini]', (e as Error).message);
    return c.json({ tip: fallback() });
  }
});

// Live capture alerts and turf refreshes (server-sent events).
app.get('/api/events', (c) =>
  streamSSE(c, async (stream) => {
    const unsubscribe = subscribe((e) => {
      void stream.writeSSE({ event: e.type, data: JSON.stringify(e) });
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
  console.log(
    `[api] listening on http://localhost:${info.port} · db=${db.kind} · gemini=${geminiEnabled() ? 'on' : 'off'}` +
      ` · team password=${env.teamKey ? 'set' : 'not set'} · visitor mode=${env.visitorMode} · open demo=${env.allowDemo}`,
  );
});
