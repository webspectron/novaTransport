import crypto from 'crypto';
import rateLimit, { type IncrementResponse, type Options, type Store } from 'express-rate-limit';
import { db } from '../db.js';

// Applied to the public write endpoints (quote submission, shipment booking, document
// auto-generation) — none of these need a session, so nothing else stops a script from
// hammering them to spam the quotes/shipments tables. Much higher ceiling than the login
// limiter (server/routes/auth.ts) since real customers legitimately submitting a quote or
// booking a shipment is the normal case here, not something to be suspicious of — this is
// about stopping bulk/scripted abuse, not slowing down a real customer.
export const publicWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again in a few minutes.' }
});

// Keeps a limiter's counts in SQLite (table rate_limit_hits, server/db.ts) instead of memory, so a
// restart or redeploy doesn't hand every IP a fresh allowance. Keys are an HMAC of the client key
// (the IP), so no IP address is stored.
class SqliteStore implements Store {
  localKeys = false;
  private windowMs = 60 * 1000;
  private lastPrune = 0;
  constructor(public prefix: string) {}

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  private key(clientKey: string): string {
    const secret = process.env.SESSION_SECRET || 'dev-only-insecure-fallback-secret';
    return `${this.prefix}:${crypto.createHmac('sha256', secret).update(clientKey).digest('hex')}`;
  }

  increment(clientKey: string): IncrementResponse {
    const now = Date.now();
    if (now - this.lastPrune > 60 * 1000) {
      this.lastPrune = now;
      db.prepare('DELETE FROM rate_limit_hits WHERE reset_at <= ?').run(now);
    }
    // One statement: start a new window if the old one has passed, otherwise count the hit.
    const row = db.prepare(`
      INSERT INTO rate_limit_hits (key, hits, reset_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
        hits = CASE WHEN reset_at <= ? THEN 1 ELSE hits + 1 END,
        reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
      RETURNING hits, reset_at
    `).get(this.key(clientKey), now + this.windowMs, now, now) as { hits: number; reset_at: number };
    return { totalHits: row.hits, resetTime: new Date(row.reset_at) };
  }

  get(clientKey: string) {
    const row = db.prepare('SELECT hits, reset_at FROM rate_limit_hits WHERE key = ? AND reset_at > ?')
      .get(this.key(clientKey), Date.now()) as { hits: number; reset_at: number } | undefined;
    return row ? { totalHits: row.hits, resetTime: new Date(row.reset_at) } : undefined;
  }

  decrement(clientKey: string) {
    db.prepare('UPDATE rate_limit_hits SET hits = MAX(hits - 1, 0) WHERE key = ?').run(this.key(clientKey));
  }

  resetKey(clientKey: string) {
    db.prepare('DELETE FROM rate_limit_hits WHERE key = ?').run(this.key(clientKey));
  }
}

// Proof-of-payment uploads from the track page (docs/update.md E.2). Each one carries an image
// and moves a payment into review, so the ceiling is much lower than publicWriteLimiter.
// Counted in SQLite so a restart doesn't reset it. The message is the one the customer sees (CONTENT.md §6.7).
export const paymentProofLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: new SqliteStore('payment-proof'),
  message: { success: false, code: 'RATE_LIMITED', error: 'Too many attempts. Please wait a while and try again.' }
});
