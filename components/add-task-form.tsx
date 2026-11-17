"use client";

import { useState } from "react";
import { createTask } from "@/app/actions/tasks";
import { useDashboard } from "@/components/dashboard-provider";
import { buildOptimisticTask } from "@/lib/optimistic-rules";
import { Button } from "@/components/ui/button";

export function AddTaskForm() {
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
    const task = { ...buildOptimisticTask(id, trimmed, completionType), estimatedMinutes: estimatedMinutes ?? null };
    const saved = { title, minutes };
    setTitle("");
    setMinutes("");
    run({ type: "task/upsert", task }, async () => {
      const result = await createTask({ id, title: trimmed, completionType, estimatedMinutes });
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
      <div className="flex gap-2">
        <Button
          type="button"
          variant={completionType === "tick" ? "default" : "outline"}
          aria-pressed={completionType === "tick"}
          onClick={() => setCompletionType("tick")}
          className="h-10 flex-1"
        >
          Tick
        </Button>
        <Button
          type="button"
          variant={completionType === "proof" ? "default" : "outline"}
          aria-pressed={completionType === "proof"}
          onClick={() => setCompletionType("proof")}
          className="h-10 flex-1"
        >
          Proof
        </Button>
        <Button type="submit" className="h-10 flex-1">
          Add
        </Button>
      </div>
    </form>
  );
}
