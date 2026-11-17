import { describe, expect, it } from "vitest";
import { isUuid } from "./dashboard-rows";

describe("isUuid", () => {
  it("accepts a uuid and rejects anything else", () => {
    expect(isUuid("3b241101-e2bb-4255-8caf-4136c566a962")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("3b241101-e2bb-4255-8caf-4136c566a962; drop table")).toBe(false);
  });
});
