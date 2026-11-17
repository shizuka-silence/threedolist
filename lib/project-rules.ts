export const DEFAULT_PROJECT_COLOR = "#6366f1";

export function validateProjectInput(name: string, color?: string): { name: string; color: string } {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Give the project a name.");
  const valid = color !== undefined && /^#[0-9a-fA-F]{6}$/.test(color.trim());
  return { name: trimmed, color: valid ? color.trim() : DEFAULT_PROJECT_COLOR };
}

export function classifyProjectReference(
  input: { fileName?: string; url?: string },
): { kind: "link"; url: string } | { kind: "file"; fileName: string } {
  const url = input.url?.trim();
  if (url) {
    if (!/^https?:\/\/\S+$/i.test(url)) throw new Error("Links must start with http:// or https://.");
    return { kind: "link", url };
  }
  const fileName = input.fileName?.trim();
  if (fileName) return { kind: "file", fileName };
  throw new Error("Add a file or a link.");
}

// project_files.file_url holds either an http(s) link or a Storage path (which starts with the user id).
export const isProjectLink = (fileUrl: string) => /^https?:\/\//i.test(fileUrl);

export function filterTasksByProject<T extends { projectId: string | null }>(
  tasks: T[],
  selectedProjectId: string | "all" | "unassigned",
): T[] {
  if (selectedProjectId === "all") return tasks;
  if (selectedProjectId === "unassigned") return tasks.filter((t) => t.projectId === null);
  return tasks.filter((t) => t.projectId === selectedProjectId);
}

/** Move `fromId` to where `toId` is (array-move). Unknown ids or a drop on itself return the order unchanged. */
export function moveProject(ids: string[], fromId: string, toId: string): string[] {
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from === -1 || to === -1 || from === to) return ids;
  const next = ids.filter((id) => id !== fromId);
  next.splice(to, 0, fromId);
  return next;
}
