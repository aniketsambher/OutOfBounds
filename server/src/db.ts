import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { env } from './env';

export interface Db {
  kind: 'postgres' | 'pglite';
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
}

/** Tiger Data (or any Postgres) when DATABASE_URL is set, otherwise an embedded local Postgres. */
export async function createDb(): Promise<Db> {
  if (env.databaseUrl) {
    const pool = new pg.Pool({ connectionString: withLibpqSsl(env.databaseUrl), max: 5 });
    await pool.query('select 1');
    return {
      kind: 'postgres',
      query: async (sql, params) => ({ rows: (await pool.query(sql, params as unknown[])).rows }),
      exec: async (sql) => {
        await pool.query(sql);
      },
    };
  }
  if (process.env.RENDER) {
    console.warn(
      '[db] WARNING: DATABASE_URL is not set. Render wipes this local database on every restart and deploy, so player progress will be lost.',
    );
  }
  const { PGlite } = await import('@electric-sql/pglite');
  // Kept outside the project folder: cloud-synced folders (OneDrive) can corrupt database files.
  const dir = env.pgliteDir;
  mkdirSync(dirname(dir), { recursive: true });
  await takeLock(`${dir}.lock`);
  // PGlite's own lock file, left by a killed server, would block startup. Safe to remove while we hold our lock.
  rmSync(join(dir, 'postmaster.pid'), { force: true });
  let lite = new PGlite(dir);
  try {
    await lite.waitReady;
  } catch (e) {
    // Local dev data only: set the broken copy aside and start fresh.
    const broken = `${dir}-broken-${Date.now()}`;
    console.warn(`[db] local database unreadable (${(e as Error).message}); moved to ${broken}`);
    renameSync(dir, broken);
    lite = new PGlite(dir);
    await lite.waitReady;
  }
  const close = async () => {
    await lite.close().catch(() => undefined);
    process.exit(0);
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  console.log(`[db] local database at ${dir}`);
  return {
    kind: 'pglite',
    query: async (sql, params) => ({ rows: (await lite.query(sql, params)).rows as never[] }),
    exec: async (sql) => {
      await lite.exec(sql);
    },
  };
}

/** One server per embedded database: two processes writing the same files would corrupt it. */
async function takeLock(file: string) {
  for (let tries = 0; ; tries++) {
    try {
      writeFileSync(file, String(process.pid), { flag: 'wx' });
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    const pid = readPid(file);
    if (!pid || !isRunning(pid)) {
      rmSync(file, { force: true }); // left by a server that was killed
      continue;
    }
    // A dev-mode restart can overlap the old process for a moment, so wait a few seconds before giving up.
    if (tries >= 20) {
      throw new Error(
        `The local database is already in use by another server (process ${pid}). Stop that server first, or delete ${file} if it is gone.`,
      );
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  process.once('exit', () => {
    if (readPid(file) === process.pid) rmSync(file, { force: true });
  });
}

function readPid(file: string): number {
  try {
    return Number(readFileSync(file, 'utf8').trim()) || 0;
  } catch {
    return 0;
  }
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Tiger Data connection strings use sslmode=require, which in standard libpq means "encrypted, certificate
 * not verified". node-postgres treats it as full verification, which fails on Tiger's certificate chain.
 * Opt into libpq semantics unless DB_SSL_VERIFY=true asks for full verification.
 */
function withLibpqSsl(url: string): string {
  if (process.env.DB_SSL_VERIFY === 'true') return url;
  const u = new URL(url);
  const mode = u.searchParams.get('sslmode');
  if ((mode === 'require' || mode === 'prefer') && !u.searchParams.has('uselibpqcompat')) {
    u.searchParams.set('uselibpqcompat', 'true');
  }
  return u.toString();
}

const schema = `
create table if not exists players (
  id text primary key,
  token text unique not null,
  name text not null,
  campus_id text not null,
  is_bot boolean not null default false,
  is_team boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists checkins (
  id text not null,
  player_id text not null references players(id) on delete cascade,
  campus_id text not null,
  place_id text not null,
  zone_id text,
  points integer not null,
  bonus integer not null default 0,
  away boolean not null default false,
  completed_neighborhood text,
  captured text,
  verified boolean not null default false,
  at timestamptz not null default now(),
  primary key (id, at)
);

create table if not exists turf_resets (
  at timestamptz not null default now()
);

create index if not exists checkins_player_idx on checkins (player_id, at);
create index if not exists checkins_zone_idx on checkins (zone_id, at);

-- Columns added after the first version. Check-ins that already exist keep counting on the turf map.
alter table players add column if not exists is_team boolean not null default false;
alter table checkins add column if not exists verified boolean not null default true;
alter table checkins alter column verified set default false;
`;

export async function migrate(db: Db) {
  await db.exec(schema);
  if (db.kind !== 'postgres') return;
  // On Tiger Data, store check-ins as a TimescaleDB hypertable (time-partitioned by check-in time).
  try {
    const { rows } = await db.query<{ ok: number }>(
      "select 1 as ok from pg_available_extensions where name = 'timescaledb'",
    );
    if (!rows.length) return;
    await db.exec('create extension if not exists timescaledb');
    await db.query("select create_hypertable('checkins', by_range('at'), if_not_exists => true, migrate_data => true)");
    console.log('[db] checkins is a TimescaleDB hypertable');
  } catch (e) {
    console.warn('[db] TimescaleDB setup skipped:', (e as Error).message);
  }
}
