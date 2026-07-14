import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { Plus, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STAGES, STAGE_COLORS, STAGE_LABELS, OUTCOME_COLORS } from '../lib/constants'
import { formatCurrency, formatDate, initials, sanitize } from '../lib/format'
import Modal from '../components/ui/Modal'
import CompanySearchSelect from '../components/ui/CompanySearchSelect'

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

function DealCard({ deal, onStageChange, overlay = false }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
  })

  const contact = deal.contact
  const company = contact?.company

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : { ...listeners, ...attributes })}
      onClick={() => !overlay && navigate(`/deals/${deal.id}`)}
      className={`cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${
        isDragging && !overlay ? 'opacity-40' : ''
      } ${overlay ? 'rotate-2 shadow-lg' : ''}`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{deal.title}</p>
        {deal.stage === 'closed' && deal.outcome && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${OUTCOME_COLORS[deal.outcome]}`}>
            {deal.outcome}
          </span>
        )}
      </div>

      {company && (
        <p className="text-xs text-slate-500">
          <Link
            to={`/companies/${company.id}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:text-indigo-600 hover:underline"
          >
            {company.name}
          </Link>
        </p>
      )}
      {contact && (
        <p className="mb-2 text-xs text-slate-500">
          <Link
            to={`/contacts/${contact.id}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:text-indigo-600 hover:underline"
          >
            {contact.full_name}
          </Link>
        </p>
      )}

      <div className="mb-2 flex items-center justify-between">
        {deal.num_seats != null && <span className="text-xs text-slate-500">{deal.num_seats} seats</span>}
        <span className="text-sm font-semibold text-indigo-600">{formatCurrency(deal.estimated_arr)}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <select
            value={deal.stage}
            onChange={(e) => onStageChange(deal, e.target.value)}
            className={`rounded-full border-0 px-2 py-0.5 text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${STAGE_COLORS[deal.stage].badge}`}
          >
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {deal.expected_close_date && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="h-3 w-3" />
              {formatDate(deal.expected_close_date)}
            </span>
          )}
          {deal.assignee && (
            <div
              title={deal.assignee.full_name}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white"
            >
              {initials(deal.assignee.full_name || deal.assignee.email)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StageColumn({ stage, deals, onAdd, onStageChange }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const total = deals.reduce((sum, d) => sum + (Number(d.estimated_arr) || 0), 0)

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className={`mb-2 h-1 rounded-full ${STAGE_COLORS[stage.id].bar}`} />
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <span className="text-sm font-semibold text-slate-900">{stage.label}</span>
          <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
            {deals.length}
          </span>
        </div>
        <span className="text-xs font-medium text-slate-500">{formatCurrency(total)}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-32 flex-1 flex-col gap-2 rounded-xl p-2 transition-colors ${
          isOver ? 'bg-indigo-50' : 'bg-slate-100/70'
        }`}
      >
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onStageChange={onStageChange} />
        ))}
        <button
          onClick={() => onAdd(stage.id)}
          className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Deal
        </button>
      </div>
    </div>
  )
}

function AddDealModal({ stage, profiles, onClose, onSaved }) {
  const { user } = useAuth()
  const [companyId, setCompanyId] = useState('')
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState({
    title: '',
    contact_id: '',
    num_seats: '',
    assigned_to: user.id,
    expected_close_date: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('contacts')
      .select('id, full_name, company_id')
      .order('full_name')
      .then(({ data }) => setContacts(data ?? []))
  }, [])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const contactsForCompany = useMemo(
    () => contacts.filter((c) => c.company_id === companyId),
    [contacts, companyId],
  )

  const handleCompanySelect = (company) => {
    setCompanyId(company?.id ?? '')
    setForm((f) => ({ ...f, contact_id: contacts.find((c) => c.id === f.contact_id)?.company_id === company?.id ? f.contact_id : '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error: dbError } = await supabase.from('deals').insert({
      title: sanitize(form.title, 200),
      contact_id: form.contact_id || null,
      num_seats: form.num_seats === '' ? null : Number(form.num_seats),
      assigned_to: form.assigned_to || null,
      expected_close_date: form.expected_close_date || null,
      stage,
    })
    if (dbError) {
      setError(dbError.message)
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <Modal title={`Add Deal — ${STAGE_LABELS[stage]}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
          <input required value={form.title} onChange={set('title')} className={inputCls} />
        </div>

        <CompanySearchSelect value={companyId} onSelect={handleCompanySelect} />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Contact</label>
          <select value={form.contact_id} onChange={set('contact_id')} disabled={!companyId} className={inputCls}>
            <option value="">{companyId ? '— None —' : 'Select a company first'}</option>
            {contactsForCompany.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Number of Seats</label>
            <input type="number" min="0" step="1" value={form.num_seats} onChange={set('num_seats')} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Expected Close</label>
            <input type="date" value={form.expected_close_date} onChange={set('expected_close_date')} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Assigned To</label>
          <select value={form.assigned_to} onChange={set('assigned_to')} className={inputCls}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Adding…' : 'Add Deal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Pipeline() {
  const [deals, setDeals] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingToStage, setAddingToStage] = useState(null)
  const [activeDeal, setActiveDeal] = useState(null)

  const sensors = useSensors(
    // 8px activation distance keeps plain clicks working as navigation.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const load = useCallback(async () => {
    const [dealsRes, profilesRes] = await Promise.all([
      supabase
        .from('deals')
        .select('*, contact:contacts(id, full_name, company_id, company:companies(id, name)), assignee:profiles!deals_assigned_to_fkey(id, full_name, email)')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email').order('full_name'),
    ])
    setDeals(dealsRes.data ?? [])
    setProfiles(profilesRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const byStage = useMemo(() => {
    const map = Object.fromEntries(STAGES.map((s) => [s.id, []]))
    for (const d of deals) map[d.stage]?.push(d)
    return map
  }, [deals])

  const moveStage = useCallback(async (deal, targetStage) => {
    if (!targetStage || deal.stage === targetStage) return
    setDeals((ds) => ds.map((d) => (d.id === deal.id ? { ...d, stage: targetStage } : d)))
    const { error } = await supabase.from('deals').update({ stage: targetStage }).eq('id', deal.id)
    if (error) {
      setDeals((ds) => ds.map((d) => (d.id === deal.id ? { ...d, stage: deal.stage } : d)))
    }
  }, [])

  const handleDragEnd = ({ active, over }) => {
    setActiveDeal(null)
    if (!over) return
    const deal = active.data.current?.deal
    // Drop target is a column id, or another card — resolve to its stage.
    const targetStage = STAGES.some((s) => s.id === over.id)
      ? over.id
      : deals.find((d) => d.id === over.id)?.stage
    if (!deal) return
    moveStage(deal, targetStage)
  }

  return (
    <div className="flex h-full flex-col p-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Pipeline</h1>
      {loading ? (
        <p className="text-sm text-slate-500">Loading pipeline…</p>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={({ active }) => setActiveDeal(active.data.current?.deal ?? null)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDeal(null)}
        >
          <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
            {STAGES.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={byStage[stage.id]}
                onAdd={setAddingToStage}
                onStageChange={moveStage}
              />
            ))}
          </div>
          <DragOverlay>{activeDeal && <DealCard deal={activeDeal} overlay />}</DragOverlay>
        </DndContext>
      )}

      {addingToStage && (
        <AddDealModal
          stage={addingToStage}
          profiles={profiles}
          onClose={() => setAddingToStage(null)}
          onSaved={() => {
            setAddingToStage(null)
            load()
          }}
        />
      )}
    </div>
  )
}
