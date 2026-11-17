"use client";

import { useDndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { useState } from "react";
import { createProject } from "@/app/actions/projects";
import { useDashboard } from "@/components/dashboard-provider";
import { validateProjectInput } from "@/lib/project-rules";
import { Button } from "@/components/ui/button";

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
  const [name, setName] = useState("");
  const { run } = useDashboard();
  const activeId = useDndContext().active?.id;
  const draggedIndex = projects.findIndex((p) => `folder:${p.id}` === activeId); // -1 when nothing, or a task, is dragged

  function add(event: React.FormEvent) {
    event.preventDefault();
    let valid;
    try {
      valid = validateProjectInput(name); // same checks the server makes, so the folder can appear at once
    } catch (e) {
      run(null, async () => ({ error: (e as Error).message }));
      return;
    }
    const project = { id: crypto.randomUUID(), ...valid };
    const saved = name;
    setName("");
    run({ type: "project/upsert", project }, async () => {
      const result = await createProject(saved, valid.color, project.id);
      if (result.error) setName((current) => current || saved);
      return result;
    });
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
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
        {/* Trailing chip so "new project" sits right next to the folders it adds to. */}
        <form onSubmit={add} className="flex shrink-0 gap-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="+ New project"
            aria-label="New project name"
            className="h-10 w-36 rounded-md border border-dashed bg-background px-3 text-sm"
          />
          {name.trim() && <Button type="submit" variant="outline" className="h-10">Add</Button>}
        </form>
      </div>
    </div>
  );
}
