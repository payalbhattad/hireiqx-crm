import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import CompanySearchSelect from '../ui/CompanySearchSelect'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { TASK_TYPES, TASK_STATUSES } from '../../lib/constants'
import { sanitize } from '../../lib/format'

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function TaskModal({ task, initialCompanyId = '', initialContactId = '', onClose, onSaved }) {
  const { user } = useAuth()
  const isEdit = Boolean(task)
  const [contacts, setContacts] = useState([])
  const [profiles, setProfiles] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [companyId, setCompanyId] = useState(task?.company_id ?? initialCompanyId ?? '')

  const [form, setForm] = useState({
    contact_id: task?.contact_id ?? initialContactId ?? '',
    task_type: task?.task_type ?? 'Call',
    due_date: task?.due_date ?? '',
    assigned_to: task?.assigned_to ?? user.id,
    notes: task?.notes ?? '',
    task_status: task?.task_status ?? 'Open',
  })

  useEffect(() => {
    Promise.all([
      supabase.from('contacts').select('id, full_name, company_id').order('full_name'),
      supabase.from('profiles').select('id, full_name, email').order('full_name'),
    ]).then(([contactsRes, profilesRes]) => {
      setContacts(contactsRes.data ?? [])
      setProfiles(profilesRes.data ?? [])
    })
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
    setError('')
    setSaving(true)

    const payload = {
      company_id: companyId || null,
      contact_id: form.contact_id || null,
      task_type: TASK_TYPES.includes(form.task_type) ? form.task_type : null,
      due_date: form.due_date || null,
      assigned_to: form.assigned_to || null,
      notes: sanitize(form.notes, 5000) || null,
      task_status: TASK_STATUSES.includes(form.task_status) ? form.task_status : 'Open',
    }

    if (!payload.task_type) {
      setError('Task type is required.')
      setSaving(false)
      return
    }

    const query = isEdit
      ? supabase.from('tasks').update(payload).eq('id', task.id)
      : supabase.from('tasks').insert(payload)

    const { error: dbError } = await query
    if (dbError) {
      setError(dbError.message)
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Edit Task' : 'Add Task'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <CompanySearchSelect value={companyId} onSelect={handleCompanySelect} />

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Contact</label>
          <select
            value={form.contact_id}
            onChange={set('contact_id')}
            disabled={!companyId}
            className={inputCls}
          >
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Task Type *</label>
            <select required value={form.task_type} onChange={set('task_type')} className={inputCls}>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Due Date</label>
            <input type="date" value={form.due_date} onChange={set('due_date')} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Assigned To</label>
            <select value={form.assigned_to} onChange={set('assigned_to')} className={inputCls}>
              <option value="">— Unassigned —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Task Status</label>
            <select value={form.task_status} onChange={set('task_status')} className={inputCls}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
          <textarea rows={3} value={form.notes} onChange={set('notes')} className={inputCls} />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
