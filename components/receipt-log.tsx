"use client";

import { ChevronLeft, ChevronRight, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { uncompleteTask, updateTaskReflection } from "@/app/actions/tasks";
import type { Receipt } from "@/app/receipts";
import { useDashboard } from "@/components/dashboard-provider";
import { Pagination } from "@/components/pagination";
import { paginate } from "@/lib/pagination";
import { filterReceiptTasks, formatReceiptVariance } from "@/lib/receipt-rules";

const pill = (on: boolean) =>
  `flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium ${on ? "border-transparent bg-zinc-100 text-zinc-950" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"}`;

// Receipts come from the server on each visit to this tab, so they already include anything completed earlier.
export function ReceiptLog({ receipts: serverReceipts }: { receipts: Receipt[] }) {
  const { state: { projects, completedTasks }, run } = useDashboard();
  // Tasks finished this session show up before the next page load; the server list wins once it has them.
  const justCompleted: Receipt[] = completedTasks
    .filter((t) => !serverReceipts.some((r) => r.id === t.id))
    .map((t) => {
      const project = projects.find((p) => p.id === t.projectId);
      return {
        id: t.id, title: t.title, notes: null, reflection: null, projectId: t.projectId, projectName: project?.name ?? null,
        projectColor: project?.color ?? null, estimatedMinutes: t.estimatedMinutes, actualMinutes: t.actualMinutes,
        completedAt: t.completedAt, scheduledStart: t.scheduledStart, sessions: [],
        // Same data the task card had; uploaded files other than images aren't tracked client-side until the next server load.
        proofs: [
          ...t.thumbnails.map((th) => ({ id: th.id, type: "image" as const, href: th.url, text: "", caption: null })),
          ...t.writtenProofs.map((w) => ({ id: w.id, type: "text" as const, href: null, text: w.text, caption: null })),
        ],
      };
    });
  const receipts = [...justCompleted, ...serverReceipts];
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [page, setPage] = useState(1);
  const { items: shown, page: currentPage, pageCount } = paginate(filterReceiptTasks(receipts, query, projectId), page);
  const latestId = receipts[0]?.id; // newest of the unfiltered list, so searching never makes another row look like the latest

  // Full reload: the reopened task needs its proofs, subtasks and signed thumbnails, which only the server page builds.
  async function undo(id: string) {
    const result = await run(null, () => uncompleteTask(id));
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- router.push would keep the stale provider state
    if (!result.error) window.location.assign("/");
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setPage(1); }}
        placeholder="Search finished tasks, notes, projects"
        aria-label="Search receipts"
        className="h-10 rounded-md border bg-background px-3 text-base"
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" className={pill(projectId === "all")} onClick={() => { setProjectId("all"); setPage(1); }}>
          All <span className="opacity-70">{receipts.length}</span>
        </button>
        <button type="button" className={pill(projectId === "unassigned")} onClick={() => { setProjectId("unassigned"); setPage(1); }}>
          Unassigned <span className="opacity-70">{receipts.filter((r) => !r.projectId).length}</span>
        </button>
        {projects.map((p) => (
          <button key={p.id} type="button" className={pill(projectId === p.id)} onClick={() => { setProjectId(p.id); setPage(1); }}>
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name} <span className="opacity-70">{receipts.filter((r) => r.projectId === p.id).length}</span>
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-3">
        {shown.map((r) => (
          <li key={r.id} className="relative flex flex-col gap-2 rounded-lg border p-3">
            <div className={`flex flex-wrap items-center gap-2 text-xs text-muted-foreground ${r.id === latestId ? "pr-9" : ""}`}>
              {r.projectName ? (
                <span className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.projectColor ?? undefined }} />
                  {r.projectName}
                </span>
              ) : (
                <span className="rounded-full border px-2 py-0.5">Unassigned</span>
              )}
              {r.completedAt && <time dateTime={r.completedAt}>{new Date(r.completedAt).toLocaleString()}</time>}
              <span className="rounded-md bg-muted px-2 py-0.5 text-foreground">
                {formatReceiptVariance(r.estimatedMinutes, r.actualMinutes).label}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{r.title}</p>
              <Proofs proofs={r.proofs} />
            </div>
            <Reflection taskId={r.id} initial={r.reflection} />
            {r.id === latestId && (
              <button
                type="button"
                onClick={() => undo(r.id)}
                aria-label="Undo completion"
                title="Undo completion"
                className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Undo2 className="size-4" />
              </button>
            )}
          </li>
        ))}
        {shown.length === 0 && <p className="text-muted-foreground">No receipts match.</p>}
      </ul>
      <Pagination page={currentPage} pageCount={pageCount} onPage={setPage} />
    </div>
  );
}

// Collapsed to one button; once open it's a plain textarea that saves when you click away, so nothing is lost by forgetting a Save button.
function Reflection({ taskId, initial }: { taskId: string; initial: string | null }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? ""); // last value known to be stored
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    if (text.trim() === saved.trim()) return;
    setStatus("Saving…");
    const result = await updateTaskReflection(taskId, text);
    if (result.error) return setStatus(result.error);
    setSaved(text);
    setStatus("Saved");
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-9 w-fit rounded-md border px-3 text-sm font-medium">
        {saved.trim() ? "Show reflection" : "Add reflection"}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setStatus(null); }}
        onBlur={save}
        autoFocus
        rows={4}
        aria-label="Reflection"
        placeholder="What went well, what took longer than expected, what to do differently?"
        className="rounded-md border bg-background p-2 text-base"
      />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-md px-2">Hide</button>
        {status && <span role="status">{status}</span>}
      </div>
    </div>
  );
}

// Proofs render only after a tap, so images aren't downloaded until asked for (saves mobile data).
// Full-screen viewer in a native <dialog>: Esc-to-close, focus trapping and the backdrop come for free.
function Proofs({ proofs }: { proofs: Receipt["proofs"] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const current = proofs[index];
  const go = (i: number) => setIndex(Math.min(Math.max(i, 0), proofs.length - 1));
  // Window-level so arrows keep working after the focused side button disappears at either end.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, proofs.length - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, proofs.length]);
  const side = "absolute inset-y-0 z-10 flex w-14 items-center justify-center text-white/60 hover:text-white sm:w-20";
  if (proofs.length === 0) return null;
  return (
    <>
      <button type="button" onClick={() => { setIndex(0); setOpen(true); }} className="h-9 w-fit rounded-md border px-3 text-sm font-medium">
        Show proof ({proofs.length})
      </button>
      {open && (
        <dialog
          ref={(d) => { if (d && !d.open) d.showModal(); }}
          onClose={() => setOpen(false)}
          // Clicking empty space (not the proof, a link or a button) closes the viewer.
          onClick={(e) => { if (!(e.target as HTMLElement).closest("img,a,button,p")) setOpen(false); }}
          className="fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none bg-black/90 p-0 text-white backdrop:bg-black/90"
        >
          {index > 0 && (
            <button type="button" aria-label="Previous proof" onClick={() => go(index - 1)} className={`${side} left-0`}>
              <ChevronLeft className="size-8" />
            </button>
          )}
          {index < proofs.length - 1 && (
            <button type="button" aria-label="Next proof" onClick={() => go(index + 1)} className={`${side} right-0`}>
              <ChevronRight className="size-8" />
            </button>
          )}
          <button
            type="button" aria-label="Close" onClick={() => setOpen(false)}
            className="absolute right-3 top-3 z-20 flex size-10 items-center justify-center rounded-md bg-black/50 hover:bg-black/70 sm:right-24"
          >
            <X className="size-5" />
          </button>
          <div className="flex h-full flex-col px-16 pb-3 pt-14 sm:px-24">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {current.type === "image" && current.href ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.href} alt={current.caption ?? "Proof"} className="max-h-full max-w-full rounded-md object-contain" />
              ) : current.type === "text" ? (
                <p className="max-h-full w-full max-w-2xl overflow-y-auto whitespace-pre-wrap rounded-md bg-white/10 p-4 text-lg">{current.text}</p>
              ) : (
                <p className="text-lg">{current.text}</p>
              )}
            </div>
            <div className="flex flex-col items-center gap-1 pt-3 text-sm">
              {current.type !== "text" && current.href && (
                <a href={current.href} target="_blank" rel="noreferrer" className="underline">Open in new tab</a>
              )}
              <span>{index + 1} / {proofs.length}</span>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
