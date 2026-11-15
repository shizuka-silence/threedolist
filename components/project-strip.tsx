"use client";

import { useDroppable } from "@dnd-kit/core";
import Link from "next/link";
import { useState, useTransition } from "react";
import { createProject } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";

type Props = {
  selected: string; // "all" | "unassigned" | project id
  allCount: number;
  unassignedCount: number;
  projects: { id: string; name: string; color: string; taskCount: number }[];
};

function Folder({ dropId, href, selected, label, count, color }: {
  dropId?: string; href: string; selected: boolean; label: string; count: number; color?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId ?? "none", disabled: !dropId });
  return (
    <div ref={setNodeRef} className={`shrink-0 rounded-md ${isOver ? "ring-2 ring-primary" : ""}`}>
      <Link
        href={href}
        className={`flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium ${selected ? "bg-primary text-primary-foreground" : ""}`}
      >
        {color && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />}
        {label} <span className="opacity-70">{count}</span>
      </Link>
    </div>
  );
}

export function ProjectStrip({ selected, allCount, unassignedCount, projects }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createProject(name);
      setError(result.error ?? null);
      if (!result.error) setName("");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Folder href="/" selected={selected === "all"} label="All" count={allCount} />
        <Folder
          dropId="project:none" href="/?project=unassigned" selected={selected === "unassigned"}
          label="Unassigned" count={unassignedCount}
        />
        {projects.map((p) => (
          <Folder
            key={p.id} dropId={`project:${p.id}`} href={`/?project=${p.id}`} selected={selected === p.id}
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
        <Button type="submit" variant="outline" disabled={pending}>Create</Button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
