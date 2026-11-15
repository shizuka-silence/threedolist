"use client";

import imageCompression from "browser-image-compression";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  addSubtask, addTaskProof, completeTask, deleteTask, runAiTaskPrep, startTaskTimer, stopTaskTimer, toggleSubtask,
  updateTaskEstimate,
} from "@/app/actions/tasks";
import { assignTaskToProject } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { calculateLoggedMinutes } from "@/lib/task-rules";

type Props = {
  id: string;
  title: string;
  completionType: "tick" | "proof";
  estimatedMinutes: number | null;
  actualMinutes: number;
  activeTimerStartedAt: string | null; // ISO
  proofCount: number;
  thumbnails: { id: string; url: string }[];
  aiClarifyingQuestions: string[] | null;
  subtasks: { id: string; label: string; isCompleted: boolean; source: "user" | "ai_pitfall" }[];
  projectId: string | null;
  projects: { id: string; name: string }[];
};

export function TaskCard({
  id, title, completionType, estimatedMinutes, actualMinutes, activeTimerStartedAt, proofCount, thumbnails,
  aiClarifyingQuestions, subtasks, projectId, projects,
}: Props) {
  const [note, setNote] = useState("");
  const [subtaskLabel, setSubtaskLabel] = useState("");
  const [aiParts, setAiParts] = useState({ estimate: false, questions: false, pitfalls: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null); // null until mounted, avoids a hydration mismatch
  const [stopping, setStopping] = useState(false);
  const [trim, setTrim] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const hovered = useRef(false);
  const card = useRef<HTMLDivElement>(null);
  const isProof = completionType === "proof";

  const startedAt = activeTimerStartedAt ? new Date(activeTimerStartedAt) : null;
  const elapsedMs = startedAt && now ? Math.max(0, now - startedAt.getTime()) : 0;
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  const clock = [Math.floor(elapsedMs / 3_600_000), Math.floor(elapsedMs / 60_000) % 60, Math.floor(elapsedMs / 1000) % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  const trimmed = Math.min(trim, elapsedMinutes);
  const netMinutes =
    startedAt && now ? calculateLoggedMinutes({ startedAt, endedAt: new Date(now), trimmedIdleMinutes: trimmed }) : 0;

  useEffect(() => {
    if (!activeTimerStartedAt) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimerStartedAt]);

  // Paste an image while hovering or focused inside this proof card.
  useEffect(() => {
    if (!isProof) return;
    function onPaste(event: ClipboardEvent) {
      if (!hovered.current && !card.current?.contains(document.activeElement)) return;
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (!file) return;
      event.preventDefault();
      uploadPhoto(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

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

  function addSubtaskSubmit(event: React.FormEvent) {
    event.preventDefault();
    run(() => addSubtask(id, subtaskLabel), () => setSubtaskLabel(""));
  }

  return (
    <div
      ref={card}
      className="flex flex-col gap-3 rounded-lg border p-3"
      onMouseEnter={() => (hovered.current = true)}
      onMouseLeave={() => (hovered.current = false)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">
            {isProof ? "Proof" : "Tick"}
            {` · Logged ${actualMinutes}m`}
            {isProof ? ` · ${proofCount} attached` : ""}
          </p>
          <label className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            Est
            <input
              // key remounts the field when the server value changes (e.g. after AI Prep fills it)
              key={estimatedMinutes ?? "none"}
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={estimatedMinutes ?? ""}
              placeholder="min"
              aria-label="Estimated minutes"
              onBlur={(e) => {
                const value = e.target.value === "" ? null : Number(e.target.value);
                if (value !== estimatedMinutes) run(() => updateTaskEstimate(id, value));
              }}
              className="h-8 w-16 rounded-md border bg-background px-2 text-base"
            />
            m
          </label>
        </div>
        {/* mr-8 leaves room for the desktop drag handle */}
        <Button className="md:mr-8" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => deleteTask(id))}>
          Delete
        </Button>
      </div>

      <select
        value={projectId ?? ""}
        disabled={pending}
        aria-label="Project folder"
        onChange={(e) => run(() => assignTaskToProject(id, e.target.value || null))}
        className="h-9 rounded-md border bg-background px-2 text-base"
      >
        <option value="">No project</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {!startedAt ? (
        <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => run(() => startTaskTimer(id))}>
          Start Timer
        </Button>
      ) : !stopping ? (
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-lg" aria-live="off">{clock}</span>
          <Button type="button" variant="outline" size="lg" onClick={() => { setTrim(0); setStopping(true); }}>
            Stop
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-md border p-2">
          <p className="text-sm">
            Elapsed {clock} · trim idle: <strong>{trimmed}m</strong> · will log <strong>{netMinutes}m</strong>
          </p>
          <input
            type="range"
            min={0}
            max={elapsedMinutes}
            value={trimmed}
            onChange={(e) => setTrim(Number(e.target.value))}
            aria-label="Idle minutes to trim"
          />
          <div className="flex flex-wrap gap-2">
            {[5, 15].map((m) => (
              <Button key={m} type="button" variant="outline" size="sm" onClick={() => setTrim(Math.min(elapsedMinutes, trimmed + m))}>
                -{m}m
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setStopping(false)}>Keep running</Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => run(() => stopTaskTimer(id, trimmed), () => setStopping(false))}
            >
              Confirm stop
            </Button>
          </div>
        </div>
      )}

      {isProof && (
        <div className="flex flex-col gap-2">
          {thumbnails.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {thumbnails.map((t) => (
                <a key={t.id} href={t.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                  <img src={t.url} alt="Proof" className="h-16 w-16 rounded-md border object-cover" />
                </a>
              ))}
            </div>
          )}
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
            Add photo (or Ctrl+V)
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

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {([["estimate", "Time estimate"], ["questions", "Questions"], ["pitfalls", "Pitfalls"]] as const).map(([part, label]) => (
            <label key={part} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={aiParts[part]}
                onChange={(e) => setAiParts({ ...aiParts, [part]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={pending || !(aiParts.estimate || aiParts.questions || aiParts.pitfalls)}
          onClick={() => run(() => runAiTaskPrep(id, aiParts), () => setAiParts({ estimate: false, questions: false, pitfalls: false }))}
        >
          {pending ? "Working…" : "AI Prep"}
        </Button>
        {aiClarifyingQuestions && aiClarifyingQuestions.length > 0 && (
          <ul className="list-disc pl-5 text-sm">
            {aiClarifyingQuestions.map((q) => <li key={q}>{q}</li>)}
          </ul>
        )}
        {subtasks.length > 0 && (
          <ul className="flex flex-col gap-1">
            {subtasks.map((s) => (
              <li key={s.id}>
                <label className={`flex items-center gap-2 text-sm ${s.source === "ai_pitfall" ? "italic text-muted-foreground" : ""}`}>
                  <input type="checkbox" checked={s.isCompleted} disabled={pending} onChange={() => run(() => toggleSubtask(s.id))} />
                  {s.source === "ai_pitfall" && <span aria-label="AI pitfall">⚠</span>}
                  {s.label}
                </label>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addSubtaskSubmit} className="flex gap-2">
          <input
            value={subtaskLabel}
            onChange={(e) => setSubtaskLabel(e.target.value)}
            placeholder="Add subtask"
            aria-label="Add subtask"
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-base"
          />
          <Button type="submit" variant="outline" disabled={pending}>Add</Button>
        </form>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Button
        size="lg"
        disabled={pending || (isProof && proofCount === 0)}
        onClick={() => run(() => completeTask(id))}
      >
        {isProof ? "Mark Complete" : "Done"}
      </Button>
    </div>
  );
}
