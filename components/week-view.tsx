"use client";

import { useDashboard } from "@/components/dashboard-provider";
import { computeBlockHeightPx, continuedSegments, projectTint, weekDays } from "@/lib/calendar-rules";

const PX_PER_HOUR = 40;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });

// Read-only: no drag, no schedule buttons. Clicking a day or a block opens that day, where scheduling happens.
export function WeekView({ day, today, onOpenDay }: { day: string; today: string; onOpenDay: (day: string) => void }) {
  const { state } = useDashboard();
  const days = weekDays(day);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <div className="flex border-b">
          <div className="w-12 shrink-0" />
          {days.map((d) => {
            const date = new Date(`${d}T12:00`);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onOpenDay(d)}
                className={`flex-1 py-2 text-center text-sm ${d === today ? "font-semibold text-primary" : ""}`}
              >
                {date.toLocaleDateString([], { weekday: "short" })} <span className="opacity-70">{date.getDate()}</span>
              </button>
            );
          })}
        </div>

        <div className="flex">
          <div className="w-12 shrink-0">
            {HOURS.map((h) => (
              <div key={h} style={{ height: PX_PER_HOUR }} className="pr-1 text-right text-xs text-muted-foreground">{h === 0 ? "" : hourLabel(h)}</div>
            ))}
          </div>
          {days.map((d) => (
            <div key={d} className={`relative flex-1 border-l ${d === today ? "bg-primary/5" : ""}`}>
              {HOURS.map((h) => <div key={h} style={{ height: PX_PER_HOUR }} className="border-t" />)}
              {state.tasks.flatMap((t) =>
                t.scheduledStart ? continuedSegments(new Date(t.scheduledStart), t.estimatedMinutes).filter(({ seg }) => seg.day === d).map((s) => ({ t, ...s })) : [],
              ).map(({ t, seg, fromPrev, toNext }) => {
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onOpenDay(d)}
                    title={t.title}
                    style={{ ...projectTint(state.projects.find((p) => p.id === t.projectId)?.color), top: (seg.topMinutes / 60) * PX_PER_HOUR, height: computeBlockHeightPx(seg.minutes, PX_PER_HOUR) }}
                    className={`absolute inset-x-0.5 overflow-hidden rounded-md border bg-primary/15 px-1 text-left text-xs leading-tight ${fromPrev ? "border-t-0 rounded-t-none" : ""} ${toNext ? "border-b-0 rounded-b-none" : ""}`}
                  >
                    {t.title}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
