"use client";

import imageCompression from "browser-image-compression";
import { useRef, useState, useTransition } from "react";
import { addTaskProof, completeTask, deleteTask } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";

type Props = {
  id: string;
  title: string;
  completionType: "tick" | "proof";
  estimatedMinutes: number | null;
  proofCount: number;
};

export function TaskCard({ id, title, completionType, estimatedMinutes, proofCount }: Props) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const isProof = completionType === "proof";

  function run(action: () => Promise<{ error?: string }>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      setError(result.error ?? null);
      if (!result.error) onSuccess?.();
    });
  }

  function uploadPhoto(file: File) {
    run(async () => {
      const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
      const formData = new FormData();
      formData.set("taskId", id);
      formData.set("type", "image");
      formData.set("file", compressed, file.name);
      return addTaskProof(formData);
    });
  }

  function addNote(event: React.FormEvent) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("taskId", id);
    formData.set("type", "text");
    formData.set("text", note);
    run(() => addTaskProof(formData), () => setNote(""));
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">
            {isProof ? "Proof" : "Tick"}
            {estimatedMinutes ? ` · Est ${estimatedMinutes}m` : ""}
            {isProof ? ` · ${proofCount} attached` : ""}
          </p>
        </div>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => deleteTask(id))}>
          Delete
        </Button>
      </div>

      {isProof && (
        <div className="flex flex-col gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadPhoto(file);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => fileInput.current?.click()}>
            Add photo
          </Button>
          <form onSubmit={addNote} className="flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note or link"
              aria-label="Proof note or link"
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-base"
            />
            <Button type="submit" variant="outline" size="lg" disabled={pending}>Add</Button>
          </form>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Button
        size="lg"
        disabled={pending || (isProof && proofCount === 0)}
        onClick={() => run(() => completeTask(id))}
      >
        {isProof ? "Mark Complete" : "Done"}
      </Button>
    </li>
  );
}
