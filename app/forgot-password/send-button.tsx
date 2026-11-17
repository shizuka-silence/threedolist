"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

const COOLDOWN_SECONDS = 60; // matches Supabase's per-address limit on reset emails

// After a send, locks the button with a countdown so a nervous user doesn't mash it.
// shortcut: reloading the page restarts the countdown, fine for a 60s nudge.
export function SendButton({ sent }: { sent: boolean }) {
  const { pending } = useFormStatus();
  const [left, setLeft] = useState(sent ? COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <Button type="submit" size="lg" disabled={pending || left > 0}>
      {pending ? "Sending…" : left > 0 ? `Email sent. Resend in ${left}s` : sent ? "Resend email" : "Email me a reset link"}
    </Button>
  );
}
