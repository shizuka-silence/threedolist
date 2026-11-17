"use client";

import { useEffect, useState } from "react";
import type { Receipt } from "@/app/receipts";
import { BrainDumpBar } from "@/components/brain-dump-bar";
import { CalendarTab } from "@/components/calendar-tab";
import { EmailDumpBox } from "@/components/email-dump-box";
import { ReceiptLog } from "@/components/receipt-log";
import { TaskBoard } from "@/components/task-board";
import { TriageBadge, TriageList } from "@/components/triage-list";

// Tabs and project folders live in client state, so switching never waits on the server.
// The URL is kept in sync with pushState so reloads and shared links still land on the same view.
type Tab = "tasks" | "calendar" | "receipts" | "triage";
const TABS: { tab: Tab; label: string }[] = [
  { tab: "tasks", label: "Tasks" },
  { tab: "calendar", label: "Calendar" },
  { tab: "receipts", label: "Receipts" },
  { tab: "triage", label: "Triage" },
];

const parseTab = (value: string | null | undefined): Tab => (TABS.some((t) => t.tab === value) ? (value as Tab) : "tasks");

function toUrl(tab: Tab, project: string) {
  const params = new URLSearchParams();
  if (tab !== "tasks") params.set("tab", tab);
  if (tab === "tasks" && project !== "all") params.set("project", project);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function DashboardShell({ initialTab, initialProject, receipts, canSyncGmail }: {
  initialTab?: string;
  initialProject?: string;
  receipts: Receipt[];
  canSyncGmail: boolean;
}) {
  const [tab, setTab] = useState(parseTab(initialTab));
  const [project, setProject] = useState(initialProject ?? "all"); // "all" | "unassigned" | project id

  // Browser Back/Forward: re-read the URL.
  useEffect(() => {
    function onPop() {
      const params = new URLSearchParams(window.location.search);
      setTab(parseTab(params.get("tab")));
      setProject(params.get("project") ?? "all");
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function go(nextTab: Tab, nextProject: string) {
    setTab(nextTab);
    setProject(nextProject);
    window.history.pushState(null, "", toUrl(nextTab, nextProject));
  }

  return (
    <>
      <nav className="flex gap-2">
        {TABS.map(({ tab: t, label }) => (
          <button
            key={t}
            type="button"
            onClick={() => go(t, project)}
            className={`flex h-10 flex-1 items-center justify-center rounded-md border text-sm font-medium ${tab === t ? "bg-primary text-primary-foreground" : ""}`}
          >
            {label}
            {t === "triage" && <TriageBadge />}
          </button>
        ))}
      </nav>

      {tab === "calendar" ? (
        <CalendarTab />
      ) : tab === "receipts" ? (
        <ReceiptLog receipts={receipts} />
      ) : tab === "triage" ? (
        <>
          <EmailDumpBox canSyncGmail={canSyncGmail} />
          <BrainDumpBar />
          <TriageList />
        </>
      ) : (
        <TaskBoard selectedParam={project} onSelectProject={(id) => go("tasks", id)} />
      )}
    </>
  );
}
