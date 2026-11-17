"use client";

import { useState } from "react";
import { dismissTriageItem, promoteTriageItem } from "@/app/actions/triage";
import { useDashboard } from "@/components/dashboard-provider";
import { Button } from "@/components/ui/button";
import { buildOptimisticTask } from "@/lib/optimistic-rules";
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
  const { run } = useDashboard();

  // The card disappears at once; a failure restores it and the dashboard banner explains why.
  function promote(overrides?: { title: string; completionType: "tick" | "proof" }) {
    const task = buildOptimisticTask(crypto.randomUUID(), overrides?.title.trim() || defaults.title, overrides?.completionType ?? defaults.completionType);
    run(
      { type: "triage/promote", id, task },
      () => promoteTriageItem(id, { ...overrides, taskId: task.id }),
    );
  }

  const dismiss = () => run({ type: "triage/remove", id }, () => dismissTriageItem(id));

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
            disabled={c === category}
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
            promote({ title, completionType });
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
            <Button type="submit" className="h-10 flex-1">Add task</Button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          {promoteLabel && (
            <Button onClick={() => promote()} className="h-10 flex-1">
              {promoteLabel}
            </Button>
          )}
          <Button variant="outline" onClick={dismiss} className="h-10 flex-1">
            {DISMISS_LABEL[category]}
          </Button>
          {promoteLabel && (
            <Button variant="outline" onClick={() => setEditing(true)} className="h-10">
              Edit
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
