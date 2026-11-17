"use client";

import { useDraggable } from "@dnd-kit/core";

// Drag handle (mouse drag, or long-press on touch); the card's project picker is the no-drag fallback.
export function DraggableTask({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return (
    <li
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`relative ${isDragging ? "z-10 opacity-80 shadow-lg" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to a project folder"
        className="absolute right-1 top-1 z-10 flex h-8 w-8 cursor-grab touch-none select-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted [-webkit-touch-callout:none]"
      >
        ⠿
      </button>
      {children}
    </li>
  );
}
