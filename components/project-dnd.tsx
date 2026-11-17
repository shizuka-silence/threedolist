"use client";

import { DndContext, MouseSensor, pointerWithin, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { assignTaskToProject } from "@/app/actions/projects";
import { useDashboard } from "@/components/dashboard-provider";

// Drop targets are ProjectStrip folders (id "project:<uuid>" or "project:none"); draggables are DraggableTask.
export function ProjectDnd({ children }: { children: React.ReactNode }) {
  const { run } = useDashboard();
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }));

  function onDragEnd({ active, over }: DragEndEvent) {
    const target = String(over?.id ?? "");
    if (!target.startsWith("project:")) return;
    const projectId = target.slice("project:".length);
    const taskId = String(active.id);
    const next = projectId === "none" ? null : projectId;
    run({ type: "task/assign", id: taskId, projectId: next }, () => assignTaskToProject(taskId, next));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  );
}
