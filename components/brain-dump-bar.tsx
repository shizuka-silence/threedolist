"use client";

import { useState, useTransition } from "react";
import { dumpToTriage } from "@/app/actions/triage";

export function BrainDumpBar() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await dumpToTriage({ sourceSubject: text });
      setError(result.error ?? null);
      if (!result.error) setText("");
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={pending}
        autoFocus
        placeholder="Brain dump… hit Enter"
        aria-label="Brain dump"
        className="h-12 w-full rounded-md border bg-background px-3 text-base"
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
