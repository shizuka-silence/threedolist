"use client";

import { useDroppable } from "@dnd-kit/core";
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

function Folder({ dropId, onSelect, selected, label, count, color }: {
  dropId?: string; onSelect: () => void; selected: boolean; label: string; count: number; color?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId ?? "none", disabled: !dropId });
  return (
    <div ref={setNodeRef} className={`shrink-0 rounded-md ${isOver ? "ring-2 ring-primary" : ""}`}>
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
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Folder onSelect={() => onSelect("all")} selected={selected === "all"} label="All" count={allCount} />
        <Folder
          dropId="project:none" onSelect={() => onSelect("unassigned")} selected={selected === "unassigned"}
          label="Unassigned" count={unassignedCount}
        />
        {projects.map((p) => (
          <Folder
            key={p.id} dropId={`project:${p.id}`} onSelect={() => onSelect(p.id)} selected={selected === p.id}
            label={p.name} count={p.taskCount} color={p.color}
          />
        ))}
      </div>
      <form onSubmit={add} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="+ New Project"
          aria-label="New project name"
          className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-base"
        />
        <Button type="submit" variant="outline">Create</Button>
      </form>
    </div>
  );
}
