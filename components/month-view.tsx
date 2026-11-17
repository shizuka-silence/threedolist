"use client";

import { useDashboard } from "@/components/dashboard-provider";
import { groupTasksByDay, monthGrid } from "@/lib/calendar-rules";

const MAX_CHIPS = 3;
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// Read-only: tapping a day opens it in the Day view, where scheduling happens.
export function MonthView({ day, today, onOpenDay }: { day: string; today: string; onOpenDay: (day: string) => void }) {
  const { state } = useDashboard();
  const byDay = groupTasksByDay(state.tasks);
  const month = day.slice(0, 7);
  // 2026-11-15 is a Sunday, so these are Sun..Sat headers in the user's locale.
  const weekdayNames = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 15 + i).toLocaleDateString([], { weekday: "short" }));

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[560px] grid-cols-7 border-l border-t">
        {weekdayNames.map((name) => (
          <div key={name} className="border-b border-r py-1 text-center text-xs text-muted-foreground">{name}</div>
        ))}
        {monthGrid(day).map((d) => {
          const tasks = byDay.get(d) ?? [];
          return (
            <button
              key={d}
              type="button"
              onClick={() => onOpenDay(d)}
              aria-label={`${d}, ${tasks.length} scheduled`}
              className={`flex min-h-24 flex-col items-stretch gap-0.5 border-b border-r p-1 text-left ${d.startsWith(month) ? "" : "bg-muted/40 text-muted-foreground"}`}
            >
              <span
                className={`flex size-6 items-center justify-center self-start rounded-full text-xs ${d === today ? "bg-primary text-primary-foreground" : ""}`}
              >
                {Number(d.slice(8))}
              </span>
              {tasks.slice(0, MAX_CHIPS).map((t) => (
                <span key={t.id} className="truncate rounded bg-primary/15 px-1 text-[11px] leading-tight text-foreground">
                  {timeLabel(t.scheduledStart!)} {t.title}
                </span>
              ))}
              {tasks.length > MAX_CHIPS && <span className="px-1 text-[11px] text-muted-foreground">+{tasks.length - MAX_CHIPS} more</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
