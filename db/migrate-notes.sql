-- One-off. Run AFTER `npm run db:push` has created task_notes.
-- Notes/links used to be stored as proofs; they are reference info, so move them out of task_proofs.
begin;
insert into task_notes (task_id, text, created_at)
  select task_id, storage_path_or_url, created_at from task_proofs where type in ('note', 'url');
delete from task_proofs where type in ('note', 'url');
commit;
