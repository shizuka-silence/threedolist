import { describe, expect, it } from "vitest";
import { validateNewPassword } from "./auth-rules";

describe("validateNewPassword", () => {
  it("accepts matching passwords of 6+ characters", () => {
    expect(validateNewPassword("hunter22", "hunter22")).toBeNull();
    expect(validateNewPassword("abcdef", "abcdef")).toBeNull();
  });

  it("rejects passwords shorter than 6 characters", () => {
    expect(validateNewPassword("abcde", "abcde")).toMatch(/at least 6/i);
  });

  it("rejects an empty password", () => {
    expect(validateNewPassword("", "")).toMatch(/at least 6/i);
  });

  it("rejects when the confirmation does not match", () => {
    expect(validateNewPassword("hunter22", "hunter23")).toMatch(/match/i);
  });

  it("does not trim: a password of spaces counts by length", () => {
    expect(validateNewPassword("      ", "      ")).toBeNull();
  });
});
