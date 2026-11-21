import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Load server/.env if present (Node 20.12+ has a built-in loader).
if (existsSync('.env')) process.loadEnvFile('.env');

export const env = {
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: process.env.DATABASE_URL?.trim() || undefined,
  geminiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-flash-lite-latest',
  allowDemo: (process.env.ALLOW_DEMO ?? 'true').toLowerCase() !== 'false',
  webDist: process.env.WEB_DIST ?? '../web/dist',
  /** Embedded dev database location (used only when DATABASE_URL is empty). */
  pgliteDir: process.env.PGLITE_DIR?.trim() || join(homedir(), '.out-of-bounds', 'pglite'),
};
