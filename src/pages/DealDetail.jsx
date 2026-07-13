import { useCallback, useEffect, useState } from 'react'
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
import { STAGES, STAGE_COLORS, ACTIVITY_TYPES } from '../lib/constants'
import { formatDate, formatDateTime, initials, sanitize, todayISO } from '../lib/format'
import Modal from '../components/ui/Modal'

const inputCls =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

const ACTIVITY_ICONS = { call: Phone, email: Mail, note: FileText, meeting: Users }

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
  const { user } = useAuth()
  const [deal, setDeal] = useState(null)
  const [activities, setActivities] = useState([])
  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('activity')
  const [showEmail, setShowEmail] = useState(false)

  const [title, setTitle] = useState('')
  const [activityForm, setActivityForm] = useState({ type: 'note', body: '' })
  const [taskForm, setTaskForm] = useState({ title: '', due_date: '' })

  const load = useCallback(async () => {
    const [dealRes, actsRes, tasksRes, profilesRes] = await Promise.all([
      supabase
        .from('deals')
        .select('*, contact:contacts(*), assignee:profiles!deals_assigned_to_fkey(id, full_name, email)')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('activities')
        .select('*, creator:profiles!activities_created_by_fkey(full_name, email)')
        .eq('deal_id', id)
        .order('created_at', { ascending: true }),
      supabase.from('tasks').select('*').eq('deal_id', id).order('due_date', { ascending: true }),
      supabase.from('profiles').select('id, full_name, email').order('full_name'),
    ])
    setDeal(dealRes.data ?? null)
    setTitle(dealRes.data?.title ?? '')
    setActivities(actsRes.data ?? [])
    setTasks(tasksRes.data ?? [])
    setProfiles(profilesRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const updateDeal = async (patch) => {
    setDeal((d) => ({ ...d, ...patch }))
    await supabase.from('deals').update(patch).eq('id', id)
    if ('assigned_to' in patch || 'contact_id' in patch) load()
  }

  const handleTitleBlur = () => {
    const clean = sanitize(title, 200)
    if (clean && clean !== deal.title) updateDeal({ title: clean })
    else setTitle(deal.title)
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
    const taskTitle = sanitize(taskForm.title, 200)
    if (!taskTitle) return
    const { error } = await supabase.from('tasks').insert({
      deal_id: id,
      title: taskTitle,
      due_date: taskForm.due_date || null,
      assigned_to: deal.assigned_to ?? user.id,
    })
    if (!error) {
      setTaskForm({ title: '', due_date: '' })
      load()
    }
  }

  const toggleTask = async (task) => {
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)))
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
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
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Value</p>
            <input
              type="number"
              min="0"
              step="any"
              defaultValue={deal.value}
              onBlur={(e) => updateDeal({ value: Number(e.target.value) || 0 })}
              className={`mt-1 w-32 ${inputCls}`}
            />
          </div>
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
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Expected Close</p>
            <input
              type="date"
              value={deal.expected_close_date ?? ''}
              onChange={(e) => updateDeal({ expected_close_date: e.target.value || null })}
              className={`mt-1 ${inputCls}`}
            />
          </div>
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
                  <p className="font-semibold text-slate-900">{contact.full_name}</p>
                  {contact.title && <p className="text-sm text-slate-500">{contact.title}</p>}
                </div>
              </div>
              <dl className="space-y-2 text-sm">
                {contact.company && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    {contact.company}
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

        {/* Activity / Tasks */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex border-b border-slate-200">
            {[
              { id: 'activity', label: `Activity (${activities.length})` },
              { id: 'tasks', label: `Tasks (${tasks.filter((t) => !t.completed).length})` },
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
          ) : (
            <div className="p-5">
              {tasks.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No tasks for this deal yet.</p>
              ) : (
                <ul className="space-y-2">
                  {tasks.map((t) => {
                    const overdue = !t.completed && t.due_date && t.due_date < today
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
                            t.completed
                              ? 'border-green-600 bg-green-600 text-white'
                              : 'border-slate-300 bg-white hover:border-indigo-500'
                          }`}
                        >
                          {t.completed && <Check className="h-3.5 w-3.5" />}
                        </button>
                        <span
                          className={`flex-1 text-sm ${
                            t.completed ? 'text-slate-400 line-through' : 'text-slate-700'
                          }`}
                        >
                          {t.title}
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
                <input
                  required
                  placeholder="New task…"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                  className={`flex-1 ${inputCls}`}
                />
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
