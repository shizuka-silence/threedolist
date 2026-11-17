"use client";

import { useDashboard } from "@/components/dashboard-provider";
import { DraggableTask } from "@/components/draggable-task";
import { ProjectDnd } from "@/components/project-dnd";
import { ProjectStrip } from "@/components/project-strip";
import { ProjectWorkspace } from "@/components/project-workspace";
import { TaskCard } from "@/components/task-card";
import { filterTasksByProject } from "@/lib/project-rules";

// Folder counts and the visible list are derived from dashboard state, so they move together with any change.
export function TaskBoard({ selectedParam, onSelectProject }: { selectedParam?: string; onSelectProject: (id: string) => void }) {
  const { state } = useDashboard();
  const selectedProject = state.projects.find((p) => p.id === selectedParam);
  // Unknown ids (deleted project, hand-edited URL) fall back to "all".
  const selected = selectedParam === "unassigned" || selectedProject ? selectedParam! : "all";
  const visible = filterTasksByProject(state.tasks, selected);

  return (
    <ProjectDnd>
      <ProjectStrip
        selected={selected}
        onSelect={onSelectProject}
        allCount={state.tasks.length}
        unassignedCount={filterTasksByProject(state.tasks, "unassigned").length}
        projects={state.projects.map((p) => ({ ...p, taskCount: state.tasks.filter((t) => t.projectId === p.id).length }))}
      />
      {selectedProject && <ProjectWorkspace projectId={selectedProject.id} name={selectedProject.name} color={selectedProject.color} />}
      <ul className="flex flex-col gap-3">
        {visible.map((task) => (
          <DraggableTask key={task.id} id={task.id}>
            <TaskCard {...task} projects={state.projects} hideProject={!!selectedProject} />
          </DraggableTask>
        ))}
        {visible.length === 0 && <p className="text-muted-foreground">Nothing to do here. Add a task above.</p>}
      </ul>
    </ProjectDnd>
  );
}
