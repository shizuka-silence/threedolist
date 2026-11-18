"use client";

import { DndContext, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from "@dnd-kit/core";
import { GripVertical, X } from "lucide-react";
import { useState } from "react";
import type { Receipt } from "@/app/receipts";
import { reorderTasks, scheduleTask, unscheduleTask } from "@/app/actions/tasks";
import { useDashboard } from "@/components/dashboard-provider";
import { ReorderLine, taskDropId, useReorderLine } from "@/components/draggable-task";
import { moveProject } from "@/lib/project-rules";
import { SmartMouseSensor, SmartTouchSensor } from "@/components/dnd-sensors";
import { Button } from "@/components/ui/button";
import { buildSlotTimestamp, computeBlockHeightPx, continuedSegments, doneBlocks, formatVarianceBadge, projectTint, toDayStr } from "@/lib/calendar-rules";

type CalendarTask = {
  id: string;
  title: string;
  projectId: string | null;
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

// Reordering rows ("task:<id>") follow the pointer; time slots follow the dragged box's top edge, so where you grab it doesn't matter.
const topEdgeCollision: CollisionDetection = (args) => {
  const isRow = (c: { id: string | number }) => String(c.id).startsWith("task:");
  const rows = pointerWithin({ ...args, droppableContainers: args.droppableContainers.filter(isRow) });
  if (rows.length) return rows;
  const top = args.collisionRect.top;
  return args.droppableContainers
    .filter((c) => !isRow(c) && (({ top: t, bottom: b }) => t <= top && top < b)(args.droppableRects.get(c.id) ?? { top: 0, bottom: 0 }))
    .map((c) => ({ id: c.id }));
};

const slotId =(hour: number, minute: number) => `${hour}:${minute}`;
const timeLabel = (h: number, m: number) => new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// Scheduling lives only here; the week and month views are read-only. `day` comes from CalendarTab.
export function DayCalendar({ day, receipts }: { day: string; receipts: Receipt[] }) {
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
    const activeId = String(active.id);
    if (String(over.id).startsWith("task:")) {
      // Dropped on a "To schedule" row: reorder (only unscheduled rows move there; a block dropped on a row does nothing).
      if (!unscheduled.some((t) => t.id === activeId)) return;
      const ids = moveProject(tasks.map((t) => t.id), activeId, String(over.id).slice("task:".length));
      run({ type: "task/reorder", ids }, () => reorderTasks(ids));
      return;
    }
    const [hour, minute] = String(over.id).split(":").map(Number);
    schedule(activeId, hour, minute);
  }

  const startOf = (t: CalendarTask) => new Date(t.scheduledStart!);
  // One block per task per day it covers: a block running past midnight continues at the top of the next day.
  const todays = tasks.flatMap((t) =>
    t.scheduledStart ? continuedSegments(startOf(t), t.estimatedMinutes).filter(({ seg }) => seg.day === day).map((s) => ({ task: t, ...s })) : [],
  );
  const unscheduled = tasks.filter((t) => !t.scheduledStart && t.estimatedMinutes);
  const noEstimate = tasks.filter((t) => !t.scheduledStart && !t.estimatedMinutes).length;
  // Finished work: server receipts (real timer sessions) plus tasks completed this session, which have no sessions yet.
  const sessionDone = state.completedTasks.filter((t) => !receipts.some((r) => r.id === t.id)).map((t) => ({ ...t, sessions: [] }));
  const dones = [...receipts, ...sessionDone].flatMap(doneBlocks).filter((b) => toDayStr(b.start) === day);
  const hasElsewhere = tasks.some((t) => t.scheduledStart) && todays.length === 0;

  return (
    <DndContext sensors={sensors} collisionDetection={topEdgeCollision} onDragEnd={onDragEnd}>
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="mb-2 font-medium">To schedule</h2>
          <ul className="flex flex-col gap-2">
            {unscheduled.map((t) => <UnscheduledRow key={t.id} task={t} ids={unscheduled.map((u) => u.id)} onPick={() => setPicking(t)} />)}
            {unscheduled.length === 0 && <p className="text-sm text-muted-foreground">No unscheduled tasks with an estimate.</p>}
          </ul>
          {noEstimate > 0 && <p className="mt-2 text-sm text-muted-foreground">{noEstimate} task(s) need an estimate before they can be scheduled.</p>}
        </div>

        <div className="relative" style={{ height: SLOTS.length * (PX_PER_HOUR / 2) }}>
          {SLOTS.map(({ hour, minute }) => <Slot key={slotId(hour, minute)} hour={hour} minute={minute} />)}
          {todays.map(({ task: t, seg, fromPrev, toNext }) => (
            <Block
              key={t.id}
              task={t}
              fromPrev={fromPrev}
              toNext={toNext}
              top={((seg.topMinutes - FIRST_HOUR * 60) / 60) * PX_PER_HOUR}
              minutes={seg.minutes}
              color={state.projects.find((p) => p.id === t.projectId)?.color}
              onUnschedule={() => run({ type: "task/unschedule", id: t.id }, () => unscheduleTask(t.id))}
            />
          ))}
          {dones.map((b, i) => <DoneBlock key={`${b.id}-${i}`} block={b} />)}
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

function UnscheduledRow({ task, ids, onPick }: { task: CalendarTask; ids: string[]; onPick: () => void }) {
  const drag = useDragProps(task.id);
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: taskDropId(task.id) });
  const line = useReorderLine(task.id, ids, isOver);
  return (
    <li
      {...drag}
      ref={(node) => { drag.ref(node); setDropRef(node); }}
      className="relative flex select-none items-center gap-2 rounded-lg border bg-background p-2 md:cursor-grab [-webkit-touch-callout:none]"
    >
      <ReorderLine side={line} />
      <GripHint />
      <div className="min-w-0 flex-1">
        <p className="truncate">{task.title}</p>
        <p className="text-xs text-muted-foreground">{formatVarianceBadge(task.estimatedMinutes, task.actualMinutes)}</p>
      </div>
      <Button onClick={onPick} className="h-10">Schedule</Button>
    </li>
  );
}

function Block({ task, top, minutes, fromPrev, toNext, color, onUnschedule }: { task: CalendarTask; top: number; minutes: number; fromPrev: boolean; toNext: boolean; color: string | undefined; onUnschedule: () => void }) {
  const drag = useDragProps(task.id);
  // A piece that joins the previous/next day's piece loses that edge's border and rounding.
  const edges = `${fromPrev ? "border-t-0 rounded-t-none" : ""} ${toNext ? "border-b-0 rounded-b-none" : ""}`;
  return (
    <div
      {...drag}
      style={{ ...drag.style, ...projectTint(color), top, height: computeBlockHeightPx(minutes, PX_PER_HOUR) }}
      className={`absolute left-16 right-0 select-none rounded-md border bg-primary/15 text-sm md:cursor-grab [-webkit-touch-callout:none] ${edges}`}
    >
      <div className={`flex h-full items-start gap-1 overflow-hidden rounded-md px-2 py-0.5 pr-10 ${edges}`}>
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

// What actually happened: not draggable. Full width is fine since the past can't be scheduled into.
function DoneBlock({ block }: { block: { title: string; start: Date; minutes: number } }) {
  const top = ((block.start.getHours() * 60 + block.start.getMinutes()) / 60) * PX_PER_HOUR;
  return (
    <div
      style={{ top, height: Math.max((block.minutes / 60) * PX_PER_HOUR, 16) }}
      className="absolute left-16 right-0 overflow-hidden rounded-md border border-emerald-500/40 bg-emerald-500/20 px-2 py-1 text-sm"
    >
      <p className="truncate leading-tight">{block.title}</p>
      <p className="truncate text-xs text-muted-foreground">Done: {block.minutes}m</p>
    </div>
  );
}
