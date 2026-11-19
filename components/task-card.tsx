"use client";

import imageCompression from "browser-image-compression";
import { useEffect, useRef, useState } from "react";
import {
  addSubtask, addTaskProof, completeTask, deleteTask, removeSubtask, removeTaskProof, runAiTaskPrep, startTaskTimer, stopTaskTimer, toggleSubtask,
  logTaskMinutes, updateTaskEstimate, updateTaskSchedule, updateTaskTitle,
} from "@/app/actions/tasks";
import { assignTaskToProject } from "@/app/actions/projects";
import { useDashboard } from "@/components/dashboard-provider";
import { Button } from "@/components/ui/button";
import { formatDeadline, fromDatetimeLocal, isOverdue, toDatetimeLocal } from "@/lib/deadline";
import type { TaskSchedule, TextProof } from "@/lib/optimistic-rules";
import { calculateLoggedMinutes } from "@/lib/task-rules";

// Elements that keep their own double-click behavior instead of toggling the card.
const CONTROLS = "input, button, a, label, select, textarea, img";
const DAY_NAMES =["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  textProofs: TextProof[];
  aiClarifyingQuestions: string[] | null;
  subtasks: { id: string; label: string; isCompleted: boolean; source: "user" | "ai_pitfall" }[];
  projectId: string | null;
  projects: { id: string; name: string; color: string }[];
  active?: boolean; // last-touched card: highlighted so it is clear where Ctrl+V / keyboard input goes
  onActivate?: () => void;
  hideProject?: boolean; // inside a project folder the project tag is redundant
};

export function TaskCard({
  id, title, completionType, estimatedMinutes, actualMinutes, activeTimerStartedAt, proofCount, thumbnails, textProofs,
  aiClarifyingQuestions, subtasks, projectId, projects, deadline, repeatEvery, repeatWeekdays, repeatUnit, repeatUntil, hideProject, active, onActivate,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"weekdays" | "every">(repeatWeekdays?.length ? "weekdays" : "every");
  const [added, setAdded] = useState(0); // extra minutes added when stopping the timer
  const [logMinutes, setLogMinutes] = useState("");
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
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
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
    startedAt && now ? calculateLoggedMinutes({ startedAt, endedAt: new Date(now), trimmedIdleMinutes: trimmed, addedMinutes: added }) : 0;

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
    }, (result) => [{ type: "task/addProof", id, textProof: result.textProof }]);
  }

  function logTime(event: React.FormEvent) {
    event.preventDefault();
    const minutes = Number(logMinutes);
    if (!Number.isInteger(minutes) || minutes < 1) return;
    setLogMinutes("");
    run({ type: "task/addMinutes", id, minutes }, async () => {
      const result = await logTaskMinutes(id, minutes);
      if (result.error) setLogMinutes((current) => current || String(minutes));
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
  // "Repeat until" is a whole day, so it runs to the end of that day (a deadline with a time still counts on the last day).
  const endOfDayIso = (date: string) => (date ? `${date}T23:59:59.999Z` : null);
  const overdue = isOverdue(deadline, Date.now());
  const project = projects.find((p) => p.id === projectId);
  const completeNow = () =>
    run({ type: "task/complete", id, at: new Date().toISOString() }, () => completeTask(id), (r) =>
      r.nextTask ? [{ type: "task/upsert", task: r.nextTask }] : [],
    );
  const fieldClass = "h-9 rounded-md border bg-background px-2 text-base";
  // For work done without the timer (offline, away from the phone).
  const logForm = (
    <form onSubmit={logTime} className="flex items-center gap-2 text-sm">
      <input
        value={logMinutes}
        onChange={(e) => setLogMinutes(e.target.value)}
        type="number"
        inputMode="numeric"
        min={1}
        placeholder="min taken"
        aria-label="Minutes taken"
        className="h-9 w-24 rounded-md border bg-background px-2 text-base"
      />
      <Button type="submit" variant="outline" size="sm">Log</Button>
    </form>
  );

  return (
    <div
      ref={card}
      className={`flex flex-col gap-3 rounded-lg border p-3 ${active ? "ring-2 ring-primary bg-primary/5" : ""}`}
      onPointerDownCapture={(e) => { pointerDown.current = { x: e.clientX, y: e.clientY }; onActivate?.(); }}
      onFocusCapture={onActivate}
      onMouseDown={(e) => {
        // The 2nd press of a double-click would select a word; a selected word then turns the next press into a text drag that eats the click.
        if (e.detail > 1 && !(e.target as HTMLElement).closest(CONTROLS)) e.preventDefault();
      }}
      onClick={(e) => {
        // Not onDoubleClick: the browser fires that only for click #2, so a quick second double-click (clicks 3 and 4) would be ignored.
        if (e.detail < 2 || e.detail % 2 !== 0) return;
        // Anywhere on the card, but not on controls (they keep their own double-click, e.g. selecting text in a field).
        if ((e.target as HTMLElement).closest(CONTROLS)) return;
        // A press that turned into a drag is not a double-click.
        const start = pointerDown.current;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) return;
        window.getSelection()?.removeAllRanges(); // double-click would otherwise leave a word highlighted
        setExpanded((v) => !v);
      }}
      onMouseEnter={() => (hovered.current = true)}
      onMouseLeave={() => (hovered.current = false)}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium">{title}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            {project && !hideProject && (
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
                {project.name}
              </span>
            )}
            {deadline && <span className={overdue ? "font-medium text-red-400" : ""} suppressHydrationWarning>Due {formatDeadline(deadline)}</span>}
            {repeatWeekdays?.length ? (
              <span>↻ {repeatWeekdays.map((n) => DAY_NAMES[n]).join(", ")}</span>
            ) : repeatEvery ? (
              <span>↻ {repeatEvery} {repeatUnit}</span>
            ) : null}
            {actualMinutes > 0 && <span>Logged {actualMinutes}m</span>}
            {isProof && <span>{proofCount} attached</span>}
          </p>
        </div>
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
        {/* Proof tasks need at least one proof first, so the tick stays greyed out until then. */}
        <button
          type="button"
          aria-label="Mark complete"
          title={isProof && proofCount === 0 ? "Add proof first" : "Mark complete"}
          disabled={isProof && proofCount === 0}
          onClick={completeNow}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-base enabled:hover:bg-primary enabled:hover:text-primary-foreground disabled:opacity-30"
        >
          ✓
        </button>
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-lg leading-none"
        >
          {expanded ? "−" : "+"}
        </button>
      </div>

      {expanded && (
        <>
          {/* 1. Name, where it lives and when it's due */}
          <div className="flex flex-col gap-2">
            <input
              // key remounts the field if the title changes from elsewhere (e.g. a failed rename rolling back)
              key={title}
              defaultValue={title}
              aria-label="Task title"
              maxLength={200}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (!next) e.target.value = title; // an empty title is never saved
                else if (next !== title) run({ type: "task/rename", id, title: next }, () => updateTaskTitle(id, next));
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className={`${fieldClass} font-medium`}
            />
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              Deadline
              <input
                type="datetime-local"
                value={toDatetimeLocal(deadline)}
                onChange={(e) => scheduleChange({ deadline: fromDatetimeLocal(e.target.value) })}
                className={fieldClass}
              />
            </label>
            {/* Only one repeat rule is shown (and active) at a time. */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              Repeat
              <div role="group" aria-label="Repeat type" className="flex overflow-hidden rounded-md border">
                {([["weekdays", "Days of week"], ["every", "Every N"]] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={repeatMode === mode}
                    onClick={() => {
                      if (repeatMode === mode) return;
                      setRepeatMode(mode);
                      // Drop the rule that is no longer shown so only the visible one can repeat the task.
                      if (mode === "weekdays" && repeatEvery) scheduleChange({ repeatEvery: null });
                      if (mode === "every" && repeatWeekdays?.length) scheduleChange({ repeatWeekdays: null });
                    }}
                    className={`h-8 px-3 ${repeatMode === mode ? "bg-primary text-primary-foreground" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            </div>
            {repeatMode === "weekdays" ? (
              <div className="flex flex-wrap items-center gap-1 text-sm">
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
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                Every
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
              </div>
            )}
            {(repeatEvery || repeatWeekdays?.length) && (
              <label className="flex items-center gap-2 text-sm">
                Repeat until
                <input
                  type="date"
                  value={repeatUntil?.slice(0, 10) ?? ""}
                  onChange={(e) => scheduleChange({ repeatUntil: endOfDayIso(e.target.value) })}
                  className={fieldClass}
                />
              </label>
            )}
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
                      <span className="min-w-0 flex-1">{s.label}</span>
                      <button
                        type="button"
                        aria-label="Remove subtask"
                        className="px-1 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.preventDefault(); run({ type: "task/removeSubtask", taskId: id, subtaskId: s.id }, () => removeSubtask(s.id)); }}
                      >
                        ×
                      </button>
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
            {textProofs.length > 0 && (
              <ul className="flex flex-col gap-1">
                {textProofs.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    {p.type === "url" ? (
                      <a href={p.text} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate underline">{p.text}</a>
                    ) : (
                      <span className="min-w-0 flex-1 truncate">{p.text}</span>
                    )}
                    <button
                      type="button"
                      aria-label="Remove note"
                      className="px-1 text-muted-foreground hover:text-foreground"
                      onClick={() => run({ type: "task/removeProof", id, proofId: p.id }, () => removeTaskProof(p.id))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {/* Toggle chips (filled when on) instead of checkboxes; aria-pressed keeps them accessible. */}
                {([["estimate", "Time estimate"], ["questions", "Questions"], ["pitfalls", "Pitfalls"]] as const).map(([part, label]) => (
                  <button
                    key={part}
                    type="button"
                    aria-pressed={aiParts[part]}
                    onClick={() => setAiParts({ ...aiParts, [part]: !aiParts[part] })}
                    className={`h-8 rounded-md border px-3 ${aiParts[part] ? "bg-primary text-primary-foreground" : ""}`}
                  >
                    {label}
                  </button>
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
            </div>
            {aiClarifyingQuestions && aiClarifyingQuestions.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {aiClarifyingQuestions.map((q) => <li key={q}>{q}</li>)}
              </ul>
            )}
          </div>

          {/* 4. Timer */}
          <div className="flex flex-col gap-2 border-t pt-3">
            {!startedAt ? (
              // Log-by-hand on the left, "or", timer on the right: two separate ways to record time.
              <div className="flex flex-wrap items-center gap-2">
                {logForm}
                <span className="text-sm text-muted-foreground">or</span>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="ml-auto"
                  onClick={() => run({ type: "task/startTimer", id, at: new Date().toISOString() }, () => startTaskTimer(id))}
                >
                  Start Timer
                </Button>
              </div>
            ) : !stopping ? (
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-lg" aria-live="off">{clock}</span>
                <Button type="button" variant="outline" size="lg" onClick={() => { setTrim(0); setAdded(0); setStopping(true); }}>
                  Stop
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-md border p-2">
                <p className="text-sm">
                  Elapsed {clock} · trim idle: <strong>{trimmed}m</strong> · added: <strong>{added}m</strong> · will log <strong>{netMinutes}m</strong>
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
                    <Button key={`-${m}`} type="button" variant="outline" size="sm" onClick={() => setTrim(Math.min(elapsedMinutes, trimmed + m))}>
                      -{m}m
                    </Button>
                  ))}
                  {[5, 15].map((m) => (
                    <Button key={`+${m}`} type="button" variant="outline" size="sm" onClick={() => setAdded(added + m)}>
                      +{m}m
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setStopping(false)}>Keep running</Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setStopping(false);
                      run({ type: "task/stopTimer", id, minutes: netMinutes }, () => stopTaskTimer(id, trimmed, added));
                    }}
                  >
                    Confirm stop
                  </Button>
                </div>
              </div>
            )}
            {startedAt && <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">or</span>{logForm}</div>}
          </div>

          {/* 5. Photo proof */}
          {isProof && (
            <div className="flex flex-col gap-2 border-t pt-3">
              {thumbnails.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {thumbnails.map((t) => (
                    <div key={t.id} className="relative">
                      <a href={t.url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                        <img src={t.url} alt="Proof" className="h-16 w-16 rounded-md border object-cover" />
                      </a>
                      <button
                        type="button"
                        aria-label="Remove photo"
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-xs leading-none shadow"
                        onClick={() => run({ type: "task/removeProof", id, proofId: t.id }, () => removeTaskProof(t.id))}
                      >
                        ×
                      </button>
                    </div>
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
