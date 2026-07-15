import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, NotebookPen, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TASK_FILTERS, TASK_TYPES, TASK_STATUSES, TASK_STATUS_COLORS } from '../lib/constants'
import { formatDate, todayISO } from '../lib/format'
import TaskModal from '../components/tasks/TaskModal'
import NoteFlowModal from '../components/tasks/NoteFlowModal'
import InlineEditCell from '../components/ui/InlineEditCell'
import SortableHeader from '../components/ui/SortableHeader'

function daysFromToday(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Tasks() {
  const { user, isAdmin } = useAuth()
  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewAll, setViewAll] = useState(false)
  const [repFilter, setRepFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState({ key: 'due_date', dir: 'asc' })
  const [editing, setEditing] = useState(null) // null | 'new' | task object
  const [noting, setNoting] = useState(null) // null | task object
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    let query = supabase
      .from('tasks')
      .select(
        '*, company:companies(id, name), contact:contacts(id, full_name), assignee:profiles!tasks_assigned_to_fkey(id, full_name, email)',
      )
      .order('due_date', { ascending: true, nullsFirst: false })
    if (!(isAdmin && viewAll)) query = query.eq('assigned_to', user.id)
    const { data } = await query
    setTasks(data ?? [])
    setLoading(false)
  }, [user.id, isAdmin, viewAll])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!isAdmin || !viewAll) return
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name')
      .then(({ data }) => setProfiles(data ?? []))
  }, [isAdmin, viewAll])

  const today = todayISO()
  const weekEnd = daysFromToday(6)
  const showRep = isAdmin && viewAll

  const hasFilters = Boolean(search || typeFilter !== 'all' || statusFilter !== 'all' || (showRep && repFilter !== 'all') || dateFilter !== 'All')
  const clearFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setStatusFilter('all')
    setRepFilter('all')
    setDateFilter('All')
  }

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = viewAll && repFilter !== 'all' ? tasks.filter((t) => t.assigned_to === repFilter) : tasks
    if (dateFilter === 'Past Due') list = list.filter((t) => t.due_date && t.due_date < today)
    else if (dateFilter === 'Due Today') list = list.filter((t) => t.due_date === today)
    else if (dateFilter === 'Due This Week') {
      list = list.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd)
    }
    if (typeFilter !== 'all') list = list.filter((t) => t.task_type === typeFilter)
    if (statusFilter !== 'all') list = list.filter((t) => (t.task_status ?? 'Open') === statusFilter)
    if (q) {
      list = list.filter((t) => [t.company?.name, t.contact?.full_name].some((v) => v?.toLowerCase().includes(q)))
    }
    return list
  }, [tasks, viewAll, repFilter, dateFilter, typeFilter, statusFilter, search, today, weekEnd])

  const sorted = useMemo(() => {
    const list = [...visible]
    list.sort((a, b) => {
      let av
      let bv
      if (sort.key === 'company') {
        av = a.company?.name ?? ''
        bv = b.company?.name ?? ''
      } else if (sort.key === 'contact') {
        av = a.contact?.full_name ?? ''
        bv = b.contact?.full_name ?? ''
      } else {
        av = a[sort.key]
        bv = b[sort.key]
      }
      let cmp
      if (sort.key === 'due_date') {
        // nulls last regardless of direction
        if (!av && !bv) cmp = 0
        else if (!av) cmp = 1
        else if (!bv) cmp = -1
        else cmp = new Date(av) - new Date(bv)
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''))
      }
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return list
  }, [visible, sort])

  const saveField = async (id, field, value) => {
    const { error } = await supabase.from('tasks').update({ [field]: value }).eq('id', id)
    if (error) throw error
    if (field === 'assigned_to') {
      const assignee = profiles.find((p) => p.id === value) ?? null
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, assigned_to: value, assignee } : t)))
    } else {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)))
    }
  }

  const handleDelete = async (task) => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) {
      setNotice(
        error.code === '23503'
          ? 'Cannot delete: this task has notes linked to it.'
          : `Delete failed: ${error.message}`,
      )
      return
    }
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
              <button
                onClick={() => setViewAll(false)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  !viewAll ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My Tasks
              </button>
              <button
                onClick={() => setViewAll(true)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  viewAll ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Tasks
              </button>
            </div>
          )}
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add Task
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

      <div className="mb-4 flex rounded-lg border border-slate-300 bg-white p-0.5 w-fit">
        {TASK_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              dateFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company or contact…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All task types</option>
          {TASK_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {showRep && (
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
        )}
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
              <SortableHeader label="Company" sortKey="company" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Contact" sortKey="contact" sort={sort} onSort={toggleSort} />
              {showRep && <th className="px-4 py-3">Assigned User</th>}
              <SortableHeader label="Task Type" sortKey="task_type" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Due Date" sortKey="due_date" sort={sort} onSort={toggleSort} />
              <SortableHeader label="Task Status" sortKey="task_status" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Loading tasks…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No tasks found.
                </td>
              </tr>
            ) : (
              sorted.map((t) => {
                const pastDue = Boolean(t.due_date && t.due_date < today)
                return (
                  <tr key={t.id} className={pastDue ? 'bg-red-50' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3">
                      {t.company ? (
                        <Link to={`/companies/${t.company.id}`} className="text-indigo-600 hover:underline">
                          {t.company.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.contact ? (
                        <Link to={`/contacts/${t.contact.id}`} className="text-indigo-600 hover:underline">
                          {t.contact.full_name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    {showRep && (
                      <td className="px-2 py-1 text-slate-600">
                        <InlineEditCell
                          value={t.assigned_to ?? ''}
                          type="select"
                          options={[{ value: '', label: '— Unassigned —' }, ...profiles.map((p) => ({ value: p.id, label: p.full_name || p.email }))]}
                          onSave={(v) => saveField(t.id, 'assigned_to', v || null)}
                          displayValue={t.assignee?.full_name || t.assignee?.email || '—'}
                        />
                      </td>
                    )}
                    <td className="px-2 py-1 text-slate-600">
                      <InlineEditCell
                        value={t.task_type ?? ''}
                        type="select"
                        options={TASK_TYPES.map((tt) => ({ value: tt, label: tt }))}
                        onSave={(v) => saveField(t.id, 'task_type', v)}
                        displayValue={t.task_type ?? '—'}
                      />
                    </td>
                    <td className={`px-2 py-1 font-medium ${pastDue ? 'text-red-600' : 'text-slate-600'}`}>
                      <InlineEditCell
                        value={t.due_date ?? ''}
                        type="date"
                        onSave={(v) => saveField(t.id, 'due_date', v || null)}
                        displayValue={formatDate(t.due_date)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <InlineEditCell
                        value={t.task_status ?? 'Open'}
                        type="select"
                        options={TASK_STATUSES.map((s) => ({ value: s, label: s }))}
                        onSave={(v) => saveField(t.id, 'task_status', v)}
                        displayValue={
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TASK_STATUS_COLORS[t.task_status ?? 'Open']}`}>
                            {t.task_status ?? 'Open'}
                          </span>
                        }
                      />
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={t.notes ?? ''}>
                      {t.notes || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setNoting(t)}
                          title="Create Note"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                        >
                          <NotebookPen className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditing(t)}
                          title="Edit"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          title="Delete"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <TaskModal
          task={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
      {noting && (
        <NoteFlowModal
          task={noting}
          onClose={() => setNoting(null)}
          onDone={() => {
            setNoting(null)
            load()
          }}
        />
      )}
    </div>
  )
}
