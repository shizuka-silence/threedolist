"use client";

import { useState } from "react";
import { createTask } from "@/app/actions/tasks";
import { useDashboard } from "@/components/dashboard-provider";
import { buildOptimisticTask } from "@/lib/optimistic-rules";
import { Button } from "@/components/ui/button";

// projectId: the folder currently open, so new tasks land in it (null in All / Unassigned).
export function AddTaskForm({ projectId }: { projectId: string | null }) {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("");
  const [completionType, setCompletionType] = useState<"tick" | "proof">("proof");
  const { run } = useDashboard();

  // The card appears at once under an id we choose; the server saves it under the same id.
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const estimatedMinutes = Number.isInteger(Number(minutes)) && Number(minutes) > 0 ? Number(minutes) : undefined;
    const id = crypto.randomUUID();
    const task = { ...buildOptimisticTask(id, trimmed, completionType), estimatedMinutes: estimatedMinutes ?? null, projectId };
    const saved = { title, minutes };
    setTitle("");
    setMinutes("");
    run({ type: "task/upsert", task }, async () => {
      const result = await createTask({ id, title: trimmed, completionType, estimatedMinutes, projectId });
      if (result.error) {
        setTitle((t) => t || saved.title);
        setMinutes((m) => m || saved.minutes);
      }
      return result;
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task"
          aria-label="Task title"
          className="h-12 min-w-0 flex-1 rounded-md border bg-background px-3 text-base"
        />
        {/* One toggle: Proof (default) <-> Tick. */}
        <Button
          type="button"
          variant={completionType === "tick" ? "default" : "outline"}
          aria-pressed={completionType === "tick"}
          aria-label={`Completion type: ${completionType}. Click to switch.`}
          onClick={() => setCompletionType(completionType === "proof" ? "tick" : "proof")}
          className="h-12 w-20 shrink-0"
        >
          {completionType === "proof" ? "Proof" : "Tick"}
        </Button>
        <input
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          type="number"
          inputMode="numeric"
          min={1}
          placeholder="min"
          aria-label="Estimated minutes"
          className="h-12 w-20 rounded-md border bg-background px-3 text-base"
        />
      </div>
      <Button type="submit" size="lg" className="h-12 w-full">
        Add
      </Button>
    </form>
  );
}
