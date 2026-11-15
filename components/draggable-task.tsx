"use client";

import { useDraggable } from "@dnd-kit/core";

// Desktop-only drag handle; on mobile the task card's project picker does the same job.
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
        className="absolute right-1 top-1 z-10 hidden h-8 w-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:flex"
      >
        ⠿
      </button>
      {children}
    </li>
  );
}
