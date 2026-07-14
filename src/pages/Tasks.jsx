import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, NotebookPen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TASK_FILTERS, TASK_STATUSES, TASK_STATUS_COLORS } from '../lib/constants'
import { formatDate, todayISO } from '../lib/format'
import TaskModal from '../components/tasks/TaskModal'
import NoteFlowModal from '../components/tasks/NoteFlowModal'

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

  const visible = useMemo(() => {
    let list = viewAll && repFilter !== 'all' ? tasks.filter((t) => t.assigned_to === repFilter) : tasks
    if (dateFilter === 'Past Due') list = list.filter((t) => t.due_date && t.due_date < today)
    else if (dateFilter === 'Due Today') list = list.filter((t) => t.due_date === today)
    else if (dateFilter === 'Due This Week') {
      list = list.filter((t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd)
    }
    return list
  }, [tasks, viewAll, repFilter, dateFilter, today, weekEnd])

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

  const handleStatusChange = async (task, status) => {
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, task_status: status } : t)))
    await supabase.from('tasks').update({ task_status: status }).eq('id', task.id)
  }

  const showRep = isAdmin && viewAll

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <>
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
              {viewAll && (
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
            </>
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Contact</th>
              {showRep && <th className="px-4 py-3">Assigned User</th>}
              <th className="px-4 py-3">Task Type</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Task Status</th>
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
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No tasks found.
                </td>
              </tr>
            ) : (
              visible.map((t) => {
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
                      <td className="px-4 py-3 text-slate-600">
                        {t.assignee?.full_name || t.assignee?.email || '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-600">{t.task_type ?? '—'}</td>
                    <td className={`px-4 py-3 font-medium ${pastDue ? 'text-red-600' : 'text-slate-600'}`}>
                      {formatDate(t.due_date)}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={t.task_status ?? 'Open'}
                        onChange={(e) => handleStatusChange(t, e.target.value)}
                        className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 ${TASK_STATUS_COLORS[t.task_status ?? 'Open']}`}
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
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
