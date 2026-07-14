import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Phone,
  Mail,
  FileText,
  Users,
  Send,
  Check,
  Building2,
  Briefcase,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  STAGES,
  STAGE_COLORS,
  ACTIVITY_TYPES,
  TASK_TYPES,
  DEAL_REASON_OPTIONS,
  OUTCOMES,
} from '../lib/constants'
import { formatCurrency, formatDate, formatDateTime, initials, sanitize, todayISO } from '../lib/format'
import Modal from '../components/ui/Modal'
import CompanySearchSelect from '../components/ui/CompanySearchSelect'

const inputCls =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

const ACTIVITY_ICONS = { call: Phone, email: Mail, note: FileText, meeting: Users }

const FOUNDER_EMAILS = ['brad@hireiqx.com', 'robert@hireiqx.com']

function EmailModal({ deal, onClose, onSent }) {
  const { session, user } = useAuth()
  const [form, setForm] = useState({
    to: deal.contact?.email ?? '',
    subject: '',
    body: '',
  })
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSend = async (e) => {
    e.preventDefault()
    setSending(true)
    setError('')

    const subject = sanitize(form.subject, 300)
    const body = sanitize(form.body, 10000)

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: sanitize(form.to, 254),
          subject,
          body,
          deal_id: deal.id,
          user_id: user.id,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Send failed (${res.status})`)
      }

      await supabase.from('activities').insert({
        deal_id: deal.id,
        type: 'email',
        body: `Subject: ${subject}\n\n${body}`,
        created_by: user.id,
      })
      onSent()
    } catch (err) {
      setError(err.message)
      setSending(false)
    }
  }

  return (
    <Modal title="Send Email" onClose={onClose}>
      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">To</label>
          <input type="email" required value={form.to} onChange={set('to')} className={`w-full ${inputCls}`} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Subject</label>
          <input required value={form.subject} onChange={set('subject')} className={`w-full ${inputCls}`} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Body</label>
          <textarea required rows={8} value={form.body} onChange={set('body')} className={`w-full ${inputCls}`} />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={sending} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            <Send className="h-4 w-4" />
            {sending ? 'Sending…' : 'Send Email'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function DealDetail() {
  const { id } = useParams()
  const { user, session } = useAuth()
  const [deal, setDeal] = useState(null)
  const [activities, setActivities] = useState([])
  const [tasks, setTasks] = useState([])
  const [notes, setNotes] = useState([])
  const [profiles, setProfiles] = useState([])
  const [contacts, setContacts] = useState([])
  const [companyId, setCompanyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('activity')
  const [showEmail, setShowEmail] = useState(false)

  const [title, setTitle] = useState('')
  const [activityForm, setActivityForm] = useState({ type: 'note', body: '' })
  const [taskForm, setTaskForm] = useState({ task_type: 'Call', due_date: '' })
  const [noteBody, setNoteBody] = useState('')

  const load = useCallback(async () => {
    const dealRes = await supabase
      .from('deals')
      .select('*, contact:contacts(*, company:companies(id, name)), assignee:profiles!deals_assigned_to_fkey(id, full_name, email)')
      .eq('id', id)
      .maybeSingle()

    const dealContactId = dealRes.data?.contact_id ?? null
    const notesFilter = dealContactId
      ? `deal_id.eq.${id},contact_id.eq.${dealContactId}`
      : `deal_id.eq.${id}`

    const [actsRes, tasksRes, notesRes, profilesRes, contactsRes] = await Promise.all([
      supabase
        .from('activities')
        .select('*, creator:profiles!activities_created_by_fkey(full_name, email)')
        .eq('deal_id', id)
        .order('created_at', { ascending: true }),
      supabase.from('tasks').select('*').eq('deal_id', id).order('due_date', { ascending: true }),
      supabase
        .from('notes')
        .select('*, creator:profiles!notes_created_by_fkey(full_name, email)')
        .or(notesFilter)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email').order('full_name'),
      supabase.from('contacts').select('id, full_name, company_id').order('full_name'),
    ])
    setDeal(dealRes.data ?? null)
    setTitle(dealRes.data?.title ?? '')
    setCompanyId(dealRes.data?.contact?.company_id ?? '')
    setActivities(actsRes.data ?? [])
    setTasks(tasksRes.data ?? [])
    setNotes(notesRes.data ?? [])
    setProfiles(profilesRes.data ?? [])
    setContacts(contactsRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const updateDeal = async (patch) => {
    setDeal((d) => ({ ...d, ...patch }))
    await supabase.from('deals').update(patch).eq('id', id)
    if (['assigned_to', 'contact_id', 'num_seats', 'arr_override'].some((k) => k in patch)) load()
  }

  const handleTitleBlur = () => {
    const clean = sanitize(title, 200)
    if (clean && clean !== deal.title) updateDeal({ title: clean })
    else setTitle(deal.title)
  }

  const contactsForCompany = useMemo(
    () => contacts.filter((c) => c.company_id === companyId),
    [contacts, companyId],
  )

  const handleCompanySelect = (company) => {
    setCompanyId(company?.id ?? '')
    if ((deal?.contact?.company_id ?? '') !== (company?.id ?? '')) {
      updateDeal({ contact_id: null })
    }
  }

  const notifyFounders = async (wonDeal, contact) => {
    const companyName = contact?.company?.name || wonDeal.title
    const bodyLines = [
      `Company: ${companyName}`,
      `Primary Contact: ${contact?.full_name || 'n/a'}`,
      `Sales Rep: ${wonDeal.assignee?.full_name || wonDeal.assignee?.email || 'Unassigned'}`,
      `ARR: ${formatCurrency(wonDeal.estimated_arr)}`,
      `Number of Seats: ${wonDeal.num_seats ?? 'n/a'}`,
      `Plan Selected: ${wonDeal.plan_selected || 'n/a'}`,
      `Kickoff Date: ${wonDeal.kickoff_date ? formatDate(wonDeal.kickoff_date) : 'n/a'}`,
    ]
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: FOUNDER_EMAILS,
          subject: `🎉 New Deal Won — ${companyName}`,
          body: bodyLines.join('\n'),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.success) {
        await supabase.from('deals').update({ founder_notified: true }).eq('id', wonDeal.id)
        setDeal((d) => ({ ...d, founder_notified: true }))
      }
    } catch {
      // best-effort — founder_notified stays false so this can be retried on the next save
    }
  }

  const handleOutcomeChange = async (value) => {
    const wasNotified = deal.founder_notified
    const contact = deal.contact
    await updateDeal({ outcome: value || null })
    if (value === 'Won' && !wasNotified) {
      await notifyFounders({ ...deal, outcome: value }, contact)
    }
  }

  const handleLogActivity = async (e) => {
    e.preventDefault()
    const body = sanitize(activityForm.body, 5000)
    if (!body) return
    const { error } = await supabase.from('activities').insert({
      deal_id: id,
      type: activityForm.type,
      body,
      created_by: user.id,
    })
    if (!error) {
      setActivityForm({ type: 'note', body: '' })
      load()
    }
  }

  const handleAddTask = async (e) => {
    e.preventDefault()
    if (!taskForm.task_type) return
    const { error } = await supabase.from('tasks').insert({
      deal_id: id,
      company_id: contact?.company_id ?? null,
      contact_id: contact?.id ?? null,
      task_type: taskForm.task_type,
      due_date: taskForm.due_date || null,
      assigned_to: deal.assigned_to ?? user.id,
      task_status: 'Open',
    })
    if (!error) {
      setTaskForm({ task_type: 'Call', due_date: '' })
      load()
    }
  }

  const toggleTask = async (task) => {
    const nextStatus = task.task_status === 'Complete' ? 'Open' : 'Complete'
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, task_status: nextStatus } : t)))
    await supabase.from('tasks').update({ task_status: nextStatus }).eq('id', task.id)
  }

  const handleAddNote = async (e) => {
    e.preventDefault()
    const clean = sanitize(noteBody, 5000)
    if (!clean) return
    const { error } = await supabase.from('notes').insert({
      body: clean,
      deal_id: id,
      contact_id: deal.contact?.id ?? null,
      created_by: user.id,
    })
    if (!error) {
      setNoteBody('')
      load()
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading deal…</div>
  }

  if (!deal) {
    return (
      <div className="p-8">
        <p className="text-slate-600">Deal not found, or you don't have access to it.</p>
        <Link to="/pipeline" className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline">
          ← Back to Pipeline
        </Link>
      </div>
    )
  }

  const contact = deal.contact
  const today = todayISO()
  const showSeatsAndArr = deal.stage !== 'closed' || deal.outcome === 'Won'

  return (
    <div className="p-8">
      <Link to="/pipeline" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600">
        <ArrowLeft className="h-4 w-4" />
        Pipeline
      </Link>

      {/* Header */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
            className="min-w-64 flex-1 rounded-lg border border-transparent px-2 py-1 text-xl font-bold text-slate-900 hover:border-slate-200 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => setShowEmail(true)}
            disabled={!contact?.email}
            title={contact?.email ? 'Send email to contact' : 'Contact has no email'}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Send Email
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-6">
          <div className="w-56">
            <CompanySearchSelect
              value={companyId}
              onSelect={handleCompanySelect}
              labelClassName="text-xs font-medium uppercase text-slate-500"
            />
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Contact</p>
            <select
              value={deal.contact_id ?? ''}
              onChange={(e) => updateDeal({ contact_id: e.target.value || null })}
              disabled={!companyId}
              className={`mt-1 w-44 ${inputCls}`}
            >
              <option value="">{companyId ? '— None —' : 'Select a company first'}</option>
              {contactsForCompany.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>

          {showSeatsAndArr && (
            <>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Number of Seats</p>
                <input
                  key={`seats-${deal.updated_at}`}
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={deal.num_seats ?? ''}
                  onBlur={(e) => updateDeal({ num_seats: e.target.value === '' ? null : Number(e.target.value) })}
                  className={`mt-1 w-28 ${inputCls}`}
                />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Estimated ARR</p>
                <input
                  key={`arr-${deal.updated_at}`}
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={deal.estimated_arr ?? ''}
                  onBlur={(e) =>
                    updateDeal({
                      estimated_arr: e.target.value === '' ? null : Number(e.target.value),
                      arr_override: true,
                    })
                  }
                  className={`mt-1 w-32 ${inputCls}`}
                />
                <p className="mt-1 text-xs text-slate-400">
                  {deal.arr_override
                    ? 'Manually set'
                    : `Auto-calculated: ${formatCurrency((deal.num_seats || 0) * 500)}`}
                </p>
              </div>
            </>
          )}

          {deal.stage === 'demo_scheduled' && (
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Demo Date</p>
              <input
                type="date"
                value={deal.demo_date ?? ''}
                onChange={(e) => updateDeal({ demo_date: e.target.value || null })}
                className={`mt-1 ${inputCls}`}
              />
            </div>
          )}

          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Assigned To</p>
            <select
              value={deal.assigned_to ?? ''}
              onChange={(e) => updateDeal({ assigned_to: e.target.value || null })}
              className={`mt-1 ${inputCls}`}
            >
              <option value="">— Unassigned —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </option>
              ))}
            </select>
          </div>

          {deal.stage !== 'closed' && (
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Expected Close</p>
              <input
                type="date"
                value={deal.expected_close_date ?? ''}
                onChange={(e) => updateDeal({ expected_close_date: e.target.value || null })}
                className={`mt-1 ${inputCls}`}
              />
            </div>
          )}

          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Stage</p>
            <select
              value={deal.stage}
              onChange={(e) => updateDeal({ stage: e.target.value })}
              className={`mt-1 ${inputCls} ${STAGE_COLORS[deal.stage].badge}`}
            >
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {deal.stage === 'decision_pending' && (
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Decision Criteria</p>
              <select
                value={deal.decision_criteria ?? ''}
                onChange={(e) => updateDeal({ decision_criteria: e.target.value || null })}
                className={`mt-1 ${inputCls}`}
              >
                <option value="">— None —</option>
                {DEAL_REASON_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          )}

          {deal.stage === 'closed' && (
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Outcome</p>
              <select
                value={deal.outcome ?? ''}
                onChange={(e) => handleOutcomeChange(e.target.value)}
                className={`mt-1 ${inputCls}`}
              >
                <option value="">— None —</option>
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          )}

          {deal.stage === 'closed' && deal.outcome === 'Lost' && (
            <>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Lost Reason</p>
                <select
                  value={deal.lost_reason ?? ''}
                  onChange={(e) => updateDeal({ lost_reason: e.target.value || null })}
                  className={`mt-1 ${inputCls}`}
                >
                  <option value="">— None —</option>
                  {DEAL_REASON_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Follow-Up Date</p>
                <input
                  type="date"
                  value={deal.followup_date ?? ''}
                  onChange={(e) => updateDeal({ followup_date: e.target.value || null })}
                  className={`mt-1 ${inputCls}`}
                />
              </div>
            </>
          )}

          {deal.stage === 'closed' && deal.outcome === 'Won' && (
            <>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Plan Selected</p>
                <input
                  key={`plan-${deal.updated_at}`}
                  defaultValue={deal.plan_selected ?? ''}
                  onBlur={(e) => updateDeal({ plan_selected: sanitize(e.target.value, 200) || null })}
                  className={`mt-1 w-40 ${inputCls}`}
                />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Kickoff Date</p>
                <input
                  type="date"
                  value={deal.kickoff_date ?? ''}
                  onChange={(e) => updateDeal({ kickoff_date: e.target.value || null })}
                  className={`mt-1 ${inputCls}`}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
          <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Contact</h2>
          {contact ? (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-base font-semibold text-white">
                  {initials(contact.full_name)}
                </div>
                <div>
                  <Link
                    to={`/contacts/${contact.id}`}
                    className="font-semibold text-slate-900 hover:text-indigo-600 hover:underline"
                  >
                    {contact.full_name}
                  </Link>
                  {contact.title && <p className="text-sm text-slate-500">{contact.title}</p>}
                </div>
              </div>
              <dl className="space-y-2 text-sm">
                {contact.company && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <Link to={`/companies/${contact.company.id}`} className="text-indigo-600 hover:underline">
                      {contact.company.name}
                    </Link>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="h-4 w-4 text-slate-400" />
                    {contact.email}
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="h-4 w-4 text-slate-400" />
                    {contact.phone}
                  </div>
                )}
                {contact.title && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Briefcase className="h-4 w-4 text-slate-400" />
                    {contact.title}
                  </div>
                )}
              </dl>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No contact linked to this deal.</p>
          )}
        </div>

        {/* Activity / Tasks / Notes */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex border-b border-slate-200">
            {[
              { id: 'activity', label: `Activity (${activities.length})` },
              { id: 'tasks', label: `Tasks (${tasks.filter((t) => t.task_status !== 'Complete').length})` },
              { id: 'notes', label: `Notes (${notes.length})` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-5 py-3 text-sm font-medium ${
                  tab === t.id
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'activity' ? (
            <div className="p-5">
              {activities.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No activity yet. Log the first one below.</p>
              ) : (
                <ul className="space-y-4">
                  {activities.map((a) => {
                    const Icon = ACTIVITY_ICONS[a.type] ?? FileText
                    return (
                      <li key={a.id} className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                          <Icon className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="whitespace-pre-wrap text-sm text-slate-700">{a.body}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {a.creator?.full_name || a.creator?.email || 'Unknown'} · {formatDateTime(a.created_at)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              <form onSubmit={handleLogActivity} className="mt-6 border-t border-slate-200 pt-4">
                <div className="flex gap-3">
                  <select
                    value={activityForm.type}
                    onChange={(e) => setActivityForm((f) => ({ ...f, type: e.target.value }))}
                    className={inputCls}
                  >
                    {ACTIVITY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                  <textarea
                    required
                    rows={2}
                    placeholder="Log a call, note, or meeting…"
                    value={activityForm.body}
                    onChange={(e) => setActivityForm((f) => ({ ...f, body: e.target.value }))}
                    className={`flex-1 ${inputCls}`}
                  />
                  <button
                    type="submit"
                    className="self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Log
                  </button>
                </div>
              </form>
            </div>
          ) : tab === 'tasks' ? (
            <div className="p-5">
              {tasks.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No tasks for this deal yet.</p>
              ) : (
                <ul className="space-y-2">
                  {tasks.map((t) => {
                    const overdue = t.due_date && t.due_date < today
                    const complete = t.task_status === 'Complete'
                    return (
                      <li
                        key={t.id}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                          overdue ? 'border-red-200 bg-red-50' : 'border-slate-200'
                        }`}
                      >
                        <button
                          onClick={() => toggleTask(t)}
                          className={`flex h-5 w-5 items-center justify-center rounded border ${
                            complete
                              ? 'border-green-600 bg-green-600 text-white'
                              : 'border-slate-300 bg-white hover:border-indigo-500'
                          }`}
                        >
                          {complete && <Check className="h-3.5 w-3.5" />}
                        </button>
                        <span className={`flex-1 text-sm ${complete ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {t.task_type}
                        </span>
                        {t.due_date && (
                          <span className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-slate-500'}`}>
                            {overdue ? 'Overdue · ' : ''}
                            {formatDate(t.due_date)}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              <form onSubmit={handleAddTask} className="mt-6 flex gap-3 border-t border-slate-200 pt-4">
                <select
                  value={taskForm.task_type}
                  onChange={(e) => setTaskForm((f) => ({ ...f, task_type: e.target.value }))}
                  className={inputCls}
                >
                  {TASK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={taskForm.due_date}
                  onChange={(e) => setTaskForm((f) => ({ ...f, due_date: e.target.value }))}
                  className={inputCls}
                />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Add Task
                </button>
              </form>
            </div>
          ) : (
            <div className="p-5">
              {notes.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No notes yet.</p>
              ) : (
                <ul className="space-y-4">
                  {notes.map((n) => (
                    <li key={n.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {n.creator?.full_name || n.creator?.email || 'Unknown'} · {formatDateTime(n.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={handleAddNote} className="mt-6 border-t border-slate-200 pt-4">
                <textarea
                  required
                  rows={3}
                  placeholder="Add a note…"
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  className={`w-full ${inputCls}`}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Add Note
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {showEmail && (
        <EmailModal
          deal={deal}
          onClose={() => setShowEmail(false)}
          onSent={() => {
            setShowEmail(false)
            load()
          }}
        />
      )}
    </div>
  )
}
