---
name: verify
description: How to drive HireIQX Sales CRM end-to-end for verification (Vite + React + Supabase)
---

# Verifying this app

This is a Vite/React SPA backed by a real Supabase project (creds in `.env.local`).
There is no local/mock backend — verification means hitting the live project.

## Setup

1. `npm run dev -- --port <N>` in the background — port 5173 etc. are often already
   taken by other sessions; Vite will silently pick the next free port and print it.
   Read the printed URL, don't assume the port you asked for.
2. Playwright is not a project dependency. Install it ad hoc: `npm install --no-save
   playwright@<pinned-version>` (check `npx playwright --version` first — the browser
   binaries are usually already cached under `%LOCALAPPDATA%/ms-playwright`, so this is
   fast and installs nothing heavy). `--no-save` keeps package.json/lock untouched —
   confirm with `git status` afterward.
3. Create a throwaway auth user via the **service role** key (`SUPABASE_SERVICE_ROLE_KEY`
   in `.env.local`) with `supabase.auth.admin.createUser({ email, password,
   email_confirm: true })`, then flip their `profiles.role` to `admin` if you need
   admin-only screens (Settings, "All Tasks" rep view, etc). Delete the user with
   `auth.admin.deleteUser` when done. Any script using `@supabase/supabase-js` must be
   run from the project root (not the scratchpad) so the import resolves.
4. Playwright scripts must live in the project root too (same reason), then get deleted
   — don't leave `verify*.mjs` behind. `git status` before finishing to confirm.

## Gotchas specific to this codebase

- **Form labels have no `htmlFor`/`id`.** `page.getByLabel(...)` will silently time out.
  Use an XPath sibling lookup instead:
  ```js
  const field = (labelText) => page.locator(
    `xpath=//label[contains(normalize-space(text()),"${labelText}")]/following-sibling::*[self::input or self::select or self::textarea][1]`,
  )
  ```
- **Modal submit buttons collide with page-level buttons of the same name** (e.g. "Add
  Company" exists both as the header button and the modal's submit button). Scope with
  `button[type=submit]:has-text("...")`.
- **`:has-text("All")` is not exact-match** — it'll match "All Tasks" as well as a
  button whose full text is "All". Use `page.getByRole('button', { name: 'All', exact:
  true })` when a short label is a substring of a longer one nearby.
- Don't reuse a hardcoded test-data email/name across runs without cleaning up first —
  `contacts.email` is unique, so a half-finished prior run leaves an orphaned row that
  makes the next "Add Contact" fail with "already exists". Clean up via the service-role
  client (delete notes → tasks → deals → contacts → companies, in that FK order) before
  and after each verification pass.
- **Some check-constraint enums have drifted from the migration files in the repo.**
  E.g. `companies.status` no longer accepts the lowercase values written in
  `002_companies.sql` — the live DB was manually altered to `('New','Active','Lead')`
  (Title Case) at some point outside the tracked migrations. If a form submit fails with
  `violates check constraint "..._check"`, don't assume the frontend constant is right —
  probe the live constraint by inserting candidate values via the service-role client
  (each wrapped in an immediate delete) rather than trusting the migration file.
- Previously (an earlier session) the `authenticated`/`service_role` Postgres roles were
  missing table grants project-wide (`permission denied for table X`, distinct from an
  RLS rejection). That's since been fixed with explicit `GRANT` statements. If it
  recurs, it's a project-config issue, not a frontend bug — verify by querying the same
  table with both the anon-signed-in client and the service-role client.

- **Header fields vs. modal-form fields use different label markup.** Modal forms
  (TaskModal, ContactModal, AddDealModal, etc.) use `<label>` — the `field()` helper
  above works there. But DealDetail's/CompanyDetail's own inline header fields (Stage,
  Number of Seats, Estimated ARR, Demo Date, Outcome, ...) use a plain `<p className="text-xs
  font-medium uppercase ...">` caption instead, matching the original Value/Stage
  pattern. `field()` will hang forever on those — use a `<p>`-based sibling lookup
  instead:
  ```js
  const pfield = (labelText) => page.locator(
    `xpath=//p[contains(normalize-space(text()),"${labelText}")]/following-sibling::*[self::input or self::select or self::textarea][1]`,
  )
  ```
- **Any `INSERT` that doesn't explicitly set `companies.status` hits a broken column
  DEFAULT.** The live constraint only accepts `New`/`Active`/`Lead` (see above), but the
  table's `DEFAULT` clause was never updated to match and still points at the old
  lowercase value — so omitting `status` on insert fails with the same check-constraint
  error even though your code "didn't touch status." Always pass `status: 'New'`
  explicitly when creating a company from any code path (forms, bulk-import
  auto-create, etc.).
- **External side-effecting API calls (e.g. `/api/send-email` to real, non-test
  addresses) should be intercepted, not actually fired**, during verification.
  `page.route('**/api/send-email', handler)` lets you inspect the request body
  (recipients, subject, content) and `route.fulfill(...)` a success response without
  hitting Resend or a real inbox. Only let requests through for addresses you control
  (e.g. a fictitious `@test.com`-style contact you created) — `route.continue()` in
  that branch, intercept everything else.
- Ambiguous text locators (`text=Same Title Appears Twice`) will throw a strict-mode
  error if a prior half-finished run left a duplicate row (e.g. two deals with the same
  title). Clean up test data at the *start* of a run too, not just the end — you can't
  always rely on the previous run's cleanup having completed.

- **These check constraints have all drifted from the repo's migration files at least
  once — always confirm against the live DB before trusting `constants.js`:**
  - `companies.status`: `New`, `Active`, `Lead`, `Channel / Referral` (confirmed —
    note the spaces around the `/`, `Channel/Referral` with no spaces fails).
  - `contacts.icp_category`: `Owner / Executive`, `Recruiting Manager`, `Sales
    Manager`, `Recruiter`, `Account Manager`, `Administrator` (confirmed — same
    spaced-slash gotcha on the first one).
  - `companies.industry`: only 16 of a reported "22 sectors" are confirmed —
    `Construction`, `Education`, `Engineering`, `Government`, `Healthcare`,
    `Hospitality`, `Insurance`, `Legal`, `Manufacturing`, `Logistics`, `Information
    Technology`, `Finance & Accounting`, `Professional Services`, `Sales &
    Marketing`, `Energy & Utilities`, `Retail & Consumer`. ~150 other candidate
    sector names were probed and rejected. The other ~6 are still unknown — this is
    a real gap, not something to keep guessing at during a verify pass.
  - If any of these constraints get altered again, re-probe with the service-role
    client (insert candidate value, check for `violates check constraint`, delete
    immediately) rather than trusting what's in `constants.js` or the migration
    files — this has now happened repeatedly across sessions.
- **InlineEditCell's edit trigger is the pencil icon, not the whole cell.** Cells whose
  `displayValue` contains a `<Link>` (company/contact names linking to their detail
  pages) can't have the *whole* cell open edit mode — the Link needs its own click to
  navigate, and stealing that click either breaks navigation or double-fires both
  behaviors. So: `cell.hover()` then `cell.locator('button[title="Edit"]').click({
  force: true })` — `force: true` because the pencil is `opacity-0` until
  `group-hover`, and Playwright's actionability check otherwise refuses to click a
  0-opacity element.
- **`select`-type InlineEditCell fields save on `onChange`, not blur** — `.selectOption()`
  alone is enough, no need to blur/Enter afterward. Text/number/date types save on
  blur or Enter; Escape cancels and reverts to the last-saved value (verified: editing,
  pressing Escape, then re-reading the cell shows the *previous* save, not the
  escaped-away draft and not the pre-previous value either).
- When testing a sortable `<th>`, remember the **default sort direction is already
  applied on load** — e.g. Companies defaults to `{ key: 'name', dir: 'asc' }`, so the
  *first* click on the Name header flips to `desc`, not `asc`. Don't assert "first
  click == ascending" without checking what the page's initial sort state was.

## Useful smoke flow

Login → Companies (add) → open detail → Add Contact (confirms `initialCompanyId`
prefill) → open new Contact detail page → Create Lead (confirms deal created with
`stage=lead`, linked company status flips to `Lead`) → Pipeline board (4 columns: Lead /
Demo Scheduled / Decision Pending / Closed) → Add Deal via the searchable company
combobox + filtered contact select → verify card shows company/contact links, seats,
auto-computed ARR (`num_seats * 500`), rep initials, close date, and a stage `<select>`
that moves the card between columns → open deal detail and walk every stage (Lead → Demo
Scheduled → Decision Pending → Closed/Lost → Closed/Won), confirming each stage's
conditional fields appear/disappear correctly, the ARR field flips to "Manually set" on
direct edit, and setting Outcome=Won fires exactly one founder-notification email
(intercepted) that doesn't re-fire on subsequent saves (`founder_notified` dedupe) →
Notes tab add-note form, confirm it shows on both the deal and the linked contact →
Apollo CSV import: drop a file with a case-insensitive company-name match and a brand-new
company name plus a duplicate email, confirm the preview counts, progress bar, and
summary modal ("X imported / X duplicates / X new companies") all agree with what's
actually in the DB afterward.
