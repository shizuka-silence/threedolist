"use client";

import { createContext, useContext, useRef, useState } from "react";
import { applyOptimisticChange, type OptimisticChange, type OptimisticState } from "@/lib/optimistic-rules";

// The single copy of the dashboard collections. It starts from the server props once; after that every click
// changes this state instantly and the Server Action saves in the background (no page re-render).
type Result = { error?: string };

type Dashboard = {
  state: OptimisticState;
  // `change` is applied at once (null = wait for the server). On failure it is rolled back and the banner shows.
  // `onSuccess` maps the server's reply (new rows) to more changes. Returns the reply so callers can reset forms.
  run: <T extends Result>(change: OptimisticChange | null, action: () => Promise<T>, onSuccess?: (result: T) => OptimisticChange[]) => Promise<T | Result>;
};

const DashboardContext = createContext<Dashboard | null>(null);

export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return value;
}

export function DashboardProvider({ initial, children }: { initial: OptimisticState; children: React.ReactNode }) {
  const [state, setState] = useState(initial);
  const latest = useRef(initial); // always the newest state, even between two clicks in the same render
  const [error, setError] = useState<string | null>(null);

  function update(next: OptimisticState) {
    latest.current = next;
    setState(next);
  }

  async function run<T extends Result>(change: OptimisticChange | null, action: () => Promise<T>, onSuccess?: (result: T) => OptimisticChange[]) {
    // shortcut: rollback restores the whole snapshot, so a failure can also undo a different click made while
    // it was in flight; upgrade to per-change inverses if that ever shows up.
    const before = latest.current;
    if (change) update(applyOptimisticChange(before, change));

    let result: T | Result;
    try {
      result = await action();
    } catch {
      result = { error: "Couldn't save that change." };
    }

    if (result.error) {
      if (change) update(before);
      // Never clear on success: a later click would otherwise wipe an earlier failure before it is read.
      setError(change ? `${result.error} Change reverted.` : result.error);
    } else if (onSuccess) {
      update(onSuccess(result as T).reduce(applyOptimisticChange, latest.current));
    }
    return result;
  }

  return (
    <DashboardContext.Provider value={{ state, run }}>
      {error && (
        <div role="alert" className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-2 bg-destructive p-3 text-sm text-white">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error" className="px-2">✕</button>
        </div>
      )}
      {children}
    </DashboardContext.Provider>
  );
}
