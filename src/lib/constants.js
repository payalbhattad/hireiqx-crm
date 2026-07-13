export const STAGES = [
  { id: 'new_lead', label: 'New Lead' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'demo_scheduled', label: 'Demo Scheduled' },
  { id: 'proposal_sent', label: 'Proposal Sent' },
  { id: 'negotiating', label: 'Negotiating' },
  { id: 'closed_won', label: 'Closed Won' },
  { id: 'closed_lost', label: 'Closed Lost' },
]

export const STAGE_LABELS = Object.fromEntries(STAGES.map((s) => [s.id, s.label]))

// [badge classes, column accent bar]
export const STAGE_COLORS = {
  new_lead: { badge: 'bg-slate-100 text-slate-700', bar: 'bg-slate-400' },
  contacted: { badge: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500' },
  demo_scheduled: { badge: 'bg-purple-100 text-purple-700', bar: 'bg-purple-500' },
  proposal_sent: { badge: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-500' },
  negotiating: { badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500' },
  closed_won: { badge: 'bg-green-100 text-green-700', bar: 'bg-green-500' },
  closed_lost: { badge: 'bg-red-100 text-red-700', bar: 'bg-red-500' },
}

export const OPEN_STAGES = ['new_lead', 'contacted', 'demo_scheduled', 'proposal_sent', 'negotiating']

export const SOURCES = ['inbound', 'outbound', 'referral', 'apollo']

export const SOURCE_COLORS = {
  inbound: 'bg-green-100 text-green-700',
  outbound: 'bg-blue-100 text-blue-700',
  referral: 'bg-purple-100 text-purple-700',
  apollo: 'bg-orange-100 text-orange-700',
}

export const ACTIVITY_TYPES = ['call', 'email', 'note', 'meeting']
