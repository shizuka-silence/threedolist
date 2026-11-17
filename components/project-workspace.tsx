"use client";

import { useRef, useState } from "react";
import { addProjectLink, updateProjectColor, deleteProject, deleteProjectFile, renameProject, uploadProjectFile } from "@/app/actions/projects";
import { useDashboard } from "@/components/dashboard-provider";
import { Button } from "@/components/ui/button";
import type { OptimisticProjectFile } from "@/lib/optimistic-rules";
import { classifyProjectReference } from "@/lib/project-rules";

export function ProjectWorkspace({ projectId, name, color }: { projectId: string; name: string; color: string }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false); // uploads and link adds wait for the server, which returns the new row
  const { state, run } = useDashboard();
  const files = state.projectFiles.filter((f) => f.projectId === projectId);
  const fileInput = useRef<HTMLInputElement>(null);

  async function save(action: () => Promise<{ error?: string; file?: OptimisticProjectFile }>) {
    setBusy(true);
    const result = await run(null, action, (r) => (r.file ? [{ type: "file/upsert", file: r.file }] : []));
    setBusy(false);
    return result;
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            type="color"
            value={color}
            aria-label="Project color"
            onChange={(e) =>
              run({ type: "project/upsert", project: { id: projectId, name, color: e.target.value } }, () =>
                updateProjectColor(projectId, e.target.value),
              )
            }
            className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
          />
          <input
            key={name} // remounts when the saved name changes
            defaultValue={name}
            aria-label="Project name"
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (!next) { e.target.value = name; return; } // a project can't be nameless
              if (next !== name) run({ type: "project/upsert", project: { id: projectId, name: next, color } }, () => renameProject(projectId, next));
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="h-9 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-lg font-medium hover:border-input focus:border-input"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm(`Delete "${name}"? Its tasks are kept and become unassigned; its files are removed.`)) {
              run({ type: "project/remove", id: projectId }, () => deleteProject(projectId));
            }
          }}
        >
          Delete project
        </Button>
      </div>

      <h3 className="text-sm font-medium text-muted-foreground">Reference Files &amp; Links</h3>
      <ul className="flex flex-col gap-1">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
            {f.href ? (
              <a href={f.href} target="_blank" rel="noreferrer" className="min-w-0 truncate underline">
                {f.isLink ? "🔗" : "📄"} {f.fileName}
              </a>
            ) : (
              <span className="min-w-0 truncate text-muted-foreground">{f.fileName} (unavailable)</span>
            )}
            <Button variant="ghost" size="sm" onClick={() => run({ type: "file/remove", id: f.id }, () => deleteProjectFile(f.id))}>
              Delete
            </Button>
          </li>
        ))}
        {files.length === 0 && <li className="text-sm text-muted-foreground">No reference files or links yet.</li>}
      </ul>

      <input
        ref={fileInput}
        type="file"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const formData = new FormData();
            formData.set("file", file);
            save(() => uploadProjectFile(projectId, formData));
          }
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => fileInput.current?.click()}>
        {busy ? "Saving…" : "Upload file"}
      </Button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          let ref;
          try {
            ref = classifyProjectReference({ url }); // same check the server makes
          } catch (err) {
            run(null, async () => ({ error: (err as Error).message }));
            return;
          }
          if (ref.kind !== "link") return;
          const file = { id: crypto.randomUUID(), projectId, fileName: title.trim() || ref.url, href: ref.url, isLink: true };
          const saved = { title, url };
          setTitle("");
          setUrl("");
          run({ type: "file/upsert", file }, async () => {
            const result = await addProjectLink(projectId, saved.title, saved.url, file.id);
            if (result.error) {
              setTitle((t) => t || saved.title);
              setUrl((u) => u || saved.url);
            }
            return result;
          });
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          aria-label="Link title"
          className="h-9 min-w-0 flex-1 basis-32 rounded-md border bg-background px-3 text-base"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          aria-label="Link URL"
          className="h-9 min-w-0 flex-[2] basis-40 rounded-md border bg-background px-3 text-base"
        />
        <Button type="submit" variant="outline" disabled={busy}>Add link</Button>
      </form>
    </section>
  );
}
