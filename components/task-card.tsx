"use client";

import imageCompression from "browser-image-compression";
import { useEffect, useRef, useState } from "react";
import {
  addSubtask, addTaskProof, completeTask, deleteTask, runAiTaskPrep, startTaskTimer, stopTaskTimer, toggleSubtask,
  updateTaskEstimate, updateTaskSchedule,
} from "@/app/actions/tasks";
import { assignTaskToProject } from "@/app/actions/projects";
import { useDashboard } from "@/components/dashboard-provider";
import { Button } from "@/components/ui/button";
import type { TaskSchedule } from "@/lib/optimistic-rules";
import { calculateLoggedMinutes } from "@/lib/task-rules";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = TaskSchedule & {
  id: string;
  title: string;
  status: "todo" | "scheduled" | "completed";
  completionType: "tick" | "proof";
  estimatedMinutes: number | null;
  actualMinutes: number;
  activeTimerStartedAt: string | null; // ISO
  proofCount: number;
  thumbnails: { id: string; url: string }[];
  aiClarifyingQuestions: string[] | null;
  subtasks: { id: string; label: string; isCompleted: boolean; source: "user" | "ai_pitfall" }[];
  projectId: string | null;
  projects: { id: string; name: string; color: string }[];
  active?: boolean; // last-touched card: highlighted so it is clear where Ctrl+V / keyboard input goes
  onActivate?: () => void;
  hideProject?: boolean; // inside a project folder the project tag is redundant
};

export function TaskCard({
  id, title, completionType, estimatedMinutes, actualMinutes, activeTimerStartedAt, proofCount, thumbnails,
  aiClarifyingQuestions, subtasks, projectId, projects, deadline, repeatEvery, repeatWeekdays, repeatUnit, repeatUntil, hideProject, active, onActivate,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [subtaskLabel, setSubtaskLabel] = useState("");
  const [aiParts, setAiParts] = useState({ estimate: false, questions: false, pitfalls: false });
  // Instant actions change dashboard state at once; uploads and AI wait for the server, so they show a busy state.
  const [uploading, setUploading] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const { run } = useDashboard();
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

  async function uploadPhoto(file: File) {
    setUploading(true);
    await run(
      null,
      async () => {
        const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
        const formData = new FormData();
        formData.set("taskId", id);
        formData.set("type", "image");
        formData.set("file", compressed, file.name);
        return addTaskProof(formData);
      },
      (result) => [{ type: "task/addProof", id, thumbnail: result.thumbnail }],
    );
    setUploading(false);
  }

  function addNote(event: React.FormEvent) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("taskId", id);
    formData.set("type", "text");
    formData.set("text", note);
    const saved = note;
    setNote("");
    run({ type: "task/addProof", id }, async () => {
      const result = await addTaskProof(formData);
      if (result.error) setNote((current) => current || saved);
      return result;
    });
  }

  function addSubtaskSubmit(event: React.FormEvent) {
    event.preventDefault();
    const label = subtaskLabel.trim();
    if (!label) return;
    setSubtaskLabel("");
    const subtask = { id: crypto.randomUUID(), label, isCompleted: false, source: "user" as const };
    run({ type: "task/addSubtask", taskId: id, subtask }, async () => {
      const result = await addSubtask(id, label, subtask.id);
      if (result.error) setSubtaskLabel((current) => current || label); // don't lose the text on failure
      return result;
    });
  }

  async function runAiPrep() {
    setAiRunning(true);
    const result = await run(null, () => runAiTaskPrep(id, aiParts), (r) =>
      r.prep ? [{ type: "task/setPrep", id, ...r.prep }] : [],
    );
    setAiRunning(false);
    if (!result.error) setAiParts({ estimate: false, questions: false, pitfalls: false });
  }

  const scheduleChange = (patch: Partial<TaskSchedule>) => {
    const schedule: TaskSchedule = { deadline, repeatEvery, repeatWeekdays, repeatUnit, repeatUntil, ...patch };
    run({ type: "task/setSchedule", id, schedule }, () => updateTaskSchedule(id, schedule));
  };
  const toIso = (date: string) => (date ? `${date}T00:00:00.000Z` : null);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = deadline !== null && deadline.slice(0, 10) < today;
  const project = projects.find((p) => p.id === projectId);
  const completeNow = () =>
    run({ type: "task/complete", id, at: new Date().toISOString() }, () => completeTask(id), (r) =>
      r.nextTask ? [{ type: "task/upsert", task: r.nextTask }] : [],
    );
  const fieldClass = "h-9 rounded-md border bg-background px-2 text-base";

  return (
    <div
      ref={card}
      className={`flex flex-col gap-3 rounded-lg border p-3 ${active ? "ring-2 ring-primary bg-primary/5" : ""}`}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
      onMouseEnter={() => (hovered.current = true)}
      onMouseLeave={() => (hovered.current = false)}
    >
      <div className="flex items-center gap-2">
        {/* Proof tasks can't be ticked without proof, so the tick opens the card to show where to add it. */}
        <button
          type="button"
          aria-label={isProof && proofCount === 0 ? "Open to add proof" : "Mark complete"}
          onClick={() => (isProof && proofCount === 0 ? setExpanded(true) : completeNow())}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-base hover:bg-primary hover:text-primary-foreground"
        >
          ✓
        </button>
        <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="min-w-0 flex-1 text-left">
          <p className="break-words font-medium">{title}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            {project && !hideProject && (
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
                {project.name}
              </span>
            )}
            {deadline && <span className={overdue ? "font-medium text-red-600" : ""}>Due {deadline.slice(0, 10)}</span>}
            {repeatWeekdays?.length ? (
              <span>↻ {repeatWeekdays.map((n) => DAY_NAMES[n]).join(", ")}</span>
            ) : repeatEvery ? (
              <span>↻ {repeatEvery} {repeatUnit}</span>
            ) : null}
            {isProof && <span>{proofCount} attached</span>}
          </p>
        </button>
        <label className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
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
              if (value !== estimatedMinutes) run({ type: "task/setEstimate", id, minutes: value }, () => updateTaskEstimate(id, value));
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="h-8 w-16 rounded-md border bg-background px-2 text-base"
          />
          m
        </label>
        {/* mr-8 leaves room for the desktop drag handle */}
        <button type="button" aria-label={expanded ? "Collapse" : "Expand"} onClick={() => setExpanded(!expanded)} className="px-1 md:mr-8">
          {expanded ? "▴" : "▾"}
        </button>
      </div>

      {expanded && (
        <>
          {/* 1. Where it lives and when it's due */}
          <div className="flex flex-col gap-2">
            <select
              value={projectId ?? ""}
              aria-label="Project folder"
              onChange={(e) => {
                const next = e.target.value || null;
                run({ type: "task/assign", id, projectId: next }, () => assignTaskToProject(id, next));
              }}
              className={fieldClass}
            >
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm">
              Deadline
              <input
                type="date"
                value={deadline?.slice(0, 10) ?? ""}
                onChange={(e) => scheduleChange({ deadline: toIso(e.target.value) })}
                className={fieldClass}
              />
            </label>
            <div className="flex flex-wrap items-center gap-1 text-sm">
              On
              {DAY_NAMES.map((name, n) => {
                const on = repeatWeekdays?.includes(n) ?? false;
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={on}
                    aria-label={name}
                    onClick={() => {
                      const next = on ? (repeatWeekdays ?? []).filter((d) => d !== n) : [...(repeatWeekdays ?? []), n].sort();
                      scheduleChange({ repeatWeekdays: next.length ? next : null, repeatEvery: null });
                    }}
                    className={`h-8 w-8 rounded-full border text-xs ${on ? "bg-primary text-primary-foreground" : ""}`}
                  >
                    {name[0]}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {repeatWeekdays?.length ? "Or every" : "Or repeat every"}
              <input
                key={repeatEvery ?? "none"}
                type="number"
                min={1}
                defaultValue={repeatEvery ?? ""}
                placeholder="–"
                aria-label="Repeat interval"
                onBlur={(e) => {
                  const every = e.target.value === "" ? null : Number(e.target.value);
                  if (every !== repeatEvery) scheduleChange({ repeatEvery: every, repeatUnit: repeatUnit ?? "week", repeatWeekdays: null });
                }}
                className="h-9 w-16 rounded-md border bg-background px-2 text-base"
              />
              <select
                value={repeatUnit ?? "week"}
                aria-label="Repeat unit"
                onChange={(e) => scheduleChange({ repeatUnit: e.target.value as "day" | "week" | "month" })}
                className={fieldClass}
              >
                <option value="day">days</option>
                <option value="week">weeks</option>
                <option value="month">months</option>
              </select>
              {(repeatEvery || repeatWeekdays?.length) && (
                <label className="flex items-center gap-2">
                  until
                  <input
                    type="date"
                    value={repeatUntil?.slice(0, 10) ?? ""}
                    onChange={(e) => scheduleChange({ repeatUntil: toIso(e.target.value) })}
                    className={fieldClass}
                  />
                </label>
              )}
            </div>
          </div>

          {/* 2. Subtasks and notes */}
          <div className="flex flex-col gap-2 border-t pt-3">
            {subtasks.length > 0 && (
              <ul className="flex flex-col gap-1">
                {subtasks.map((s) => (
                  <li key={s.id}>
                    <label className={`flex items-center gap-2 text-sm ${s.source === "ai_pitfall" ? "italic text-muted-foreground" : ""}`}>
                      <input type="checkbox" checked={s.isCompleted} onChange={() => run({ type: "task/toggleSubtask", taskId: id, subtaskId: s.id }, () => toggleSubtask(s.id))} />
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
              <Button type="submit" variant="outline">Add</Button>
            </form>
            {isProof && (
              <form onSubmit={addNote} className="flex gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note or link"
                  aria-label="Proof note or link"
                  className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-base"
                />
                <Button type="submit" variant="outline">Add</Button>
              </form>
            )}
          </div>

          {/* 3. AI Prep */}
          <div className="flex flex-col gap-2 border-t pt-3">
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
              disabled={aiRunning || !(aiParts.estimate || aiParts.questions || aiParts.pitfalls)}
              onClick={runAiPrep}
            >
              {aiRunning ? "AI is thinking…" : "AI Prep"}
            </Button>
            {aiClarifyingQuestions && aiClarifyingQuestions.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {aiClarifyingQuestions.map((q) => <li key={q}>{q}</li>)}
              </ul>
            )}
          </div>

          {/* 4. Timer */}
          <div className="border-t pt-3">
            {!startedAt ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => run({ type: "task/startTimer", id, at: new Date().toISOString() }, () => startTaskTimer(id))}
              >
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
                    onClick={() => {
                      setStopping(false);
                      run({ type: "task/stopTimer", id, minutes: netMinutes }, () => stopTaskTimer(id, trimmed));
                    }}
                  >
                    Confirm stop
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 5. Photo proof */}
          {isProof && (
            <div className="flex flex-col gap-2 border-t pt-3">
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
              <Button type="button" variant="outline" size="lg" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? "Uploading photo…" : "Add photo (or Ctrl+V)"}
              </Button>
            </div>
          )}

          {/* 6. Finish */}
          <div className="flex flex-col gap-2 border-t pt-3">
            <Button
              size="lg"
              disabled={isProof && proofCount === 0}
              // Leaves the list at once; if the server refuses (e.g. no proof), it comes back with the error banner.
              onClick={completeNow}
            >
              {isProof ? "Mark Complete" : "Done"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => run({ type: "task/remove", id }, () => deleteTask(id))}>
              Delete task
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
