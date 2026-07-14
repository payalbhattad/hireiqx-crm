-- =============================================================
-- HireIQX Sales CRM — initial schema
-- Run this in the Supabase SQL Editor (single execution).
-- =============================================================

-- -------------------------------------------------------------
-- TABLES
-- -------------------------------------------------------------

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  role text check (role in ('admin', 'rep')) default 'rep',
  created_at timestamptz default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company text,
  email text unique,
  phone text,
  title text,
  source text check (source in ('inbound', 'outbound', 'referral', 'apollo')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  contact_id uuid references public.contacts(id),
  value numeric default 0,
  stage text check (stage in (
    'new_lead', 'contacted', 'demo_scheduled',
    'proposal_sent', 'negotiating',
    'closed_won', 'closed_lost'
  )) default 'new_lead',
  assigned_to uuid references public.profiles(id),
  expected_close_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  type text check (type in ('call', 'email', 'note', 'meeting')),
  body text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  title text not null,
  due_date date,
  assigned_to uuid references public.profiles(id),
  completed boolean default false,
  created_at timestamptz default now()
);

create index deals_assigned_to_idx on public.deals (assigned_to);
create index deals_stage_idx on public.deals (stage);
create index activities_deal_id_idx on public.activities (deal_id);
create index tasks_deal_id_idx on public.tasks (deal_id);
create index tasks_assigned_to_idx on public.tasks (assigned_to);

-- -------------------------------------------------------------
-- HELPER FUNCTIONS
-- -------------------------------------------------------------

-- Admin check. SECURITY DEFINER so it can read profiles without
-- recursing into the profiles RLS policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Whether the current user can access a given deal
-- (assigned to them, or they are an admin).
create or replace function public.can_access_deal(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.deals d
    where d.id = p_deal_id
      and (d.assigned_to = auth.uid() or public.is_admin())
  );
$$;

-- Auto-create a profile row when a new auth user signs up / is invited.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'rep'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep deals.updated_at fresh.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger deals_set_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.deals enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;

-- profiles: all authenticated users can read every profile
-- (needed for assignment dropdowns / avatars); users update
-- only their own row; admins can update any row (role toggle).
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- contacts: shared pool — any authenticated user can read/insert/update.
create policy "contacts_select" on public.contacts
  for select to authenticated
  using (true);

create policy "contacts_insert" on public.contacts
  for insert to authenticated
  with check (true);

create policy "contacts_update" on public.contacts
  for update to authenticated
  using (true);

create policy "contacts_delete" on public.contacts
  for delete to authenticated
  using (true);

-- deals: reps see only their own; admins see all.
create policy "deals_select" on public.deals
  for select to authenticated
  using (assigned_to = auth.uid() or public.is_admin());

create policy "deals_insert" on public.deals
  for insert to authenticated
  with check (assigned_to = auth.uid() or public.is_admin());

create policy "deals_update" on public.deals
  for update to authenticated
  using (assigned_to = auth.uid() or public.is_admin())
  with check (assigned_to = auth.uid() or public.is_admin());

create policy "deals_delete" on public.deals
  for delete to authenticated
  using (assigned_to = auth.uid() or public.is_admin());

-- activities: access follows the parent deal.
create policy "activities_select" on public.activities
  for select to authenticated
  using (public.can_access_deal(deal_id));

create policy "activities_insert" on public.activities
  for insert to authenticated
  with check (public.can_access_deal(deal_id) and created_by = auth.uid());

create policy "activities_update" on public.activities
  for update to authenticated
  using (public.can_access_deal(deal_id));

create policy "activities_delete" on public.activities
  for delete to authenticated
  using (public.can_access_deal(deal_id));

-- tasks: access follows the parent deal.
create policy "tasks_select" on public.tasks
  for select to authenticated
  using (public.can_access_deal(deal_id));

create policy "tasks_insert" on public.tasks
  for insert to authenticated
  with check (public.can_access_deal(deal_id));

create policy "tasks_update" on public.tasks
  for update to authenticated
  using (public.can_access_deal(deal_id));

create policy "tasks_delete" on public.tasks
  for delete to authenticated
  using (public.can_access_deal(deal_id));

-- -------------------------------------------------------------
-- AFTER RUNNING: promote your first user to admin
--   update public.profiles set role = 'admin' where email = 'you@hireiqx.com';
-- -------------------------------------------------------------
