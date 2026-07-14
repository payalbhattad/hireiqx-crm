import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { INDUSTRY_LABELS, COMPANY_STATUSES, COMPANY_STATUS_LABELS, COMPANY_STATUS_COLORS } from '../lib/constants'
import { formatDate } from '../lib/format'
import CompanyModal from '../components/companies/CompanyModal'

export default function Companies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState(null) // null | 'new' | company object
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false })
    setCompanies(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return companies.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!q) return true
      return [c.name, c.domain, c.website].some((v) => v?.toLowerCase().includes(q))
    })
  }, [companies, search, statusFilter])

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

      <div className="mb-4 flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or domain…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
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
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">Industry</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Date Added</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Loading companies…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No companies found.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/companies/${c.id}`} className="text-indigo-600 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.domain ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.industry ? INDUSTRY_LABELS[c.industry] : '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${COMPANY_STATUS_COLORS[c.status]}`}
                    >
                      {COMPANY_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.size ?? '—'}</td>
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
