import { createHash, timingSafeEqual } from 'node:crypto';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';
import { env } from './env';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-memory rate limit: true while `key` has made fewer than `max` calls in the current window.
 * Best effort (one server instance, resets on restart), enough to stop floods and password guessing.
 */
export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

/** The visitor's IP address (behind Render's proxy it arrives in a header). */
export function clientIp(c: Context): string {
  const forwarded = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Compares a typed team password with TEAM_KEY without leaking how many characters matched. */
export function teamKeyMatches(key: string): boolean {
  return Boolean(env.teamKey) && timingSafeEqual(digest(key), digest(env.teamKey!));
}
