-- =============================================================
-- HireIQX Sales CRM — Companies module
-- Run this in the Supabase SQL Editor (single execution),
-- after 001_initial_schema.sql.
-- =============================================================

-- -------------------------------------------------------------
-- TABLE: companies
-- -------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  website text,
  industry text check (industry in (
    'technology', 'healthcare', 'finance', 'education',
    'retail', 'manufacturing', 'real_estate', 'staffing',
    'other'
  )),
  status text check (status in (
    'prospect', 'active', 'customer', 'churned'
  )) default 'prospect',
  size text check (size in (
    '1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'
  )),
  phone text,
  address text,
  linkedin text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index companies_status_idx on public.companies (status);
create index companies_industry_idx on public.companies (industry);
create index companies_name_idx on public.companies (name);

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- ALTER: contacts
-- -------------------------------------------------------------

alter table public.contacts
  add column company_id uuid references public.companies(id),
  add column linkedin text,
  add column icp_category text check (icp_category in (
    'tier_1', 'tier_2', 'tier_3', 'not_icp'
  ));

create index contacts_company_id_idx on public.contacts (company_id);

alter table public.contacts drop column source;

-- -------------------------------------------------------------
-- ROW LEVEL SECURITY: companies
-- -------------------------------------------------------------

alter table public.companies enable row level security;

-- companies: shared pool, same access model as contacts — any
-- authenticated user can read/insert/update/delete.
create policy "companies_select" on public.companies
  for select to authenticated
  using (true);

create policy "companies_insert" on public.companies
  for insert to authenticated
  with check (true);

create policy "companies_update" on public.companies
  for update to authenticated
  using (true);

create policy "companies_delete" on public.companies
  for delete to authenticated
  using (true);
