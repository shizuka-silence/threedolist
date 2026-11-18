# Project: ThreeDoList — Anti-Forgetfulness & Time-Reality Task App

Write and structure everything as the long-term solo maintainer who has to debug this codebase six months from now: keep modules small, cohesive, and boringly readable—no premature abstractions, wrapper bloat, or sprawling helper files.

## Core Philosophy (CRITICAL: Follow for all UI/UX decisions)
This app is designed for a **forgetful, friction-averse user**.
1. **Prevent "False Completion":** Users often upload a file or finish 90% of a task and forget to click "Submit." Every UI flow must verify the *final* step.
2. **Zero-Friction Input:** Never hide proof uploads or timers behind multi-step modals. Everything must work in 1 click, 1 tap, or `Ctrl+V`.
3. **Truth Over Optimism:** Expose the gap between *estimated* time and *actual* time spent without shaming the user.

## Tech Stack
- **Framework:** Next.js 16 (App Router, TypeScript, Server Actions, PWA `manifest.ts`)
- **Layout:** Root-level `app/`, `lib/`, and `db/` directories — this repo has no `src/`. The `@/*` alias maps to `./*`.
- **UI:** Tailwind CSS + shadcn/ui (mobile-first responsive)
- **Database & Storage:** Supabase (Postgres + Auth + `proof-uploads` bucket)
- **ORM:** Drizzle ORM (`db/schema.ts`)
- **AI:** Vercel AI SDK (`@ai-sdk/openai` with `createOpenAI({ apiKey: process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL }).chat(process.env.LLM_MODEL!)` and `generateObject` / `Output.object` with Zod schemas)
- **DnD:** `@dnd-kit/core` (desktop) + mobile bottom-sheet actions

## Exact Data Model
- `projects`: `id`, `user_id`, `name`, `color`, `created_at`
- `project_files`: `id`, `project_id`, `file_name`, `file_url`, `created_at` (reference docs/links for the folder)
- `tasks`: `id`, `user_id` (uuid, not null), `project_id` (nullable), `title`, `notes`, `reflection` (text, nullable; written from the Receipt Log), `completion_type` (`'proof'` default | `'tick'`), `status` (`'todo'` | `'scheduled'` | `'completed'`), `estimated_minutes` (int), `actual_minutes` (int, default 0), `scheduled_start` (timestamp, nullable), `active_timer_started_at` (timestamp, nullable), `ai_clarifying_questions` (jsonb), `completed_at` (timestamp, nullable), `created_at`
- `task_subtasks`: `id`, `task_id`, `label`, `is_completed`, `source` (`'user'` | `'ai_pitfall'`)
- `task_proofs`: `id`, `task_id`, `type` (`'image'` | `'file'` | `'url'` | `'note'`), `storage_path_or_url`, `caption`, `created_at`
- `time_logs`: `id`, `task_id`, `started_at`, `ended_at`, `duration_minutes`
- `triage_items`: `id`, `user_id` (uuid, not null), `source_subject`, `summary`, `suggested_action` (e.g., "Reply Yes/No to X"), `status` (`'pending'` | `'accepted'` | `'dismissed'`), `created_at`

## Feature Specifications
1. **Default Proof-of-Work (`completion_type = 'proof'`):**
   - Completing a proof task is blocked until `task_proofs` has >= 1 entry.
   - Support direct `Ctrl+V` / `Cmd+V` image paste anywhere on an active task card.
   - Mobile upload button must include `accept="image/*" capture="environment"` for instant camera proof, compressed client-side via `browser-image-compression`.
2. **Project Folders:**
   - Drag tasks into a Project folder. Each Project view houses its tasks alongside `project_files` (uploaded reference files/links) in one unified workspace.
3. **Manual & AI Time Estimates + AI "Pre-Mortem" Button (Per Task):**
   - `estimated_minutes` is a user-editable integer field on every task card (users can type or edit it manually at any time without using AI).
   - **Strictly On-Demand AI:** Never auto-run AI on task creation. The AI Server Action (`generateObject` / `Output.object` + Zod) runs **only** when the user explicitly clicks the **AI Prep** button on a task.
   - Clicking **AI Prep** returns:
     - `estimated_minutes`: populates `tasks.estimated_minutes` *only if it is currently empty* (do not overwrite a manual estimate the user already entered).
     - `pitfalls`: 2–4 common traps/last-step mistakes, automatically inserted into `task_subtasks` (`source = 'ai_pitfall'`) so the user must check them off.
     - `clarifying_questions`: 2–3 high-leverage questions displayed inline on the task card to resolve ambiguity before starting.
4. **Time-Blocking Calendar & Drift Tracking:**
   - Day-view hourly timeline where tasks with `estimated_minutes` can be dragged onto time slots (visual block height = `estimated_minutes`).
   - Built-in Pomodoro/focus timer synced via `active_timer_started_at` in Postgres (survives phone lock/tab close). Include a quick "Trim idle minutes" slider when stopping.
   - Visually display **Planned vs. Actual** duration badges on scheduled tasks and calendar blocks.
5. **Non-Destructive Receipt Log:**
   - Completed tasks are never deleted. A dedicated **Receipt Log** view displays a searchable history of finished tasks with proof thumbnails, project tags, and `Est: Xm | Actual: Ym` variance badges.
6. **IMAP Email Triage Webhook:**
   - Expose `POST /api/webhooks/triage` secured with a Bearer token (`TRIAGE_API_KEY`) so an external IMAP worker script can push summarized emails into `triage_items`.
   - Render `triage_items` in a collapsible **Inbox Triage Drawer** with 1-click `[Accept -> Create Task]` or `[Dismiss]` buttons so inbox noise never pollutes the main task list.

## Build Sequence
- **Phase 1:** Auth, Projects + reference files, Tasks (`proof` default, `Ctrl+V` + mobile camera upload, subtasks), server-synced Pomodoro timer + `time_logs`, and Receipt Log.
- **Phase 2:** AI Prep button (estimates, pitfall subtasks, clarifying questions) + Day Calendar time-blocking with Planned vs. Actual comparison.
- **Phase 3:** `POST /api/webhooks/triage` endpoint + Inbox Triage Drawer UI.

## Testing & TDD Rules (Core Logic Only)
- Use Vitest (`npm test`, which runs `vitest run` once without watch mode) for all business logic in `lib/` and Server Actions (proof-completion rules, timer/idle-trim math, AI estimate overwrite guards, and webhook auth). Skip unit tests for pure UI/JSX layout components.
- **Strict Red-Green TDD:** For any new business logic, write `*.test.ts` files FIRST, run `npm test` to confirm they fail, and pause so I can commit the tests before you write implementation code. Never alter existing test assertions to make failing code pass.