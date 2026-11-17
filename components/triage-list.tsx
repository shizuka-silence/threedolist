"use client";

import { useState } from "react";
import { updateTriageItemCategory } from "@/app/actions/triage";
import { useDashboard } from "@/components/dashboard-provider";
import { TriageCard } from "@/components/triage-card";
import type { TriageCategory } from "@/lib/triage-rules";

const SECTIONS: { category: TriageCategory; heading: string }[] = [
  { category: "announcement", heading: "Announcements" },
  { category: "opportunity", heading: "Opportunities" },
  { category: "reply", heading: "Replies Needed" },
  { category: "requirement", heading: "Requirements & Deadlines" },
];

// Owns the grouping so a reclassified card jumps to its new section instantly (reverts if the save fails).
export function TriageList() {
  const { state, run } = useDashboard();
  const [picked, setPicked] = useState<TriageCategory | null>(null);
  const count = (c: TriageCategory) => state.triage.filter((i) => i.category === c).length;
  // Until the user picks a tab, land on the first one that has something in it.
  const active = picked ?? SECTIONS.find((s) => count(s.category) > 0)?.category ?? SECTIONS[0].category;
  const items = state.triage.filter((i) => i.category === active);

  function reclassify(id: string, category: TriageCategory) {
    run({ type: "triage/reclassify", id, category }, () => updateTriageItemCategory(id, category));
  }

  if (state.triage.length === 0) return <p className="text-muted-foreground">Triage is empty. Dump a thought above.</p>;

  return (
    <>
      <div role="tablist" aria-label="Triage categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {SECTIONS.map(({ category, heading }) => {
          const n = count(category);
          const on = category === active;
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setPicked(category)}
              className={`flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm ${on ? "bg-zinc-100 font-medium text-zinc-950" : n > 0 ? "border border-amber-500/60 bg-zinc-900 text-zinc-100 hover:bg-zinc-800" : "border border-zinc-800 bg-zinc-900 text-zinc-500"}`}
            >
              {heading.split(" ")[0]}
              {/* Amber count on an unselected tab = unread items hiding there. */}
              <span className={`rounded-full px-1.5 font-mono text-xs ${!on && n > 0 ? "bg-amber-500 font-semibold text-zinc-950" : "opacity-70"}`}>{n}</span>
            </button>
          );
        })}
      </div>
      <section role="tabpanel" className="flex flex-col gap-2">
        {items.length === 0 && <p className="text-muted-foreground">Nothing in {SECTIONS.find((s) => s.category === active)?.heading}.</p>}
        <ul className="flex flex-col gap-3">
          {items.map((item) => <TriageCard key={item.id} {...item} onReclassify={reclassify} />)}
        </ul>
      </section>
    </>
  );
}

export function TriageBadge() {
  const { state } = useDashboard();
  return <>{state.triage.length > 0 && ` (${state.triage.length})`}</>;
}
