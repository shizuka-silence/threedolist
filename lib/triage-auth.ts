import { timingSafeEqual } from "node:crypto";

// Constant-time bearer check; an unset/empty secret rejects everything (fail closed).
export function isTriageRequestAuthorized(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !authHeader?.startsWith("Bearer ")) return false;
  const given = Buffer.from(authHeader.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
