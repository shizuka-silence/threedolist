import { describe, expect, it } from "vitest";
import { isTriageRequestAuthorized } from "./triage-auth";

describe("isTriageRequestAuthorized (triage webhook bearer check)", () => {
  it("accepts a matching Bearer token", () => {
    expect(isTriageRequestAuthorized("Bearer s3cret", "s3cret")).toBe(true);
  });

  it("rejects a wrong token", () => {
    expect(isTriageRequestAuthorized("Bearer nope", "s3cret")).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isTriageRequestAuthorized(null, "s3cret")).toBe(false);
  });

  it("rejects a non-Bearer scheme", () => {
    expect(isTriageRequestAuthorized("Basic s3cret", "s3cret")).toBe(false);
  });

  it("rejects a token that only starts with the secret", () => {
    expect(isTriageRequestAuthorized("Bearer s3cret-extra", "s3cret")).toBe(false);
  });

  it("rejects everything when the secret is not configured", () => {
    expect(isTriageRequestAuthorized("Bearer ", undefined)).toBe(false);
    expect(isTriageRequestAuthorized("Bearer ", "")).toBe(false);
    expect(isTriageRequestAuthorized("Bearer anything", undefined)).toBe(false);
  });
});
