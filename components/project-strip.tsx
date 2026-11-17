"use client";

import { useDndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { createProject } from "@/app/actions/projects";
import { useDashboard } from "@/components/dashboard-provider";
import { DEFAULT_PROJECT_COLOR } from "@/lib/project-rules";

type Props = {
  selected: string; // "all" | "unassigned" | project id
  onSelect: (id: string) => void;
  allCount: number;
  unassignedCount: number;
  projects: { id: string; name: string; color: string; taskCount: number }[];
};

function Folder({ dropId, dragId, onSelect, selected, label, count, color, index, draggedIndex }: {
  dropId?: string; dragId?: string; // dragId set = this folder can be dragged to reorder the strip
  onSelect: () => void; selected: boolean; label: string; count: number; color?: string;
  index?: number; draggedIndex?: number; // draggedIndex is set only while a folder (not a task) is being dragged
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dropId ?? "none", disabled: !dropId });
  const drag = useDraggable({ id: dragId ?? "none", disabled: !dragId });
  const reordering = draggedIndex !== undefined && index !== undefined;
  // The dragged folder lands on this one's spot: after it when coming from the left, before it when coming from the right.
  const lineSide = isOver && reordering && draggedIndex !== index ? (draggedIndex < index ? "-right-[5px]" : "-left-[5px]") : null;
  return (
    <div
      ref={(node) => { setDropRef(node); drag.setNodeRef(node); }}
      {...drag.listeners}
      style={{ transform: drag.transform ? `translate(${drag.transform.x}px, ${drag.transform.y}px)` : undefined, zIndex: drag.isDragging ? 20 : undefined }}
      className={`relative shrink-0 rounded-md [-webkit-touch-callout:none] ${isOver && !reordering ? "ring-2 ring-primary" : ""} ${drag.isDragging ? "opacity-80 shadow-lg" : ""}`}
    >
      {lineSide && <span className={`pointer-events-none absolute inset-y-0 w-[3px] rounded-full bg-primary ${lineSide}`} />}
      <button
        type="button"
        onClick={onSelect}
        className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium ${selected ? "bg-primary text-primary-foreground" : ""}`}
      >
        {color && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />}
        {label} <span className="opacity-70">{count}</span>
      </button>
    </div>
  );
}

export function ProjectStrip({ selected, onSelect, allCount, unassignedCount, projects }: Props) {
  const { run } = useDashboard();
  const activeId = useDndContext().active?.id;
  const draggedIndex = projects.findIndex((p) => `folder:${p.id}` === activeId); // -1 when nothing, or a task, is dragged

  // Creates "New project" and opens it, where the name field is ready to be renamed.
  function add() {
    const project = { id: crypto.randomUUID(), name: "New project", color: DEFAULT_PROJECT_COLOR };
    onSelect(project.id);
    run({ type: "project/upsert", project }, () => createProject(project.name, project.color, project.id));
  }

  return (
    <div className="flex items-start gap-2">
      {/* Only the folders scroll; the + button stays pinned at the right. */}
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
        <Folder onSelect={() => onSelect("all")} selected={selected === "all"} label="All" count={allCount} />
        <Folder
          dropId="project:none" onSelect={() => onSelect("unassigned")} selected={selected === "unassigned"}
          label="Unassigned" count={unassignedCount}
        />
        {projects.map((p, i) => (
          <Folder
            key={p.id} dropId={`project:${p.id}`} dragId={`folder:${p.id}`} onSelect={() => onSelect(p.id)} selected={selected === p.id}
            label={p.name} count={p.taskCount} color={p.color} index={i} draggedIndex={draggedIndex >= 0 ? draggedIndex : undefined}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        aria-label="New project"
        title="New project"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed text-xl leading-none"
      >
        +
      </button>
    </div>
  );
}
