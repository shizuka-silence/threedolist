import { describe, expect, it } from "vitest";
import { classifyProjectReference, filterTasksByProject, validateProjectInput } from "./project-rules";

describe("validateProjectInput", () => {
  it("trims the project name", () => {
    expect(validateProjectInput("  Taxes  ", "#112233").name).toBe("Taxes");
  });

  it("throws on an empty name", () => {
    expect(() => validateProjectInput("")).toThrow();
  });

  it("throws on a whitespace-only name", () => {
    expect(() => validateProjectInput("   \t ")).toThrow();
  });

  it("keeps a valid hex color", () => {
    expect(validateProjectInput("A", "#ff0000").color).toBe("#ff0000");
  });

  it("falls back to a default hex color when omitted", () => {
    expect(validateProjectInput("A").color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("falls back to the same default when color is blank or not a hex color", () => {
    const fallback = validateProjectInput("A").color;
    expect(validateProjectInput("A", "").color).toBe(fallback);
    expect(validateProjectInput("A", "red").color).toBe(fallback);
  });
});

describe("classifyProjectReference", () => {
  it("classifies an https URL as a link and trims it", () => {
    expect(classifyProjectReference({ url: "  https://example.com/doc  " })).toEqual({
      kind: "link",
      url: "https://example.com/doc",
    });
  });

  it("accepts http URLs", () => {
    expect(classifyProjectReference({ url: "http://example.com" }).kind).toBe("link");
  });

  it("rejects non-http(s) URLs", () => {
    expect(() => classifyProjectReference({ url: "javascript:alert(1)" })).toThrow();
    expect(() => classifyProjectReference({ url: "ftp://example.com/x" })).toThrow();
    expect(() => classifyProjectReference({ url: "not a url" })).toThrow();
  });

  it("classifies an uploaded file by trimmed file name", () => {
    expect(classifyProjectReference({ fileName: "  spec.pdf " })).toEqual({
      kind: "file",
      fileName: "spec.pdf",
    });
  });

  it("throws when neither a file name nor a URL is given", () => {
    expect(() => classifyProjectReference({})).toThrow();
    expect(() => classifyProjectReference({ fileName: " ", url: " " })).toThrow();
  });
});

describe("filterTasksByProject", () => {
  const tasks = [
    { id: 1, projectId: "a" },
    { id: 2, projectId: "b" },
    { id: 3, projectId: null },
    { id: 4, projectId: "a" },
  ];

  it("returns every task for 'all'", () => {
    expect(filterTasksByProject(tasks, "all")).toEqual(tasks);
  });

  it("returns only tasks without a project for 'unassigned'", () => {
    expect(filterTasksByProject(tasks, "unassigned").map((t) => t.id)).toEqual([3]);
  });

  it("returns only tasks in the selected project", () => {
    expect(filterTasksByProject(tasks, "a").map((t) => t.id)).toEqual([1, 4]);
  });

  it("returns an empty list for a project with no tasks", () => {
    expect(filterTasksByProject(tasks, "zzz")).toEqual([]);
  });
});
