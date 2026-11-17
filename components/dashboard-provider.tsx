"use client";

import { createContext, useContext, useOptimistic, useState, useTransition } from "react";
import {
  applyOptimisticChange, type OptimisticChange, type OptimisticState, type OptimisticTask, type OptimisticTriageItem,
} from "@/lib/optimistic-rules";

// The single copy of triage + active-task state. Views read `state` and call `run`; when the server action
// finishes (or fails) React drops the optimistic layer and shows the server props, so a failure rolls back by itself.
type Dashboard = {
  state: OptimisticState;
  completedNow: OptimisticTask[]; // tasks completed optimistically but not yet in the server's Receipt Log
  run: (change: OptimisticChange, action: () => Promise<{ error?: string }>) => void;
};

const DashboardContext = createContext<Dashboard | null>(null);

export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return value;
}

export function DashboardProvider({ triage, tasks, children }: {
  triage: OptimisticTriageItem[];
  tasks: OptimisticTask[];
  children: React.ReactNode;
}) {
  const [state, dispatch] = useOptimistic({ triage, tasks }, applyOptimisticChange);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(change: OptimisticChange, action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      dispatch(change);
      try {
        const result = await action();
        // Never clear on success: a later click would otherwise wipe an earlier failure before it is read.
        if (result.error) setError(`${result.error} Change reverted.`);
      } catch {
        setError("Couldn't save that change. Reverted.");
      }
    });
  }

  // Only completion removes tasks, so "in the server list but not in the optimistic list" = completed just now.
  const completedNow = tasks.filter((t) => !state.tasks.some((o) => o.id === t.id));

  return (
    <DashboardContext.Provider value={{ state, completedNow, run }}>
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
