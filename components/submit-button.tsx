"use client";

import { useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// Stays disabled with a pending label from click until the server action navigates away.
// `clicked` keeps only the pressed button in its pending state when two buttons share one form.
export function SubmitButton({ pendingLabel, children, onClick, ...props }: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);
  const active = pending && clicked;

  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={active}
      onClick={(e) => {
        setClicked(true);
        onClick?.(e);
      }}
      {...props}
    >
      {active ? pendingLabel : children}
    </Button>
  );
}
