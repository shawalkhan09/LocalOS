type Bucket = { count: number; windowStart: number };

// In-memory sliding window. Callers namespace their own keys (e.g.
// "login:email:ip" vs "public-booking:ip") so different rate limits never
// collide in the same bucket. Resets on process restart and isn't shared
// across instances — an accepted gap for a single-instance deployment, not
// an oversight; a multi-instance deployment would need this backed by
// something shared (Redis, etc.).
const buckets = new Map<string, Bucket>();

export type RateLimitConfig = { maxAttempts: number; windowMs: number };

// Returns true once the caller has made more than maxAttempts calls within
// windowMs. Every call counts as an attempt, not just failures — for
// login, this is checked before verifying credentials, so it can't be used
// to distinguish "wrong password" from "no such user" through timing.
export function isRateLimited(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > config.windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > config.maxAttempts;
}

export const LOGIN_RATE_LIMIT: RateLimitConfig = { maxAttempts: 5, windowMs: 15 * 60 * 1000 };

// Looser than login: a legitimate customer might book for themselves and a
// couple of family members or friends in one sitting, so a tight cap would
// punish normal use. Still bounded, to blunt a script hammering the public
// booking form with fake bookings.
export const PUBLIC_BOOKING_RATE_LIMIT: RateLimitConfig = { maxAttempts: 10, windowMs: 15 * 60 * 1000 };
