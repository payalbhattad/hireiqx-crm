import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, AlertCircle, Clock, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatDate, todayISO } from '../lib/format'

function TaskRow({ task, showRep, onToggle }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <button
        onClick={() => onToggle(task)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
          task.completed
            ? 'border-green-600 bg-green-600 text-white'
            : 'border-slate-300 bg-white hover:border-indigo-500'
        }`}
      >
        {task.completed && <Check className="h-3.5 w-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
          {task.title}
        </p>
        {task.deal && (
          <Link to={`/deals/${task.deal.id}`} className="text-xs text-indigo-600 hover:underline">
            {task.deal.title}
          </Link>
        )}
      </div>
      {showRep && task.assignee && (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          {task.assignee.full_name || task.assignee.email}
        </span>
      )}
      <span className="text-xs font-medium text-slate-500">{formatDate(task.due_date)}</span>
    </li>
  )
}

function Section({ title, icon: Icon, tone, tasks, showRep, onToggle }) {
  if (tasks.length === 0) return null
  const tones = {
    red: 'text-red-600',
    yellow: 'text-yellow-600',
    slate: 'text-slate-700',
  }
  return (
    <section className="mb-8">
      <h2 className={`mb-3 flex items-center gap-2 text-sm font-semibold uppercase ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
        {title}
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
          {tasks.length}
        </span>
      </h2>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} showRep={showRep} onToggle={onToggle} />
        ))}
      </ul>
    </section>
  )
}

export default function Tasks() {
  const { user, isAdmin } = useAuth()
  const [tasks, setTasks] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewAll, setViewAll] = useState(false)
  const [repFilter, setRepFilter] = useState('all')

  const load = useCallback(async () => {
    let query = supabase
      .from('tasks')
      .select('*, deal:deals(id, title), assignee:profiles!tasks_assigned_to_fkey(id, full_name, email)')
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

  const { overdue, dueToday, upcoming, completed } = useMemo(() => {
    const visible =
      viewAll && repFilter !== 'all' ? tasks.filter((t) => t.assigned_to === repFilter) : tasks
    return {
      overdue: visible.filter((t) => !t.completed && t.due_date && t.due_date < today),
      dueToday: visible.filter((t) => !t.completed && t.due_date === today),
      upcoming: visible.filter((t) => !t.completed && (!t.due_date || t.due_date > today)),
      completed: visible.filter((t) => t.completed),
    }
  }, [tasks, viewAll, repFilter, today])

  const toggleTask = async (task) => {
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)))
    const { error } = await supabase
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', task.id)
    if (error) {
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t)))
    }
  }

  const showRep = isAdmin && viewAll

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
        {isAdmin && (
          <div className="flex items-center gap-3">
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
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading tasks…</p>
      ) : overdue.length + dueToday.length + upcoming.length + completed.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
          No tasks yet. Add tasks from a deal's Tasks tab.
        </p>
      ) : (
        <>
          <Section title="Overdue" icon={AlertCircle} tone="red" tasks={overdue} showRep={showRep} onToggle={toggleTask} />
          <Section title="Due Today" icon={Clock} tone="yellow" tasks={dueToday} showRep={showRep} onToggle={toggleTask} />
          <Section title="Upcoming" icon={CalendarDays} tone="slate" tasks={upcoming} showRep={showRep} onToggle={toggleTask} />
          <Section title="Completed" icon={Check} tone="slate" tasks={completed} showRep={showRep} onToggle={toggleTask} />
        </>
      )}
    </div>
  )
}
