import { useEffect, useRef, useState } from 'react'
import { Pencil, Check } from 'lucide-react'

const controlCls =
  'w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

// Click-to-edit cell used across the Companies/Contacts/Tasks tables, Pipeline
// cards, and DealDetail: hover pencil, auto-save on blur/Enter, ESC to cancel,
// a brief green check on success, red "Failed to save" on error.
export default function InlineEditCell({
  value,
  onSave,
  type = 'text',
  options = [], // [{ value, label }] — used when type === 'select'
  displayValue,
  placeholder = '—',
  className = '',
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [status, setStatus] = useState('idle') // idle | success | error
  const inputRef = useRef(null)

  useEffect(() => {
    if (!editing) setDraft(value ?? '')
  }, [value, editing])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select?.()
    }
  }, [editing])

  useEffect(() => {
    if (status === 'idle') return
    const t = setTimeout(() => setStatus('idle'), status === 'success' ? 1500 : 4000)
    return () => clearTimeout(t)
  }, [status])

  const commit = async (next = draft) => {
    setEditing(false)
    if (String(next) === String(value ?? '')) return
    try {
      await onSave(next)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  const cancel = () => {
    setDraft(value ?? '')
    setEditing(false)
  }

  return (
    <div onClick={(e) => editing && e.stopPropagation()} className={className}>
      {editing ? (
        type === 'select' ? (
          <select
            ref={inputRef}
            value={draft ?? ''}
            onChange={(e) => commit(e.target.value)}
            onBlur={() => commit()}
            onKeyDown={(e) => e.key === 'Escape' && cancel()}
            className={controlCls}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef}
            type={type}
            value={draft ?? ''}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              }
              if (e.key === 'Escape') cancel()
            }}
            className={controlCls}
          />
        )
      ) : (
        // The edit trigger is the pencil icon specifically, not the whole cell —
        // displayValue often contains its own <Link> (e.g. to a detail page),
        // and stealing its click would break navigation (or double-fire both).
        <div className="group flex w-full items-center gap-1.5 rounded px-1 py-0.5 hover:bg-slate-50">
          <span className="min-w-0 flex-1 truncate">{displayValue ?? (value || placeholder)}</span>
          {status === 'success' ? (
            <Check className="h-3 w-3 shrink-0 text-green-500" />
          ) : (
            <button
              type="button"
              title="Edit"
              onClick={(e) => {
                e.stopPropagation()
                setEditing(true)
              }}
              className="shrink-0 text-slate-300 opacity-0 hover:text-slate-500 group-hover:opacity-100"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
      {status === 'error' && <p className="mt-0.5 text-xs text-red-600">Failed to save</p>}
    </div>
  )
}
