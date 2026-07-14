-- =============================================================
-- HireIQX Sales CRM — Tasks rework + Notes module
-- Run this in the Supabase SQL Editor (single execution),
-- after 001_initial_schema.sql and 002_companies.sql.
-- =============================================================

-- -------------------------------------------------------------
-- ALTER: tasks
-- -------------------------------------------------------------

alter table public.tasks
  add column company_id uuid references public.companies(id),
  add column contact_id uuid references public.contacts(id),
  add column task_type text check (task_type in ('Call', 'Email', 'Text', 'Social Media')),
  add column task_status text check (task_status in ('Open', 'Complete')) default 'Open',
  add column notes text;

alter table public.tasks drop column title;

create index tasks_company_id_idx on public.tasks (company_id);
create index tasks_contact_id_idx on public.tasks (contact_id);

-- -------------------------------------------------------------
-- TABLE: notesa
-- -------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  contact_id uuid references public.contacts(id),
  deal_id uuid references public.deals(id),
  task_id uuid references public.tasks(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create index notes_contact_id_idx on public.notes (contact_id);
create index notes_deal_id_idx on public.notes (deal_id);
create index notes_task_id_idx on public.notes (task_id);

-- -------------------------------------------------------------
-- ROW LEVEL SECURITY: notes
-- -------------------------------------------------------------

alter table public.notes enable row level security;

create policy "notes_select" on public.notes
  for select to authenticated
  using (true);

create policy "notes_insert" on public.notes
  for insert to authenticated
  with check (true);

-- -------------------------------------------------------------
-- ROW LEVEL SECURITY: tasks (updated)
-- -------------------------------------------------------------
-- Tasks may now stand alone against a company/contact (no deal_id),
-- so access is no longer purely deal-derived: a task is visible if
-- it's tied to a deal the user can access, or assigned to the user,
-- or the user is an admin.

drop policy if exists "tasks_select" on public.tasks;
drop policy if exists "tasks_insert" on public.tasks;
drop policy if exists "tasks_update" on public.tasks;
drop policy if exists "tasks_delete" on public.tasks;

create policy "tasks_select" on public.tasks
  for select to authenticated
  using (
    (deal_id is not null and public.can_access_deal(deal_id))
    or assigned_to = auth.uid()
    or public.is_admin()
  );

create policy "tasks_insert" on public.tasks
  for insert to authenticated
  with check (
    (deal_id is not null and public.can_access_deal(deal_id))
    or assigned_to = auth.uid()
    or public.is_admin()
  );

create policy "tasks_update" on public.tasks
  for update to authenticated
  using (
    (deal_id is not null and public.can_access_deal(deal_id))
    or assigned_to = auth.uid()
    or public.is_admin()
  )
  with check (
    (deal_id is not null and public.can_access_deal(deal_id))
    or assigned_to = auth.uid()
    or public.is_admin()
  );

create policy "tasks_delete" on public.tasks
  for delete to authenticated
  using (
    (deal_id is not null and public.can_access_deal(deal_id))
    or assigned_to = auth.uid()
    or public.is_admin()
  );

-- -------------------------------------------------------------
-- GRANTS
-- -------------------------------------------------------------

grant select, insert, update, delete on public.notes, public.tasks to authenticated;
grant all on public.notes, public.tasks to service_role;
