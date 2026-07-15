import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  INDUSTRIES,
  INDUSTRY_LABELS,
  COMPANY_STATUSES,
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_COLORS,
} from '../lib/constants'
import { formatCurrency, formatDate, sanitize } from '../lib/format'
import CompanyModal from '../components/companies/CompanyModal'
import InlineEditCell from '../components/ui/InlineEditCell'
import SortableHeader from '../components/ui/SortableHeader'

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [industryFilter, setIndustryFilter] = useState('all')
  const [repFilter, setRepFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [editing, setEditing] = useState(null) // null | 'new' | company object
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const [companiesRes, profilesRes] = await Promise.all([
      supabase
        .from('companies')
        .select('*, rep:profiles!companies_assigned_rep_fkey(id, full_name, email)')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email').order('full_name'),
    ])
    setCompanies(companiesRes.data ?? [])
    setProfiles(profilesRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const hasFilters = Boolean(search || statusFilter !== 'all' || industryFilter !== 'all' || repFilter !== 'all')
  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setIndustryFilter('all')
    setRepFilter('all')
  }

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'created_at' || key === 'annual_revenue' ? 'desc' : 'asc' }))
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return companies.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (industryFilter !== 'all' && c.industry !== industryFilter) return false
      if (repFilter !== 'all' && c.assigned_rep !== repFilter) return false
      if (!q) return true
      return c.name?.toLowerCase().includes(q)
    })
  }, [companies, search, statusFilter, industryFilter, repFilter])

  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      let av
      let bv
      if (sort.key === 'industry') {
        av = a.industry ? INDUSTRY_LABELS[a.industry] : ''
        bv = b.industry ? INDUSTRY_LABELS[b.industry] : ''
      } else if (sort.key === 'rep') {
        av = a.rep?.full_name ?? a.rep?.email ?? ''
        bv = b.rep?.full_name ?? b.rep?.email ?? ''
      } else {
        av = a[sort.key]
        bv = b[sort.key]
      }
      let cmp
      if (sort.key === 'created_at') cmp = new Date(av ?? 0) - new Date(bv ?? 0)
      else if (sort.key === 'annual_revenue') cmp = (Number(av) || 0) - (Number(bv) || 0)
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''))
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return list
  }, [filtered, sort])

  const saveField = async (id, field, value) => {
    const { error } = await supabase.from('companies').update({ [field]: value }).eq('id', id)
    if (error) throw error
    if (field === 'assigned_rep') {
      const rep = profiles.find((p) => p.id === value) ?? null
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, assigned_rep: value, rep } : c)))
    } else {
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
    }
  }

  const handleDelete = async (company) => {
    if (!window.confirm(`Delete ${company.name}? This cannot be undone.`)) return
    const { error } = await supabase.from('companies').delete().eq('id', company.id)
    if (error) {
      setNotice(
        error.code === '23503'
          ? 'Cannot delete: this company is linked to one or more contacts.'
          : `Delete failed: ${error.message}`,
      )
      return
    }
    setCompanies((prev) => prev.filter((c) => c.id !== company.id))
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Add Company
        </button>
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {notice}
          <button onClick={() => setNotice('')} className="font-medium">
            ✕
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company name…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All industries</option>
          {INDUSTRIES.map((i) => (
            <option key={i} value={i}>
              {INDUSTRY_LABELS[i]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All statuses</option>
          {COMPANY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {COMPANY_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
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
            className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600"
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
              <SortableHeader label="Name" sortKey="name" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3">Domain</th>
              <SortableHeader label="Industry" sortKey="industry" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Assigned Rep" sortKey="rep" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Annual Revenue" sortKey="annual_revenue" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Date Added" sortKey="created_at" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Loading companies…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No companies found.
                </td>
              </tr>
            ) : (
              sorted.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-2 py-1 font-medium">
                    <InlineEditCell
                      value={c.name}
                      onSave={(v) => saveField(c.id, 'name', sanitize(v, 200))}
                      displayValue={
                        <Link to={`/companies/${c.id}`} onClick={(e) => e.stopPropagation()} className="text-indigo-600 hover:underline">
                          {c.name}
                        </Link>
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.domain ?? '—'}</td>
                  <td className="px-2 py-1 text-slate-600">
                    <InlineEditCell
                      value={c.industry ?? ''}
                      type="select"
                      options={[{ value: '', label: '— None —' }, ...INDUSTRIES.map((i) => ({ value: i, label: INDUSTRY_LABELS[i] }))]}
                      onSave={(v) => saveField(c.id, 'industry', v || null)}
                      displayValue={c.industry ? INDUSTRY_LABELS[c.industry] : '—'}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <InlineEditCell
                      value={c.status}
                      type="select"
                      options={COMPANY_STATUSES.map((s) => ({ value: s, label: COMPANY_STATUS_LABELS[s] }))}
                      onSave={(v) => saveField(c.id, 'status', v)}
                      displayValue={
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COMPANY_STATUS_COLORS[c.status]}`}>
                          {COMPANY_STATUS_LABELS[c.status]}
                        </span>
                      }
                    />
                  </td>
                  <td className="px-2 py-1 text-slate-600">
                    <InlineEditCell
                      value={c.assigned_rep ?? ''}
                      type="select"
                      options={[{ value: '', label: '— Unassigned —' }, ...profiles.map((p) => ({ value: p.id, label: p.full_name || p.email }))]}
                      onSave={(v) => saveField(c.id, 'assigned_rep', v || null)}
                      displayValue={c.rep?.full_name || c.rep?.email || '—'}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.annual_revenue != null ? formatCurrency(c.annual_revenue) : '—'}</td>
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
        <CompanyModal
          company={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
