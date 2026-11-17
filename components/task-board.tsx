"use client";

import { useDashboard } from "@/components/dashboard-provider";
import { DraggableTask } from "@/components/draggable-task";
import { ProjectDnd } from "@/components/project-dnd";
import { ProjectStrip } from "@/components/project-strip";
import { TaskCard } from "@/components/task-card";
import { filterTasksByProject } from "@/lib/project-rules";

// Folder counts and the visible list are derived from the optimistic tasks, so they move together with any change.
export function TaskBoard({ selected, projects, workspace }: {
  selected: string; // "all" | "unassigned" | project id
  projects: { id: string; name: string; color: string }[];
  workspace: React.ReactNode;
}) {
  const { state } = useDashboard();
  const visible = filterTasksByProject(state.tasks, selected);

  return (
    <ProjectDnd>
      <ProjectStrip
        selected={selected}
        allCount={state.tasks.length}
        unassignedCount={filterTasksByProject(state.tasks, "unassigned").length}
        projects={projects.map((p) => ({ ...p, taskCount: state.tasks.filter((t) => t.projectId === p.id).length }))}
      />
      {workspace}
      <ul className="flex flex-col gap-3">
        {visible.map((task) => (
          <DraggableTask key={task.id} id={task.id}>
            <TaskCard {...task} projects={projects} />
          </DraggableTask>
        ))}
        {visible.length === 0 && <p className="text-muted-foreground">Nothing to do here. Add a task above.</p>}
      </ul>
    </ProjectDnd>
  );
}
