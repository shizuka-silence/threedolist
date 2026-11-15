"use client";

import { useState, useTransition } from "react";
import { dismissTriageItem, promoteTriageItem } from "@/app/actions/triage";
import { Button } from "@/components/ui/button";

type Props = { id: string; sourceSubject: string; summary: string | null; suggestedAction: string | null };

export function TriageCard({ id, sourceSubject, summary, suggestedAction }: Props) {
  const [promoting, setPromoting] = useState(false);
  const [title, setTitle] = useState(sourceSubject);
  const [completionType, setCompletionType] = useState<"tick" | "proof">("tick");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await action();
      setError(result.error ?? null);
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="font-medium">{sourceSubject}</p>
      {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
      {suggestedAction && <p className="text-sm">Suggested: {suggestedAction}</p>}

      {promoting ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => promoteTriageItem(id, { title, completionType }));
          }}
          className="flex flex-col gap-2"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Task title"
            className="h-12 w-full rounded-md border bg-background px-3 text-base"
          />
          <div className="flex gap-2">
            <Button type="button" variant={completionType === "tick" ? "default" : "outline"} aria-pressed={completionType === "tick"} onClick={() => setCompletionType("tick")} className="h-10 flex-1">
              Tick
            </Button>
            <Button type="button" variant={completionType === "proof" ? "default" : "outline"} aria-pressed={completionType === "proof"} onClick={() => setCompletionType("proof")} className="h-10 flex-1">
              Proof
            </Button>
            <Button type="submit" disabled={pending} className="h-10 flex-1">Add task</Button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <Button onClick={() => setPromoting(true)} disabled={pending} className="h-10 flex-1">Promote to Task</Button>
          <Button variant="outline" onClick={() => run(() => dismissTriageItem(id))} disabled={pending} className="h-10 flex-1">
            Discard
          </Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </li>
  );
}
