import { describe, expect, it } from "vitest";
import { paginate } from "./pagination";

const nums = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("paginate", () => {
  it("returns the first page", () => {
    expect(paginate(nums(25), 1, 10)).toEqual({ items: nums(10), page: 1, pageCount: 3 });
  });

  it("returns a middle page", () => {
    expect(paginate(nums(25), 2, 10).items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it("returns a shorter last page", () => {
    expect(paginate(nums(25), 3, 10)).toEqual({ items: [21, 22, 23, 24, 25], page: 3, pageCount: 3 });
  });

  it("clamps a page past the end (e.g. after completing the last task on it)", () => {
    expect(paginate(nums(25), 9, 10).page).toBe(3);
  });

  it("clamps page 0 and negatives to the first page", () => {
    expect(paginate(nums(25), 0, 10).page).toBe(1);
    expect(paginate(nums(25), -4, 10).page).toBe(1);
  });

  it("gives one empty page for an empty list", () => {
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, pageCount: 1 });
  });

  it("does not add a blank page when the count is an exact multiple", () => {
    expect(paginate(nums(20), 2, 10).pageCount).toBe(2);
  });

  it("defaults to 10 per page", () => {
    expect(paginate(nums(11), 1).items).toHaveLength(10);
  });
});
