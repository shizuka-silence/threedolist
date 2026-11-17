// shortcut: in-memory, so it resets on restart and isn't shared across serverless instances; move to Postgres if it must be a hard cap.
const defaultHits = new Map<string, number[]>();

/** Sliding window: allows `max` calls per `windowMs` for each key. Blocked calls are not recorded. */
export function checkRateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
  now = Date.now(),
  hits = defaultHits,
): { ok: boolean; retryAfterSeconds: number } {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryAfterSeconds: Math.ceil((recent[0] + windowMs - now) / 1000) };
  }
  hits.set(key, [...recent, now]);
  return { ok: true, retryAfterSeconds: 0 };
}
