"use client";

import { updateTriageItemCategory } from "@/app/actions/triage";
import { useDashboard } from "@/components/dashboard-provider";
import { TriageCard } from "@/components/triage-card";
import type { TriageCategory } from "@/lib/triage-rules";

const SECTIONS: { category: TriageCategory; heading: string }[] = [
  { category: "requirement", heading: "Requirements & Deadlines" },
  { category: "reply", heading: "Replies Needed" },
  { category: "opportunity", heading: "Opportunities" },
  { category: "announcement", heading: "Announcements" },
];

// Owns the grouping so a reclassified card jumps to its new section instantly (reverts if the save fails).
export function TriageList() {
  const { state, run } = useDashboard();

  function reclassify(id: string, category: TriageCategory) {
    run({ type: "triage/reclassify", id, category }, () => updateTriageItemCategory(id, category));
  }

  return (
    <>
      {state.triage.length === 0 && <p className="text-muted-foreground">Triage is empty. Dump a thought above.</p>}
      {SECTIONS.map(({ category, heading }) => {
        const sectionItems = state.triage.filter((item) => item.category === category);
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

export function TriageBadge() {
  const { state } = useDashboard();
  return <>{state.triage.length > 0 && ` (${state.triage.length})`}</>;
}
