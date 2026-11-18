"use client";

import { DndContext, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { GripVertical, X } from "lucide-react";
import { useState } from "react";
import { scheduleTask, unscheduleTask } from "@/app/actions/tasks";
import { useDashboard } from "@/components/dashboard-provider";
import { SmartMouseSensor, SmartTouchSensor } from "@/components/dnd-sensors";
import { Button } from "@/components/ui/button";
import { buildSlotTimestamp, computeBlockHeightPx, formatVarianceBadge, toDayStr } from "@/lib/calendar-rules";

type CalendarTask = {
  id: string;
  title: string;
  estimatedMinutes: number | null;
  actualMinutes: number;
  scheduledStart: string | null; // ISO; rendered in the browser's timezone
};

const FIRST_HOUR = 0;
const LAST_HOUR = 24; // whole day; the last slot is 11:30 PM
const PX_PER_HOUR = 64;
const SLOTS = Array.from({ length: (LAST_HOUR - FIRST_HOUR) * 2 }, (_, i) => ({
  hour: FIRST_HOUR + Math.floor(i / 2),
  minute: (i % 2) * 30,
}));

const slotId = (hour: number, minute: number) => `${hour}:${minute}`;
const timeLabel = (h: number, m: number) => new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// Scheduling lives only here; the week and month views are read-only. `day` comes from CalendarTab.
export function DayCalendar({ day }: { day: string }) {
  const { state, run } = useDashboard();
  const tasks: CalendarTask[] = state.tasks;
  const [picking, setPicking] = useState<CalendarTask | null>(null);

  // Small mouse threshold so button clicks still work; touch needs a long-press so swipes still scroll.
  const sensors = useSensors(
    useSensor(SmartMouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(SmartTouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function schedule(taskId: string, hour: number, minute: number) {
    const start = buildSlotTimestamp(day, hour, minute);
    run({ type: "task/schedule", id: taskId, start: start.toISOString() }, () => scheduleTask(taskId, start));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const [hour, minute] = String(over.id).split(":").map(Number);
    schedule(String(active.id), hour, minute);
  }

  const startOf = (t: CalendarTask) => new Date(t.scheduledStart!);
  const todays = tasks.filter((t) => t.scheduledStart && toDayStr(startOf(t)) === day);
  const unscheduled = tasks.filter((t) => !t.scheduledStart && t.estimatedMinutes);
  const noEstimate = tasks.filter((t) => !t.scheduledStart && !t.estimatedMinutes).length;
  const hasElsewhere = tasks.some((t) => t.scheduledStart) && todays.length === 0;

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="mb-2 font-medium">To schedule</h2>
          <ul className="flex flex-col gap-2">
            {unscheduled.map((t) => <UnscheduledRow key={t.id} task={t} onPick={() => setPicking(t)} />)}
            {unscheduled.length === 0 && <p className="text-sm text-muted-foreground">No unscheduled tasks with an estimate.</p>}
          </ul>
          {noEstimate > 0 && <p className="mt-2 text-sm text-muted-foreground">{noEstimate} task(s) need an estimate before they can be scheduled.</p>}
        </div>

        <div className="relative" style={{ height: SLOTS.length * (PX_PER_HOUR / 2) }}>
          {SLOTS.map(({ hour, minute }) => <Slot key={slotId(hour, minute)} hour={hour} minute={minute} />)}
          {todays.map((t) => {
            const start = startOf(t);
            const minutesFromTop = (start.getHours() - FIRST_HOUR) * 60 + start.getMinutes();
            return (
              <Block
                key={t.id}
                task={t}
                top={(minutesFromTop / 60) * PX_PER_HOUR}
                onUnschedule={() => run({ type: "task/unschedule", id: t.id }, () => unscheduleTask(t.id))}
              />
            );
          })}
        </div>
        {hasElsewhere && <p className="text-sm text-muted-foreground">Nothing scheduled for this day; other days have blocks.</p>}
      </section>

      {picking && (
        <div role="dialog" aria-label={`Schedule ${picking.title}`} className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 rounded-t-xl border-t bg-background p-4 shadow-lg">
          <p className="font-medium">Schedule “{picking.title}”</p>
          <select
            defaultValue=""
            aria-label="Start time"
            className="h-12 w-full rounded-md border bg-background px-3 text-base"
            onChange={(e) => {
              const [hour, minute] = e.target.value.split(":").map(Number);
              schedule(picking.id, hour, minute);
              setPicking(null);
            }}
          >
            <option value="" disabled>Pick a start time…</option>
            {SLOTS.map(({ hour, minute }) => <option key={slotId(hour, minute)} value={slotId(hour, minute)}>{timeLabel(hour, minute)}</option>)}
          </select>
          <Button variant="outline" onClick={() => setPicking(null)} className="h-10">Cancel</Button>
        </div>
      )}
    </DndContext>
  );
}

function Slot({ hour, minute }: { hour: number; minute: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(hour, minute) });
  return (
    <div
      ref={setNodeRef}
      style={{ height: PX_PER_HOUR / 2 }}
      className={`flex border-t text-xs text-muted-foreground ${minute === 0 ? "" : "border-dashed"} ${isOver ? "bg-primary/10" : ""}`}
    >
      <span className="w-16 shrink-0 pt-0.5">{minute === 0 ? timeLabel(hour, 0) : ""}</span>
    </div>
  );
}

// Whole card is the drag source; the grip icon is just a hint that it can be dragged.
function useDragProps(id: string) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return {
    ref: setNodeRef,
    ...attributes,
    ...listeners,
    style: { transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined, zIndex: isDragging ? 30 : undefined },
  };
}

const GripHint = () => <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />;

function UnscheduledRow({ task, onPick }: { task: CalendarTask; onPick: () => void }) {
  const drag = useDragProps(task.id);
  return (
    <li {...drag} className="flex select-none items-center gap-2 rounded-lg border bg-background p-2 md:cursor-grab [-webkit-touch-callout:none]">
      <GripHint />
      <div className="min-w-0 flex-1">
        <p className="truncate">{task.title}</p>
        <p className="text-xs text-muted-foreground">{formatVarianceBadge(task.estimatedMinutes, task.actualMinutes)}</p>
      </div>
      <Button onClick={onPick} className="h-10">Schedule</Button>
    </li>
  );
}

function Block({ task, top, onUnschedule }: { task: CalendarTask; top: number; onUnschedule: () => void }) {
  const drag = useDragProps(task.id);
  return (
    <div
      {...drag}
      style={{ ...drag.style, top, height: computeBlockHeightPx(task.estimatedMinutes, PX_PER_HOUR) }}
      className="absolute left-16 right-0 select-none rounded-md border bg-primary/15 text-sm md:cursor-grab [-webkit-touch-callout:none]"
    >
      <div className="flex h-full items-start gap-1 overflow-hidden rounded-md px-2 py-1 pr-10">
        <GripHint />
        <div className="min-w-0 flex-1">
          <p className="truncate leading-tight">{task.title}</p>
          <p className="truncate text-xs text-muted-foreground">{formatVarianceBadge(task.estimatedMinutes, task.actualMinutes)}</p>
        </div>
      </div>
      {/* Centered on the block and outside its clipping wrapper, so it stays clickable even on 15-minute blocks. */}
      <button
        onClick={onUnschedule}
        aria-label={`Unschedule ${task.title}`}
        className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md bg-background/80 hover:bg-background"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
