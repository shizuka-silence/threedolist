"use client";

import { useState, useTransition } from "react";
import { dismissTriageItem, promoteTriageItem } from "@/app/actions/triage";
import { Button } from "@/components/ui/button";
import { buildPromotionTaskPayload, TRIAGE_CATEGORIES, type TriageCategory } from "@/lib/triage-rules";

type Props = {
  id: string;
  category: TriageCategory;
  sourceSubject: string;
  summary: string | null;
  suggestedAction: string | null;
  onReclassify: (id: string, category: TriageCategory) => void;
};

// Label of the 1-tap promote button per category; announcements can only be acknowledged.
const PROMOTE_LABEL: Record<TriageCategory, string | null> = {
  announcement: null,
  requirement: "Promote to Proof Task",
  opportunity: "Yes (Spawn RSVP Task)",
  reply: "Spawn Reply Task",
};
const DISMISS_LABEL: Record<TriageCategory, string> = {
  announcement: "✓ Acknowledge",
  requirement: "Discard",
  opportunity: "No",
  reply: "Discard",
};

const CATEGORY_LABEL: Record<TriageCategory, string> = {
  announcement: "Announcement",
  requirement: "Requirement",
  opportunity: "Opportunity",
  reply: "Reply",
};

export function TriageCard({ id, category, sourceSubject, summary, suggestedAction, onReclassify }: Props) {
  const defaults = buildPromotionTaskPayload({ category, sourceSubject, summary, suggestedAction });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(defaults.title);
  const [completionType, setCompletionType] = useState(defaults.completionType);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await action();
      setError(result.error ?? null);
    });
  }

  const promoteLabel = PROMOTE_LABEL[category];

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="font-medium">{sourceSubject}</p>
      {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
      {suggestedAction && <p className="text-sm">Suggested: {suggestedAction}</p>}

      <div role="group" aria-label="Category" className="flex flex-wrap gap-1">
        {TRIAGE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={c === category}
            disabled={pending || c === category}
            onClick={() => onReclassify(id, c)}
            className={`rounded-full border px-2 py-1 text-xs ${c === category ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {editing ? (
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
          {promoteLabel && (
            <Button onClick={() => run(() => promoteTriageItem(id))} disabled={pending} className="h-10 flex-1">
              {promoteLabel}
            </Button>
          )}
          <Button variant="outline" onClick={() => run(() => dismissTriageItem(id))} disabled={pending} className="h-10 flex-1">
            {DISMISS_LABEL[category]}
          </Button>
          {promoteLabel && (
            <Button variant="outline" onClick={() => setEditing(true)} disabled={pending} className="h-10">
              Edit
            </Button>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </li>
  );
}
