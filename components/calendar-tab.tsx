"use client";

import { useEffect, useState } from "react";
import { DayCalendar } from "@/components/day-calendar";
import { MonthView } from "@/components/month-view";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { shiftDate, toDayStr, weekDays } from "@/lib/calendar-rules";

type View = "day" | "week" | "month";
const VIEWS: View[] = ["day", "week", "month"];

const fromDayStr = (day: string) => new Date(`${day}T12:00`); // noon avoids DST edge cases when only the date is shown

function rangeLabel(view: View, day: string) {
  if (view === "day") return fromDayStr(day).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  if (view === "month") return fromDayStr(day).toLocaleDateString([], { month: "long", year: "numeric" });
  const days = weekDays(day);
  const short = (d: string) => fromDayStr(d).toLocaleDateString([], { month: "short", day: "numeric" });
  return `${short(days[0])} – ${short(days[6])}`;
}

// Scheduling only happens in the Day view; Week and Month are read-only overviews that open a day when clicked.
export function CalendarTab() {
  const [view, setView] = useState<View>("day");
  const [today, setToday] = useState(""); // set after mount so server and browser agree on the date
  const [picked, setDay] = useState<string | null>(null); // null = follow today
  const day = picked ?? today;

  useEffect(() => setToday(toDayStr(new Date())), []);
  if (!day) return <p className="text-muted-foreground">Loading…</p>;

  const openDay = (next: string) => {
    setDay(next);
    setView("day");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Calendar view" className="flex overflow-hidden rounded-md border">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`h-10 px-4 text-sm font-medium capitalize ${view === v ? "bg-primary text-primary-foreground" : ""}`}
            >
              {v}
            </button>
          ))}
        </div>
        <Button variant="outline" className="h-10" onClick={() => setDay(today)}>Today</Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setDay(shiftDate(day, view, -1))} aria-label={`Previous ${view}`} className="h-10">‹</Button>
        <p className="font-medium">{rangeLabel(view, day)}</p>
        <Button variant="outline" onClick={() => setDay(shiftDate(day, view, 1))} aria-label={`Next ${view}`} className="h-10">›</Button>
      </div>

      {view === "day" ? (
        <DayCalendar day={day} />
      ) : view === "week" ? (
        <WeekView day={day} today={today} onOpenDay={openDay} />
      ) : (
        <MonthView day={day} today={today} onOpenDay={openDay} />
      )}
    </div>
  );
}
