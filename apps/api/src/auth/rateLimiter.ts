type Bucket = { count: number; windowStart: number };

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// In-memory sliding window, keyed by caller (e.g. "email:ip"). Resets on
// process restart and isn't shared across instances — an accepted gap for
// a single-instance deployment, not an oversight; a multi-instance
// deployment would need this backed by something shared (Redis, etc.).
const buckets = new Map<string, Bucket>();

// Returns true once the caller has made more than MAX_ATTEMPTS calls within
// the current window. Every call counts as an attempt, not just failures —
// checked before verifying credentials, so it can't be used to distinguish
// "wrong password" from "no such user" through timing either.
export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_ATTEMPTS;
}
