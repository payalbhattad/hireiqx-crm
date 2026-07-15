export const STAGES = [
  { id: 'lead', label: 'Lead' },
  { id: 'demo_scheduled', label: 'Demo Scheduled' },
  { id: 'decision_pending', label: 'Decision Pending' },
  { id: 'closed', label: 'Closed' },
]

export const STAGE_LABELS = Object.fromEntries(STAGES.map((s) => [s.id, s.label]))

// [badge classes, column accent bar]. "Closed" stays neutral here —
// Won/Lost is communicated per-card via OUTCOME_COLORS instead.
export const STAGE_COLORS = {
  lead: { badge: 'bg-slate-100 text-slate-700', bar: 'bg-slate-400' },
  demo_scheduled: { badge: 'bg-purple-100 text-purple-700', bar: 'bg-purple-500' },
  decision_pending: { badge: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-500' },
  closed: { badge: 'bg-slate-200 text-slate-800', bar: 'bg-slate-700' },
}

export const OPEN_STAGES = ['lead', 'demo_scheduled', 'decision_pending']

export const DEAL_REASON_OPTIONS = ['Budget', 'Timing', 'Competition', 'Approval']

export const OUTCOMES = ['Won', 'Lost']

export const OUTCOME_COLORS = {
  Won: 'bg-green-100 text-green-700',
  Lost: 'bg-red-100 text-red-700',
}

export const ACTIVITY_TYPES = ['call', 'email', 'note', 'meeting']

// NOTE: the live `companies_industry_check` constraint only accepts these 16
// values — a further ~150 candidate sector names (incl. "22 sectors" worth of
// guesses from the PRD-style list) were probed against the DB and rejected.
// The remaining ~6 sectors from the PRD are still unknown; add them here once
// confirmed against the live constraint.
export const INDUSTRIES = [
  'Construction',
  'Education',
  'Engineering',
  'Government',
  'Healthcare',
  'Hospitality',
  'Insurance',
  'Legal',
  'Manufacturing',
  'Logistics',
  'Information Technology',
  'Finance & Accounting',
  'Professional Services',
  'Sales & Marketing',
  'Energy & Utilities',
  'Retail & Consumer',
]

export const INDUSTRY_LABELS = Object.fromEntries(INDUSTRIES.map((i) => [i, i]))

export const COMPANY_STATUSES = ['New', 'Active', 'Lead', 'Channel / Referral']

export const COMPANY_STATUS_LABELS = Object.fromEntries(COMPANY_STATUSES.map((s) => [s, s]))

export const COMPANY_STATUS_COLORS = {
  New: 'bg-slate-100 text-slate-700',
  Active: 'bg-blue-100 text-blue-700',
  Lead: 'bg-purple-100 text-purple-700',
  'Channel / Referral': 'bg-amber-100 text-amber-700',
}

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']

export const ICP_CATEGORIES = [
  'Owner / Executive',
  'Recruiting Manager',
  'Sales Manager',
  'Recruiter',
  'Account Manager',
  'Administrator',
]

export const ICP_CATEGORY_LABELS = Object.fromEntries(ICP_CATEGORIES.map((i) => [i, i]))

export const ICP_CATEGORY_COLORS = {
  'Owner / Executive': 'bg-purple-100 text-purple-700',
  'Recruiting Manager': 'bg-blue-100 text-blue-700',
  'Sales Manager': 'bg-green-100 text-green-700',
  Recruiter: 'bg-yellow-100 text-yellow-700',
  'Account Manager': 'bg-indigo-100 text-indigo-700',
  Administrator: 'bg-slate-100 text-slate-600',
}

export const TASK_TYPES = ['Call', 'Email', 'Text', 'Social Media']

export const TASK_STATUSES = ['Open', 'Complete']

export const TASK_STATUS_COLORS = {
  Open: 'bg-blue-100 text-blue-700',
  Complete: 'bg-green-100 text-green-700',
}

export const TASK_FILTERS = ['Past Due', 'Due Today', 'Due This Week', 'All']
