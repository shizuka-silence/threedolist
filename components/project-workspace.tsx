"use client";

import { useRef, useState, useTransition } from "react";
import { addProjectLink, deleteProject, deleteProjectFile, uploadProjectFile } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";

type Props = {
  projectId: string;
  name: string;
  // href is a signed URL for Storage files, or the link itself
  files: { id: string; fileName: string; href: string | null; isLink: boolean }[];
};

export function ProjectWorkspace({ projectId, name, files }: Props) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function run(action: () => Promise<{ error?: string }>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      setError(result.error ?? null);
      if (!result.error) onSuccess?.();
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium">Reference Files &amp; Links · {name}</h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (confirm(`Delete "${name}"? Its tasks are kept and become unassigned; its files are removed.`)) {
              run(() => deleteProject(projectId));
            }
          }}
        >
          Delete project
        </Button>
      </div>

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
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => deleteProjectFile(f.id))}>
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
            run(() => uploadProjectFile(projectId, formData));
          }
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => fileInput.current?.click()}>
        Upload file
      </Button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addProjectLink(projectId, title, url), () => { setTitle(""); setUrl(""); });
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
        <Button type="submit" variant="outline" disabled={pending}>Add link</Button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
