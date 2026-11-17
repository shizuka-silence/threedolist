import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rate-limit";

const opts = { max: 3, windowMs: 60_000 };

describe("checkRateLimit", () => {
  it("allows up to max calls inside the window", () => {
    const hits = new Map<string, number[]>();
    for (let i = 0; i < 3; i++) expect(checkRateLimit("u1", opts, 1_000 + i, hits).ok).toBe(true);
  });

  it("blocks the call after max and reports seconds until a slot frees up", () => {
    const hits = new Map<string, number[]>();
    for (let i = 0; i < 3; i++) checkRateLimit("u1", opts, 1_000, hits);
    const result = checkRateLimit("u1", opts, 11_000, hits);
    expect(result.ok).toBe(false);
    expect(result.retryAfterSeconds).toBe(50);
  });

  it("allows again once the oldest call leaves the window", () => {
    const hits = new Map<string, number[]>();
    for (let i = 0; i < 3; i++) checkRateLimit("u1", opts, 1_000, hits);
    expect(checkRateLimit("u1", opts, 61_000, hits).ok).toBe(true);
  });

  it("does not count blocked calls against the user", () => {
    const hits = new Map<string, number[]>();
    for (let i = 0; i < 3; i++) checkRateLimit("u1", opts, 1_000, hits);
    checkRateLimit("u1", opts, 2_000, hits); // blocked
    expect(checkRateLimit("u1", opts, 61_000, hits).ok).toBe(true);
  });

  it("tracks each key separately", () => {
    const hits = new Map<string, number[]>();
    for (let i = 0; i < 3; i++) checkRateLimit("u1", opts, 1_000, hits);
    expect(checkRateLimit("u2", opts, 1_000, hits).ok).toBe(true);
  });
});
