"use client";

import { useState } from "react";
import { dumpToTriage } from "@/app/actions/triage";
import { useDashboard } from "@/components/dashboard-provider";

export function BrainDumpBar() {
  const [text, setText] = useState("");
  const { run } = useDashboard();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const sourceSubject = text.trim();
    if (!sourceSubject) return;
    setText(""); // ready for the next thought immediately
    const newId = crypto.randomUUID();
    run(
      // "requirement" mirrors the DB default for new items
      { type: "triage/add", item: { id: newId, category: "requirement", sourceSubject, summary: null, suggestedAction: null } },
      async () => {
        const result = await dumpToTriage({ id: newId, sourceSubject });
        if (result.error) setText((current) => current || sourceSubject); // don't lose the thought on failure
        return result;
      },
    );
  }

  return (
    <form
      onSubmit={submit}
      className="sticky bottom-4 z-10 flex gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/85 p-2 shadow-2xl backdrop-blur-xl"
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        placeholder="Brain dump… hit Enter"
        aria-label="Brain dump"
        className="h-12 min-w-0 flex-1 rounded-xl border-0 bg-transparent px-3 text-base outline-none placeholder:text-zinc-500"
      />
      <button type="submit" className="h-12 shrink-0 rounded-xl bg-zinc-100 px-5 text-sm font-semibold text-zinc-950 hover:bg-white">
        Add
      </button>
    </form>
  );
}
