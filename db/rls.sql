-- Run once in the Supabase SQL editor. Safe to re-run.
-- Applies to requests made with the Supabase client (anon/authenticated roles).
-- NOTE: Drizzle connects as the `postgres` role, which BYPASSES RLS, so every
-- Drizzle query must filter by the signed-in user's id itself.

-- Tables with their own user_id ------------------------------------------------

alter table projects enable row level security;
drop policy if exists "owner full access" on projects;
create policy "owner full access" on projects
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table triage_items enable row level security;
drop policy if exists "owner full access" on triage_items;
create policy "owner full access" on triage_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A task may only point at a project the same user owns (or no project).
alter table tasks enable row level security;
drop policy if exists "owner full access" on tasks;
create policy "owner full access" on tasks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      project_id is null
      or exists (select 1 from projects p where p.id = tasks.project_id and p.user_id = (select auth.uid()))
    )
  );

-- Child tables: ownership comes from the parent row ----------------------------

alter table project_files enable row level security;
drop policy if exists "owner full access" on project_files;
create policy "owner full access" on project_files
  for all to authenticated
  using (exists (select 1 from projects p where p.id = project_files.project_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from projects p where p.id = project_files.project_id and p.user_id = (select auth.uid())));

alter table task_subtasks enable row level security;
drop policy if exists "owner full access" on task_subtasks;
create policy "owner full access" on task_subtasks
  for all to authenticated
  using (exists (select 1 from tasks t where t.id = task_subtasks.task_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from tasks t where t.id = task_subtasks.task_id and t.user_id = (select auth.uid())));

alter table task_proofs enable row level security;
drop policy if exists "owner full access" on task_proofs;
create policy "owner full access" on task_proofs
  for all to authenticated
  using (exists (select 1 from tasks t where t.id = task_proofs.task_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from tasks t where t.id = task_proofs.task_id and t.user_id = (select auth.uid())));

alter table time_logs enable row level security;
drop policy if exists "owner full access" on time_logs;
create policy "owner full access" on time_logs
  for all to authenticated
  using (exists (select 1 from tasks t where t.id = time_logs.task_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from tasks t where t.id = time_logs.task_id and t.user_id = (select auth.uid())));

-- Storage: private proof bucket; users may only touch files under their own `<user_id>/` folder.
insert into storage.buckets (id, name, public) values ('proof-uploads', 'proof-uploads', false)
  on conflict (id) do nothing;

drop policy if exists "proof-uploads owner access" on storage.objects;
create policy "proof-uploads owner access" on storage.objects
  for all to authenticated
  using (bucket_id = 'proof-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'proof-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
