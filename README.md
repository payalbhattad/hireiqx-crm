# HireIQX Sales CRM

Internal sales CRM for the HireIQX team. React + Vite + Tailwind frontend talking directly to Supabase (auth + Postgres with RLS), with two Vercel serverless functions for server-side secrets (Resend email sending, Supabase service-role user invites).

## Features

- **Auth** — Supabase email/password login, protected routes, admin/rep roles
- **Pipeline** — kanban board with drag & drop across 7 stages
- **Contacts** — searchable table, add/edit, Apollo CSV/XLSX import with duplicate detection
- **Deals** — detail page with inline editing, activity timeline, tasks, and email sending via Resend
- **Tasks** — my-tasks view with Overdue / Due Today / Upcoming sections; admin sees all
- **Dashboard** — pipeline stats, deals-by-stage chart, recent activity, rep leaderboard (admin)
- **Settings** (admin) — user management, role toggle, email invites

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and paste the entire contents of `supabase/migrations/001_initial_schema.sql`, then run it. This creates all tables, triggers, and RLS policies.
3. Create your first user under **Authentication → Users → Add user** (email + password). A profile row is created automatically.
4. Promote yourself to admin in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@hireiqx.com';
   ```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where used | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | frontend + api | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | frontend | anon/public key (safe — RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | api only | **never** prefix with `VITE_` |
| `RESEND_API_KEY` | api only | **never** prefix with `VITE_` |
| `EMAIL_FROM` | api only | optional verified sender, defaults to `onboarding@resend.dev` |

### 3. Run locally

```bash
npm install
npm run dev        # frontend only (api/ functions not served)
```

To exercise the serverless functions (`/api/send-email`, `/api/invite-user`) locally, use the Vercel CLI instead:

```bash
npm i -g vercel
vercel dev
```

### 4. Deploy (Vercel)

1. Push the repo to GitHub and import it in Vercel.
2. Add all env vars from the table above in **Project → Settings → Environment Variables**.
3. Deploy. `vercel.json` rewrites all non-`/api` routes to `index.html` for SPA routing.

## Security model

- RLS is enabled on every table. Reps only see deals (and their activities/tasks) assigned to them; admins see everything (checked via a `SECURITY DEFINER` `is_admin()` function).
- The frontend only ever holds the anon key. The service role key and Resend key live exclusively in serverless function env vars.
- Both serverless functions verify the caller's Supabase JWT; `/api/invite-user` additionally requires the caller's profile role to be `admin`.
- All form input is sanitized (control chars/angle brackets stripped, length-capped) before reaching the database.
