import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Upload, Pencil, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ICP_CATEGORIES, ICP_CATEGORY_LABELS, ICP_CATEGORY_COLORS } from '../lib/constants'
import { formatDate, sanitize } from '../lib/format'
import ContactModal from '../components/contacts/ContactModal'
import ImportModal from '../components/contacts/ImportModal'
import InlineEditCell from '../components/ui/InlineEditCell'
import SortableHeader from '../components/ui/SortableHeader'
import CompanySearchSelect from '../components/ui/CompanySearchSelect'

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [companies, setCompanies] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [icpFilter, setIcpFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('')
  const [repFilter, setRepFilter] = useState('all')
  const [filterResetKey, setFilterResetKey] = useState(0)
  const [sort, setSort] = useState({ key: 'full_name', dir: 'asc' })
  const [editing, setEditing] = useState(null) // null | 'new' | contact object
  const [showImport, setShowImport] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const [contactsRes, companiesRes, profilesRes] = await Promise.all([
      supabase
        .from('contacts')
        .select('*, company:companies(id, name), assignee:profiles!contacts_assigned_to_fkey(id, full_name, email)')
        .order('created_at', { ascending: false }),
      supabase.from('companies').select('id, name').order('name'),
      supabase.from('profiles').select('id, full_name, email').order('full_name'),
    ])
    setContacts(contactsRes.data ?? [])
    setCompanies(companiesRes.data ?? [])
    setProfiles(profilesRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const hasFilters = Boolean(search || icpFilter !== 'all' || companyFilter || repFilter !== 'all')
  const clearFilters = () => {
    setSearch('')
    setIcpFilter('all')
    setCompanyFilter('')
    setRepFilter('all')
    setFilterResetKey((k) => k + 1)
  }

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'created_at' ? 'desc' : 'asc' }))
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts.filter((c) => {
      if (icpFilter !== 'all' && c.icp_category !== icpFilter) return false
      if (companyFilter && c.company_id !== companyFilter) return false
      if (repFilter !== 'all' && c.assigned_to !== repFilter) return false
      if (!q) return true
      return [c.full_name, c.company?.name, c.email].some((v) => v?.toLowerCase().includes(q))
    })
  }, [contacts, search, icpFilter, companyFilter, repFilter])

  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      let av
      let bv
      if (sort.key === 'company') {
        av = a.company?.name ?? ''
        bv = b.company?.name ?? ''
      } else if (sort.key === 'icp_category') {
        av = a.icp_category ? ICP_CATEGORY_LABELS[a.icp_category] : ''
        bv = b.icp_category ? ICP_CATEGORY_LABELS[b.icp_category] : ''
      } else if (sort.key === 'assignee') {
        av = a.assignee?.full_name ?? a.assignee?.email ?? ''
        bv = b.assignee?.full_name ?? b.assignee?.email ?? ''
      } else {
        av = a[sort.key]
        bv = b[sort.key]
      }
      let cmp
      if (sort.key === 'created_at') cmp = new Date(av ?? 0) - new Date(bv ?? 0)
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''))
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return list
  }, [filtered, sort])

  const saveField = async (id, field, value) => {
    const { error } = await supabase.from('contacts').update({ [field]: value }).eq('id', id)
    if (error) throw error
    if (field === 'company_id') {
      const company = companies.find((c) => c.id === value) ?? null
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, company_id: value, company } : c)))
    } else if (field === 'assigned_to') {
      const assignee = profiles.find((p) => p.id === value) ?? null
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, assigned_to: value, assignee } : c)))
    } else {
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
    }
  }

  const handleDelete = async (contact) => {
    if (!window.confirm(`Delete ${contact.full_name}? This cannot be undone.`)) return
    const { error } = await supabase.from('contacts').delete().eq('id', contact.id)
    if (error) {
      setNotice(
        error.code === '23503'
          ? 'Cannot delete: this contact is linked to one or more deals.'
          : `Delete failed: ${error.message}`,
      )
      return
    }
    setContacts((prev) => prev.filter((c) => c.id !== contact.id))
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            Apollo Import
          </button>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add Contact
          </button>
        </div>
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {notice}
          <button onClick={() => setNotice('')} className="font-medium">
            ✕
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, or email…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={icpFilter}
          onChange={(e) => setIcpFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All ICP categories</option>
          {ICP_CATEGORIES.map((i) => (
            <option key={i} value={i}>
              {ICP_CATEGORY_LABELS[i]}
            </option>
          ))}
        </select>
        <div className="w-56">
          <CompanySearchSelect
            key={filterResetKey}
            value={companyFilter}
            onSelect={(company) => setCompanyFilter(company?.id ?? '')}
            label=""
          />
        </div>
        <select
          value={repFilter}
          onChange={(e) => setRepFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All reps</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name || p.email}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 pb-2 text-sm font-medium text-slate-500 hover:text-indigo-600"
          >
            <X className="h-3.5 w-3.5" />
            Clear Filters
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <SortableHeader label="Full Name" sortKey="full_name" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Company" sortKey="company" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Title</th>
              <SortableHeader label="ICP Category" sortKey="icp_category" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Assigned To" sortKey="assignee" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Date Added" sortKey="created_at" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Loading contacts…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No contacts found.
                </td>
              </tr>
            ) : (
              sorted.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-2 py-1 font-medium">
                    <InlineEditCell
                      value={c.full_name}
                      onSave={(v) => saveField(c.id, 'full_name', sanitize(v, 200))}
                      displayValue={
                        <Link to={`/contacts/${c.id}`} onClick={(e) => e.stopPropagation()} className="text-indigo-600 hover:underline">
                          {c.full_name}
                        </Link>
                      }
                    />
                  </td>
                  <td className="px-2 py-1 text-slate-600">
                    <InlineEditCell
                      value={c.company_id ?? ''}
                      type="select"
                      options={[{ value: '', label: '— None —' }, ...companies.map((co) => ({ value: co.id, label: co.name }))]}
                      onSave={(v) => saveField(c.id, 'company_id', v || null)}
                      displayValue={
                        c.company ? (
                          <Link to={`/companies/${c.company.id}`} onClick={(e) => e.stopPropagation()} className="text-indigo-600 hover:underline">
                            {c.company.name}
                          </Link>
                        ) : (
                          '—'
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.title ?? '—'}</td>
                  <td className="px-2 py-1">
                    <InlineEditCell
                      value={c.icp_category ?? ''}
                      type="select"
                      options={[{ value: '', label: '— None —' }, ...ICP_CATEGORIES.map((i) => ({ value: i, label: ICP_CATEGORY_LABELS[i] }))]}
                      onSave={(v) => saveField(c.id, 'icp_category', v || null)}
                      displayValue={
                        c.icp_category ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ICP_CATEGORY_COLORS[c.icp_category]}`}>
                            {ICP_CATEGORY_LABELS[c.icp_category]}
                          </span>
                        ) : (
                          '—'
                        )
                      }
                    />
                  </td>
                  <td className="px-2 py-1 text-slate-600">
                    <InlineEditCell
                      value={c.assigned_to ?? ''}
                      type="select"
                      options={[{ value: '', label: '— Unassigned —' }, ...profiles.map((p) => ({ value: p.id, label: p.full_name || p.email }))]}
                      onSave={(v) => saveField(c.id, 'assigned_to', v || null)}
                      displayValue={c.assignee?.full_name || c.assignee?.email || '—'}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(c)}
                        title="Edit"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        title="Delete"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ContactModal
          contact={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false)
            load()
          }}
        />
      )}
    </div>
  )
}
