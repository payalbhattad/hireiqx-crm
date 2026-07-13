export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function initials(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

// Local date as YYYY-MM-DD (avoids UTC off-by-one from toISOString).
export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Basic input sanitization: strip control chars and angle brackets, trim,
// and cap length. All user-entered text passes through here before insert.
export function sanitize(value, maxLength = 2000) {
  if (value == null) return ''
  return String(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength)
}
