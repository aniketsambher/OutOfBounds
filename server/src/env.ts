import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Load server/.env if present (Node 20.12+ has a built-in loader).
if (existsSync('.env')) process.loadEnvFile('.env');

const flag = (value: string | undefined, fallback: boolean) =>
  value === undefined || value.trim() === '' ? fallback : value.trim().toLowerCase() === 'true';

export const env = {
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: process.env.DATABASE_URL?.trim() || undefined,
  geminiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-flash-lite-latest',
  /** Most Gemini calls (photo checks + quest tips) the server makes per day, so a busy day can't drain the key. */
  geminiDailyLimit: Number(process.env.GEMINI_DAILY_LIMIT) || 300,
  /**
   * Gives EVERY player team powers (check in anywhere on the shared map, simulate rivals, reset turf).
   * Only for local development or a private stage server. Off by default.
   */
  allowDemo: flag(process.env.ALLOW_DEMO, false),
  /** Secret password that turns an account into a team account. Set it in the host's settings, never in git. */
  teamKey: process.env.TEAM_KEY?.trim() || undefined,
  /**
   * Lets everyone else check in without GPS. Those check-ins only show up for the player who made them
   * and never change the shared turf map. On by default.
   */
  visitorMode: flag(process.env.VISITOR_MODE, true),
  webDist: process.env.WEB_DIST ?? '../web/dist',
  /** Embedded dev database location (used only when DATABASE_URL is empty). */
  pgliteDir: process.env.PGLITE_DIR?.trim() || join(homedir(), '.out-of-bounds', 'pglite'),
};
