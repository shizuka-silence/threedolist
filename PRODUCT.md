# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
A single user: the developer, using it as a personal tool. Forgetful and friction-averse. They often finish 90% of a task, or upload a proof file, and then forget the final submit step. They use it on desktop and on a phone (installed as a PWA).

## Product Purpose
An anti-forgetfulness, time-reality task app. It makes sure tasks are really finished (proof of work before completion) and shows the gap between estimated and actual time without shaming. Success: nothing is falsely marked done, and estimates get closer to reality over time.

## Positioning
Completion is gated on evidence, and estimate vs. actual time is always visible. Ordinary to-do apps let you tick a box on faith and never show how long things really took.

## Operating Context
- Tasks live in project folders alongside reference files and links.
- Proof is attached in one action: `Ctrl+V` image paste, or mobile camera capture.
- A server-synced focus timer survives phone lock and tab close.
- A day calendar blocks time for tasks (week and month views exist).
- Completed tasks are kept in a searchable Receipt Log.
- An email triage inbox feeds pending items in, via a webhook and a brain-dump/email-dump flow.
- AI Prep (estimate, pitfall subtasks, clarifying questions) runs only when the user clicks it.

## Capabilities and Constraints
- Stack: Next.js 16 App Router, TypeScript, Tailwind + shadcn/ui, Supabase (Postgres, Auth, `proof-uploads` bucket), Drizzle, Vercel AI SDK, `@dnd-kit`.
- Mobile-first. Everything must work in 1 click, 1 tap or `Ctrl+V`; no proof uploads or timers behind multi-step modals.
- Every flow must verify the final step to prevent false completion.
- Completed tasks are never deleted.
- Terminology: "AI Prep", "Receipt Log", "Triage", "Planned vs. Actual".

## Brand Commitments
None established. Name and voice are undecided; do not invent any.

## Evidence on Hand
No testimonials, customers or benchmarks exist. Do not fabricate any.

## Product Principles
1. Prevent false completion: verify the final step, not just the work.
2. Zero friction: one click, one tap or one paste.
3. Truth over optimism: show estimate vs. actual without shaming.
4. On-demand AI only: never run AI unprompted.
5. Never destroy history: completed work stays as a receipt.

## Accessibility & Inclusion
No product-specific requirement established. Baseline: usable one-handed on a phone, with tap targets sized for mobile.
