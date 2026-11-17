import { MouseSensor, TouchSensor, type MouseSensorOptions, type TouchSensorOptions } from "@dnd-kit/core";
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";

// Whole cards are draggable, but typing, sliders, dropdowns and date pickers must never start a drag.
// Buttons and links still can: the mouse distance / touch delay keeps plain clicks working.
const NO_DRAG = "input, textarea, select, [data-no-drag]";
const canDragFrom = (event: Event) => !(event.target as HTMLElement | null)?.closest(NO_DRAG);

// Same as dnd-kit's own activators, plus the canDragFrom check.
export class SmartMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: "onMouseDown" as const,
      handler: ({ nativeEvent: event }: ReactMouseEvent, { onActivation }: MouseSensorOptions) => {
        if (event.button !== 0 || !canDragFrom(event)) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

export class SmartTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: ({ nativeEvent: event }: ReactTouchEvent, { onActivation }: TouchSensorOptions) => {
        if (event.touches.length > 1 || !canDragFrom(event)) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}
