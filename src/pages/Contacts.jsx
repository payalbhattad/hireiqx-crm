import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Upload, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SOURCES, SOURCE_COLORS } from '../lib/constants'
import { formatDate } from '../lib/format'
import ContactModal from '../components/contacts/ContactModal'
import ImportModal from '../components/contacts/ImportModal'

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [editing, setEditing] = useState(null) // null | 'new' | contact object
  const [showImport, setShowImport] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })
    setContacts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts.filter((c) => {
      if (sourceFilter !== 'all' && c.source !== sourceFilter) return false
      if (!q) return true
      return [c.full_name, c.company, c.email].some((v) => v?.toLowerCase().includes(q))
    })
  }, [contacts, search, sourceFilter])

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

      <div className="mb-4 flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, or email…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Full Name</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Date Added</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Loading contacts…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No contacts found.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.company ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.title ?? '—'}</td>
                  <td className="px-4 py-3">
                    {c.source ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_COLORS[c.source]}`}
                      >
                        {c.source}
                      </span>
                    ) : (
                      '—'
                    )}
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
