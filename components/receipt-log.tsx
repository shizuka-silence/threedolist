"use client";

import { useState } from "react";
import type { Receipt } from "@/app/receipts";
import { useDashboard } from "@/components/dashboard-provider";
import { filterReceiptTasks, formatReceiptVariance } from "@/lib/receipt-rules";

const pill = (on: boolean) =>
  `flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium ${on ? "bg-primary text-primary-foreground" : ""}`;

export function ReceiptLog({ receipts: serverReceipts, projects }: { receipts: Receipt[]; projects: { id: string; name: string; color: string }[] }) {
  const { completedNow } = useDashboard();
  // Tasks completed a moment ago show up here before the server's list catches up.
  const justCompleted: Receipt[] = completedNow
    .filter((t) => !serverReceipts.some((r) => r.id === t.id))
    .map((t) => {
      const project = projects.find((p) => p.id === t.projectId);
      return {
        id: t.id, title: t.title, notes: null, projectId: t.projectId, projectName: project?.name ?? null,
        projectColor: project?.color ?? null, estimatedMinutes: t.estimatedMinutes, actualMinutes: t.actualMinutes,
        completedAt: new Date().toISOString(), proofs: [],
      };
    });
  const receipts = [...justCompleted, ...serverReceipts];
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("all");
  const shown = filterReceiptTasks(receipts, query, projectId);

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search finished tasks, notes, projects"
        aria-label="Search receipts"
        className="h-10 rounded-md border bg-background px-3 text-base"
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" className={pill(projectId === "all")} onClick={() => setProjectId("all")}>
          All <span className="opacity-70">{receipts.length}</span>
        </button>
        <button type="button" className={pill(projectId === "unassigned")} onClick={() => setProjectId("unassigned")}>
          Unassigned <span className="opacity-70">{receipts.filter((r) => !r.projectId).length}</span>
        </button>
        {projects.map((p) => (
          <button key={p.id} type="button" className={pill(projectId === p.id)} onClick={() => setProjectId(p.id)}>
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name} <span className="opacity-70">{receipts.filter((r) => r.projectId === p.id).length}</span>
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-3">
        {shown.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {r.projectName ? (
                <span className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.projectColor ?? undefined }} />
                  {r.projectName}
                </span>
              ) : (
                <span className="rounded-full border px-2 py-0.5">Unassigned</span>
              )}
              {r.completedAt && <time dateTime={r.completedAt}>{new Date(r.completedAt).toLocaleString()}</time>}
            </div>
            <p className="font-medium">{r.title}</p>
            <span className="w-fit rounded-md bg-muted px-2 py-0.5 text-xs">
              {formatReceiptVariance(r.estimatedMinutes, r.actualMinutes).label}
            </span>
            <Proofs proofs={r.proofs} />
          </li>
        ))}
        {shown.length === 0 && <p className="text-muted-foreground">No receipts match.</p>}
      </ul>
    </div>
  );
}

// Proofs render only after a tap, so images aren't downloaded until asked for (saves mobile data).
function Proofs({ proofs }: { proofs: Receipt["proofs"] }) {
  const [open, setOpen] = useState(false);
  if (proofs.length === 0) return null;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-9 w-fit rounded-md border px-3 text-sm font-medium">
        Show proof ({proofs.length})
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {proofs.map((p) =>
        p.type === "image" && p.href ? (
          <a key={p.id} href={p.href} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.href} alt={p.caption ?? "Proof"} className="h-16 w-16 rounded-md border object-cover" />
          </a>
        ) : p.type === "note" ? (
          <span key={p.id} className="rounded-md border px-2 py-1 text-xs">{p.text}</span>
        ) : p.href ? (
          <a key={p.id} href={p.href} target="_blank" rel="noreferrer" className="max-w-full truncate rounded-md border px-2 py-1 text-xs underline">
            {p.text}
          </a>
        ) : null,
      )}
      <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-md px-2 text-sm text-muted-foreground">Hide</button>
    </div>
  );
}
