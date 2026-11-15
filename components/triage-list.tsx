"use client";

import { useOptimistic, useState, useTransition } from "react";
import { updateTriageItemCategory } from "@/app/actions/triage";
import { TriageCard } from "@/components/triage-card";
import type { TriageCategory } from "@/lib/triage-rules";

type Item = { id: string; category: TriageCategory; sourceSubject: string; summary: string | null; suggestedAction: string | null };

const SECTIONS: { category: TriageCategory; heading: string }[] = [
  { category: "requirement", heading: "Requirements & Deadlines" },
  { category: "reply", heading: "Replies Needed" },
  { category: "opportunity", heading: "Opportunities" },
  { category: "announcement", heading: "Announcements" },
];

// Owns the grouping so a reclassified card jumps to its new section instantly (reverts if the save fails).
export function TriageList({ items }: { items: Item[] }) {
  const [optimisticItems, setCategory] = useOptimistic(items, (state, change: { id: string; category: TriageCategory }) =>
    state.map((item) => (item.id === change.id ? { ...item, category: change.category } : item)),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function reclassify(id: string, category: TriageCategory) {
    startTransition(async () => {
      setCategory({ id, category });
      const result = await updateTriageItemCategory(id, category);
      setError(result.error ?? null);
    });
  }

  return (
    <>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {SECTIONS.map(({ category, heading }) => {
        const sectionItems = optimisticItems.filter((item) => item.category === category);
        if (sectionItems.length === 0) return null;
        return (
          <section key={category} className="flex flex-col gap-2">
            <h2 className="font-semibold">{heading} ({sectionItems.length})</h2>
            <ul className="flex flex-col gap-3">
              {sectionItems.map((item) => <TriageCard key={item.id} {...item} onReclassify={reclassify} />)}
            </ul>
          </section>
        );
      })}
    </>
  );
}
