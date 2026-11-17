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
    run(
      // "requirement" mirrors the DB default for new items
      { type: "triage/add", item: { id: crypto.randomUUID(), category: "requirement", sourceSubject, summary: null, suggestedAction: null } },
      async () => {
        const result = await dumpToTriage({ sourceSubject });
        if (result.error) setText((current) => current || sourceSubject); // don't lose the thought on failure
        return result;
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        placeholder="Brain dump… hit Enter"
        aria-label="Brain dump"
        className="h-12 w-full rounded-md border bg-background px-3 text-base"
      />
    </form>
  );
}
