import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { INDUSTRIES, INDUSTRY_LABELS, COMPANY_STATUSES, COMPANY_STATUS_LABELS, COMPANY_SIZES } from '../../lib/constants'
import { sanitize } from '../../lib/format'

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function CompanyModal({ company, onClose, onSaved }) {
  const { user } = useAuth()
  const isEdit = Boolean(company)
  const [profiles, setProfiles] = useState([])
  const [form, setForm] = useState({
    name: company?.name ?? '',
    domain: company?.domain ?? '',
    website: company?.website ?? '',
    industry: company?.industry ?? '',
    status: company?.status ?? 'New',
    size: company?.size ?? '',
    phone: company?.phone ?? '',
    address: company?.address ?? '',
    linkedin: company?.linkedin ?? '',
    assigned_rep: company?.assigned_rep ?? '',
    annual_revenue: company?.annual_revenue ?? '',
    notes: company?.notes ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name')
      .then(({ data }) => setProfiles(data ?? []))
  }, [])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    const payload = {
      name: sanitize(form.name, 200),
      domain: sanitize(form.domain, 200) || null,
      website: sanitize(form.website, 300) || null,
      industry: INDUSTRIES.includes(form.industry) ? form.industry : null,
      status: COMPANY_STATUSES.includes(form.status) ? form.status : 'New',
      size: COMPANY_SIZES.includes(form.size) ? form.size : null,
      phone: sanitize(form.phone, 50) || null,
      address: sanitize(form.address, 300) || null,
      linkedin: sanitize(form.linkedin, 300) || null,
      assigned_rep: form.assigned_rep || null,
      annual_revenue: form.annual_revenue === '' ? null : Number(form.annual_revenue),
      notes: sanitize(form.notes, 5000) || null,
    }

    if (!payload.name) {
      setError('Company name is required.')
      setSaving(false)
      return
    }

    const query = isEdit
      ? supabase.from('companies').update(payload).eq('id', company.id)
      : supabase.from('companies').insert({ ...payload, created_by: user.id })

    const { error: dbError } = await query
    if (dbError) {
      setError(dbError.message)
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Edit Company' : 'Add Company'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Company Name *</label>
          <input required value={form.name} onChange={set('name')} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Domain</label>
            <input value={form.domain} onChange={set('domain')} placeholder="acme.com" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Website</label>
            <input value={form.website} onChange={set('website')} placeholder="https://acme.com" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Industry</label>
            <select value={form.industry} onChange={set('industry')} className={inputCls}>
              <option value="">— Select —</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {INDUSTRY_LABELS[i]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select value={form.status} onChange={set('status')} className={inputCls}>
              {COMPANY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {COMPANY_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Company Size</label>
            <select value={form.size} onChange={set('size')} className={inputCls}>
              <option value="">— Select —</option>
              {COMPANY_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} employees
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
            <input value={form.phone} onChange={set('phone')} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">LinkedIn</label>
          <input value={form.linkedin} onChange={set('linkedin')} placeholder="https://linkedin.com/company/acme" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Assigned Rep</label>
            <select value={form.assigned_rep} onChange={set('assigned_rep')} className={inputCls}>
              <option value="">— Unassigned —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Annual Revenue ($)</label>
            <input type="number" min="0" step="any" value={form.annual_revenue} onChange={set('annual_revenue')} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
          <input value={form.address} onChange={set('address')} className={inputCls} />
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
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Company'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
