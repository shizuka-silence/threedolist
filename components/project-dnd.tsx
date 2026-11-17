"use client";

import { DndContext, pointerWithin, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { assignTaskToProject, reorderProjects } from "@/app/actions/projects";
import { useDashboard } from "@/components/dashboard-provider";
import { SmartMouseSensor, SmartTouchSensor } from "@/components/dnd-sensors";
import { moveProject } from "@/lib/project-rules";

// Drop targets are ProjectStrip folders (id "project:<uuid>" or "project:none"). Draggables are tasks (DraggableTask)
// and the folders themselves (id "folder:<uuid>"), which reorder the strip.
export function ProjectDnd({ children }: { children: React.ReactNode }) {
  const { state, run } = useDashboard();
  const sensors = useSensors(
    useSensor(SmartMouseSensor, { activationConstraint: { distance: 8 } }),
    // Long-press to pick up on touch, so a normal swipe still scrolls the page.
    useSensor(SmartTouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    const target = String(over?.id ?? "");
    if (!target.startsWith("project:")) return;
    const projectId = target.slice("project:".length);
    const dragged = String(active.id);
    if (dragged.startsWith("folder:")) {
      if (projectId === "none") return;
      const ids = moveProject(state.projects.map((p) => p.id), dragged.slice("folder:".length), projectId);
      run({ type: "project/reorder", ids }, () => reorderProjects(ids));
      return;
    }
    const taskId = dragged;
    const next = projectId === "none" ? null : projectId;
    run({ type: "task/assign", id: taskId, projectId: next }, () => assignTaskToProject(taskId, next));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  );
}
