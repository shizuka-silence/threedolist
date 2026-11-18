"use client";

import { useDndContext, useDraggable, useDroppable } from "@dnd-kit/core";

export const taskDropId = (taskId: string) => `task:${taskId}`;

// Where the dragged task would land relative to this one (matches moveProject: before it when coming from below, after it when coming from above).
// `ids` is the visible list in order. null when nothing is being reordered over this row.
export function useReorderLine(id: string, ids: string[], isOver: boolean): "top" | "bottom" | null {
  const activeId = String(useDndContext().active?.id ?? "");
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(id);
  if (!isOver || from === -1 || from === to) return null;
  return from < to ? "bottom" : "top";
}

export const ReorderLine = ({ side }: { side: "top" | "bottom" | null }) =>
  side && <span className={`pointer-events-none absolute inset-x-0 z-10 h-[3px] rounded-full bg-primary ${side === "top" ? "-top-[7px]" : "-bottom-[7px]"}`} />;

// The whole card is the drag handle (mouse drag, or long-press on touch); the card's project picker is the no-drag fallback.
// Dropping it on another card moves it there; dropping it on a folder assigns it (see ProjectDnd).
export function DraggableTask({ id, ids, children }: { id: string; ids: string[]; children: React.ReactNode }) {
  const { listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: taskDropId(id) });
  const line = useReorderLine(id, ids, isOver);
  return (
    <li
      ref={(node) => { setDragRef(node); setDropRef(node); }}
      {...listeners} // whole card is the handle; SmartMouse/TouchSensor skip inputs and dropdowns
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`relative [-webkit-touch-callout:none] ${isDragging ? "z-10 opacity-80 shadow-lg" : ""}`}
    >
      <ReorderLine side={line} />
      {children}
    </li>
  );
}
