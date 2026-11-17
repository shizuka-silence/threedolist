"use client";

import { useDraggable } from "@dnd-kit/core";

// The whole card is the drag handle (mouse drag, or long-press on touch); the card's project picker is the no-drag fallback.
export function DraggableTask({ id, children }: { id: string; children: React.ReactNode }) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return (
    <li
      ref={setNodeRef}
      {...listeners} // whole card is the handle; SmartMouse/TouchSensor skip inputs and dropdowns
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`relative [-webkit-touch-callout:none] ${isDragging ? "z-10 opacity-80 shadow-lg" : ""}`}
    >
      {children}
    </li>
  );
}
