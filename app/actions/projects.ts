"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectFiles, projects, tasks } from "@/db/schema";
import { isUuid, toClientProjectFile } from "@/lib/dashboard-rows";
import type { OptimisticProject, OptimisticProjectFile } from "@/lib/optimistic-rules";
import { classifyProjectReference, isProjectLink as isLink, validateProjectInput } from "@/lib/project-rules";
import { createClient } from "@/lib/supabase/server";

// Drizzle bypasses RLS, so every action below must call requireUser() and filter by user.id.

type Result = { error?: string };

const BUCKET = "proof-uploads";

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims(); // verifies the JWT locally (no Auth server round trip) when the project uses asymmetric signing keys
  const user = data?.claims ? { id: data.claims.sub, email: data.claims.email } : null;
  return { supabase, user };
}

async function findOwnedProject(userId: string, projectId: string) {
  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  return project;
}

export async function createProject(name: string, color?: string, id?: string): Promise<Result & { project?: OptimisticProject }> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (id && !isUuid(id)) return { error: "Invalid id." };
  try {
    const [project] = await db
      .insert(projects)
      .values({ id, userId: user.id, ...validateProjectInput(name, color) })
      .returning({ id: projects.id, name: projects.name, color: projects.color });
    return { project };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteProject(projectId: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (!(await findOwnedProject(user.id, projectId))) return { error: "Project not found." };

  const files = await db.select().from(projectFiles).where(eq(projectFiles.projectId, projectId));
  const paths = files.filter((f) => !isLink(f.fileUrl)).map((f) => f.fileUrl);
  if (paths.length > 0) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) return { error: `Could not remove files: ${error.message}` };
  }
  // Tasks are also unset by the FK (on delete set null); done explicitly so it doesn't depend on that.
  await db.update(tasks).set({ projectId: null }).where(and(eq(tasks.projectId, projectId), eq(tasks.userId, user.id)));
  await db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.userId, user.id))); // files cascade
  return {};
}

export async function updateProjectColor(projectId: string, color: string): Promise<Result> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: "Invalid color." };
  const updated = await db
    .update(projects)
    .set({ color })
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .returning({ id: projects.id });
  if (updated.length === 0) return { error: "Project not found." };
  return {};
}

export async function assignTaskToProject(taskId: string, projectId: string | null): Promise<Result> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (projectId && !(await findOwnedProject(user.id, projectId))) return { error: "Project not found." };

  const updated = await db
    .update(tasks)
    .set({ projectId })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
    .returning({ id: tasks.id });
  if (updated.length === 0) return { error: "Task not found." };
  return {};
}

// FormData field: file
export async function uploadProjectFile(projectId: string, formData: FormData): Promise<Result & { file?: OptimisticProjectFile }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (!(await findOwnedProject(user.id, projectId))) return { error: "Project not found." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first." };
  let fileName: string;
  try {
    const ref = classifyProjectReference({ fileName: file.name });
    if (ref.kind !== "file") throw new Error("Choose a file first.");
    fileName = ref.fileName;
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Random object name: the original name may contain characters Storage rejects. It is kept in file_name.
  const path = `${user.id}/projects/${projectId}/${crypto.randomUUID()}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (error) return { error: `Upload failed: ${error.message}` };

  const [row] = await db.insert(projectFiles).values({ projectId, fileName, fileUrl: path }).returning();
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return { file: toClientProjectFile(row, signed?.signedUrl ?? null) };
}

export async function addProjectLink(projectId: string, title: string, url: string, id?: string): Promise<Result & { file?: OptimisticProjectFile }> {
  const { user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (!(await findOwnedProject(user.id, projectId))) return { error: "Project not found." };
  if (id && !isUuid(id)) return { error: "Invalid id." };

  try {
    const ref = classifyProjectReference({ url });
    if (ref.kind !== "link") throw new Error("Add a link.");
    const [row] = await db
      .insert(projectFiles)
      .values({ id, projectId, fileName: title.trim() || ref.url, fileUrl: ref.url })
      .returning();
    return { file: toClientProjectFile(row, null) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteProjectFile(fileId: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in." };

  const [file] = await db
    .select({ id: projectFiles.id, fileUrl: projectFiles.fileUrl })
    .from(projectFiles)
    .innerJoin(projects, eq(projects.id, projectFiles.projectId))
    .where(and(eq(projectFiles.id, fileId), eq(projects.userId, user.id)));
  if (!file) return { error: "File not found." };

  if (!isLink(file.fileUrl)) {
    const { error } = await supabase.storage.from(BUCKET).remove([file.fileUrl]);
    if (error) return { error: `Could not remove file: ${error.message}` };
  }
  await db.delete(projectFiles).where(eq(projectFiles.id, fileId));
  return {};
}
