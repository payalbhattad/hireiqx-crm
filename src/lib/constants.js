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

export const INDUSTRIES = [
  'technology',
  'healthcare',
  'finance',
  'education',
  'retail',
  'manufacturing',
  'real_estate',
  'staffing',
  'other',
]

export const INDUSTRY_LABELS = {
  technology: 'Technology',
  healthcare: 'Healthcare',
  finance: 'Finance',
  education: 'Education',
  retail: 'Retail',
  manufacturing: 'Manufacturing',
  real_estate: 'Real Estate',
  staffing: 'Staffing',
  other: 'Other',
}

export const COMPANY_STATUSES = ['New', 'Active', 'Lead']

export const COMPANY_STATUS_LABELS = {
  New: 'New',
  Active: 'Active',
  Lead: 'Lead',
}

export const COMPANY_STATUS_COLORS = {
  New: 'bg-slate-100 text-slate-700',
  Active: 'bg-blue-100 text-blue-700',
  Lead: 'bg-purple-100 text-purple-700',
}

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']

export const ICP_CATEGORIES = ['tier_1', 'tier_2', 'tier_3', 'not_icp']

export const ICP_CATEGORY_LABELS = {
  tier_1: 'Tier 1',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
  not_icp: 'Not ICP',
}

export const ICP_CATEGORY_COLORS = {
  tier_1: 'bg-green-100 text-green-700',
  tier_2: 'bg-blue-100 text-blue-700',
  tier_3: 'bg-yellow-100 text-yellow-700',
  not_icp: 'bg-slate-100 text-slate-600',
}

export const TASK_TYPES = ['Call', 'Email', 'Text', 'Social Media']

export const TASK_STATUSES = ['Open', 'Complete']

export const TASK_STATUS_COLORS = {
  Open: 'bg-blue-100 text-blue-700',
  Complete: 'bg-green-100 text-green-700',
}

export const TASK_FILTERS = ['Past Due', 'Due Today', 'Due This Week', 'All']
