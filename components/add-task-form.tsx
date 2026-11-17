"use client";

import { useState } from "react";
import { createTask } from "@/app/actions/tasks";
import { useDashboard } from "@/components/dashboard-provider";
import { Button } from "@/components/ui/button";

export function AddTaskForm() {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("");
  const [completionType, setCompletionType] = useState<"tick" | "proof">("proof");
  const [pending, setPending] = useState(false);
  const { run } = useDashboard();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await run(
      null,
      () => createTask({ title, completionType, estimatedMinutes: minutes ? Number(minutes) : undefined }),
      (r) => (r.task ? [{ type: "task/upsert", task: r.task }] : []),
    );
    setPending(false);
    if (!result.error) {
      setTitle("");
      setMinutes("");
    }
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
        <Button type="submit" disabled={pending} className="h-10 flex-1">
          Add
        </Button>
      </div>
    </form>
  );
}
