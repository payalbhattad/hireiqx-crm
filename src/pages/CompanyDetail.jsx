import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Mail, Phone, Building2, Globe, Link2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  INDUSTRIES,
  INDUSTRY_LABELS,
  COMPANY_STATUSES,
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_COLORS,
  COMPANY_SIZES,
  ICP_CATEGORY_LABELS,
  ICP_CATEGORY_COLORS,
} from '../lib/constants'
import { sanitize } from '../lib/format'
import ContactModal from '../components/contacts/ContactModal'

const inputCls =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function CompanyDetail() {
  const { id } = useParams()
  const [company, setCompany] = useState(null)
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [addingContact, setAddingContact] = useState(false)

  const load = useCallback(async () => {
    const [companyRes, contactsRes] = await Promise.all([
      supabase.from('companies').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('contacts')
        .select('*')
        .eq('company_id', id)
        .order('full_name', { ascending: true }),
    ])
    setCompany(companyRes.data ?? null)
    setName(companyRes.data?.name ?? '')
    setContacts(contactsRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const updateCompany = async (patch) => {
    setCompany((c) => ({ ...c, ...patch }))
    await supabase.from('companies').update(patch).eq('id', id)
  }

  const handleNameBlur = () => {
    const clean = sanitize(name, 200)
    if (clean && clean !== company.name) updateCompany({ name: clean })
    else setName(company.name)
  }

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading company…</div>
  }

  if (!company) {
    return (
      <div className="p-8">
        <p className="text-slate-600">Company not found.</p>
        <Link to="/companies" className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline">
          ← Back to Companies
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8">
      <Link to="/companies" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600">
        <ArrowLeft className="h-4 w-4" />
        Companies
      </Link>

      {/* Header */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-64 flex-1 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
              className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-xl font-bold text-slate-900 hover:border-slate-200 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${COMPANY_STATUS_COLORS[company.status]}`}>
            {COMPANY_STATUS_LABELS[company.status]}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-6">
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Status</p>
            <select
              value={company.status}
              onChange={(e) => updateCompany({ status: e.target.value })}
              className={`mt-1 ${inputCls}`}
            >
              {COMPANY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {COMPANY_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Industry</p>
            <select
              value={company.industry ?? ''}
              onChange={(e) => updateCompany({ industry: e.target.value || null })}
              className={`mt-1 ${inputCls}`}
            >
              <option value="">— None —</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {INDUSTRY_LABELS[i]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Size</p>
            <select
              value={company.size ?? ''}
              onChange={(e) => updateCompany({ size: e.target.value || null })}
              className={`mt-1 ${inputCls}`}
            >
              <option value="">— None —</option>
              {COMPANY_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} employees
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Phone</p>
            <input
              defaultValue={company.phone ?? ''}
              onBlur={(e) => updateCompany({ phone: sanitize(e.target.value, 50) || null })}
              className={`mt-1 w-40 ${inputCls}`}
            />
          </div>
        </div>
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
          {company.domain && (
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-slate-400" />
              {company.domain}
            </div>
          )}
          {company.website && (
            <a href={company.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline">
              <Globe className="h-4 w-4" />
              Website
            </a>
          )}
          {company.linkedin && (
            <a href={company.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline">
              <Link2 className="h-4 w-4" />
              LinkedIn
            </a>
          )}
        </dl>
      </div>

      {/* Contacts tab */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200">
          <div className="flex">
            <span className="border-b-2 border-indigo-600 px-5 py-3 text-sm font-medium text-indigo-600">
              Contacts ({contacts.length})
            </span>
          </div>
          <button
            onClick={() => setAddingContact(true)}
            className="mr-4 flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </button>
        </div>

        <div className="p-5">
          {contacts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No contacts linked to this company yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {contacts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Link to={`/contacts/${c.id}`} className="font-medium text-indigo-600 hover:underline">
                    {c.full_name}
                  </Link>
                  {c.title && <span className="text-sm text-slate-500">{c.title}</span>}
                  {c.icp_category && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ICP_CATEGORY_COLORS[c.icp_category]}`}>
                      {ICP_CATEGORY_LABELS[c.icp_category]}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {c.phone}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {addingContact && (
        <ContactModal
          contact={null}
          initialCompanyId={id}
          onClose={() => setAddingContact(false)}
          onSaved={() => {
            setAddingContact(false)
            load()
          }}
        />
      )}
    </div>
  )
}
