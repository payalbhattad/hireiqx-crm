-- =============================================================
-- HireIQX Sales CRM — Pipeline overhaul
-- Run this in the Supabase SQL Editor (single execution),
-- after 001_initial_schema.sql, 002_companies.sql, and
-- 003_tasks_notes.sql.
-- =============================================================

-- -------------------------------------------------------------
-- STAGE: drop old constraint, migrate data, add new constraint
-- -------------------------------------------------------------

alter table public.deals drop constraint if exists deals_stage_check;

update public.deals set stage = 'lead'
  where stage = 'new_lead' or stage = 'contacted';
update public.deals set stage = 'demo_scheduled'
  where stage = 'demo_scheduled';
update public.deals set stage = 'decision_pending'
  where stage = 'proposal_sent' or stage = 'negotiating';
update public.deals set stage = 'closed'
  where stage = 'closed_won' or stage = 'closed_lost';

alter table public.deals
  add constraint deals_stage_check check (stage in (
    'lead', 'demo_scheduled', 'decision_pending', 'closed'
  ));

-- -------------------------------------------------------------
-- ALTER: deals — new fields
-- -------------------------------------------------------------

alter table public.deals
  add column num_seats integer,
  add column estimated_arr numeric,
  add column arr_override boolean default false,
  add column demo_date date,
  add column decision_criteria text check (decision_criteria in (
    'Budget', 'Timing', 'Competition', 'Approval'
  )),
  add column outcome text check (outcome in ('Won', 'Lost')),
  add column lost_reason text check (lost_reason in (
    'Budget', 'Timing', 'Competition', 'Approval'
  )),
  add column followup_date date,
  add column plan_selected text,
  add column kickoff_date date,
  add column founder_notified boolean default false;

alter table public.deals drop column value;

-- Keep estimated_arr in sync with num_seats unless the user has
-- explicitly overridden it (arr_override = true).
create or replace function public.set_estimated_arr()
returns trigger
language plpgsql
as $$
begin
  if new.arr_override is not true then
    new.estimated_arr = coalesce(new.num_seats, 0) * 500;
  end if;
  return new;
end;
$$;

create trigger deals_set_estimated_arr
  before insert or update on public.deals
  for each row execute function public.set_estimated_arr();

-- -------------------------------------------------------------
-- GRANTS
-- -------------------------------------------------------------

grant select, insert, update, delete on public.deals to authenticated;
grant all on public.deals to service_role;
