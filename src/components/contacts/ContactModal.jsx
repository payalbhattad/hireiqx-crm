import { useState } from 'react'
import Modal from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { SOURCES } from '../../lib/constants'
import { sanitize } from '../../lib/format'

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function ContactModal({ contact, onClose, onSaved }) {
  const { user } = useAuth()
  const isEdit = Boolean(contact)
  const [form, setForm] = useState({
    full_name: contact?.full_name ?? '',
    company: contact?.company ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    title: contact?.title ?? '',
    source: contact?.source ?? 'outbound',
    notes: contact?.notes ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    const payload = {
      full_name: sanitize(form.full_name, 200),
      company: sanitize(form.company, 200) || null,
      email: sanitize(form.email, 254).toLowerCase() || null,
      phone: sanitize(form.phone, 50) || null,
      title: sanitize(form.title, 200) || null,
      source: SOURCES.includes(form.source) ? form.source : 'outbound',
      notes: sanitize(form.notes, 5000) || null,
    }

    if (!payload.full_name) {
      setError('Full name is required.')
      setSaving(false)
      return
    }

    const query = isEdit
      ? supabase.from('contacts').update(payload).eq('id', contact.id)
      : supabase.from('contacts').insert({ ...payload, created_by: user.id })

    const { error: dbError } = await query
    if (dbError) {
      setError(
        dbError.code === '23505' ? 'A contact with this email already exists.' : dbError.message,
      )
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Edit Contact' : 'Add Contact'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Full Name *</label>
          <input required value={form.full_name} onChange={set('full_name')} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Company</label>
            <input value={form.company} onChange={set('company')} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input value={form.title} onChange={set('title')} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input type="email" value={form.email} onChange={set('email')} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
            <input value={form.phone} onChange={set('phone')} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Source</label>
          <select value={form.source} onChange={set('source')} className={inputCls}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
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
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
