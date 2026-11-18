"use client";

import { useState } from "react";
import { AddTaskForm } from "@/components/add-task-form";
import { useDashboard } from "@/components/dashboard-provider";
import { DraggableTask } from "@/components/draggable-task";
import { ProjectDnd } from "@/components/project-dnd";
import { ProjectStrip } from "@/components/project-strip";
import { ProjectWorkspace } from "@/components/project-workspace";
import { Pagination } from "@/components/pagination";
import { TaskCard } from "@/components/task-card";
import { paginate } from "@/lib/pagination";
import { filterTasksByProject } from "@/lib/project-rules";

// Folder counts and the visible list are derived from dashboard state, so they move together with any change.
export function TaskBoard({ selectedParam, onSelectProject }: { selectedParam?: string; onSelectProject: (id: string) => void }) {
  const { state } = useDashboard();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null); // last-touched card
  const selectedProject = state.projects.find((p) => p.id === selectedParam);
  // Unknown ids (deleted project, hand-edited URL) fall back to "all".
  const selected = selectedParam === "unassigned" || selectedProject ? selectedParam! : "all";
  const [page, setPage] = useState(1);
  const [pageFor, setPageFor] = useState(selected);
  if (pageFor !== selected) { setPageFor(selected); setPage(1); } // new folder starts at page 1
  const { items: visible, page: currentPage, pageCount } = paginate(filterTasksByProject(state.tasks, selected), page);

  return (
    <ProjectDnd>
      <ProjectStrip
        selected={selected}
        onSelect={onSelectProject}
        allCount={state.tasks.length}
        unassignedCount={filterTasksByProject(state.tasks, "unassigned").length}
        projects={state.projects.map((p) => ({ ...p, taskCount: state.tasks.filter((t) => t.projectId === p.id).length }))}
      />
      <AddTaskForm projectId={selectedProject?.id ?? null} />
      {selectedProject && <ProjectWorkspace projectId={selectedProject.id} name={selectedProject.name} color={selectedProject.color} />}
      <ul className="flex flex-col gap-3">
        {visible.map((task) => (
          <DraggableTask key={task.id} id={task.id} ids={visible.map((t) => t.id)}>
            <TaskCard
              {...task} projects={state.projects} hideProject={!!selectedProject}
              active={task.id === activeTaskId} onActivate={() => setActiveTaskId(task.id)}
            />
          </DraggableTask>
        ))}
        {visible.length === 0 && <p className="text-muted-foreground">Nothing to do here. Add a task above.</p>}
      </ul>
      <Pagination page={currentPage} pageCount={pageCount} onPage={setPage} />
    </ProjectDnd>
  );
}
