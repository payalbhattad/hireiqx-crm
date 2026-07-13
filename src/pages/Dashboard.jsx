import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { DollarSign, Trophy, Clock, Briefcase, Phone, Mail, FileText, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STAGES, OPEN_STAGES } from '../lib/constants'
import { formatCurrency, formatDateTime, todayISO } from '../lib/format'

const ACTIVITY_ICONS = { call: Phone, email: Mail, note: FileText, meeting: Users }

function StatCard({ icon: Icon, label, value, tint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuth()
  const [deals, setDeals] = useState([])
  const [activities, setActivities] = useState([])
  const [tasksDueToday, setTasksDueToday] = useState(0)
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = todayISO()
    Promise.all([
      supabase.from('deals').select('id, title, value, stage, assigned_to, updated_at'),
      supabase
        .from('activities')
        .select('*, deal:deals(id, title), creator:profiles!activities_created_by_fkey(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('due_date', today)
        .eq('completed', false),
      supabase.from('profiles').select('id, full_name, email'),
    ]).then(([dealsRes, actsRes, tasksRes, profilesRes]) => {
      setDeals(dealsRes.data ?? [])
      setActivities(actsRes.data ?? [])
      setTasksDueToday(tasksRes.count ?? 0)
      setProfiles(profilesRes.data ?? [])
      setLoading(false)
    })
  }, [])

  const stats = useMemo(() => {
    const open = deals.filter((d) => OPEN_STAGES.includes(d.stage))
    const now = new Date()
    const closedThisMonth = deals.filter((d) => {
      if (d.stage !== 'closed_won') return false
      const closed = new Date(d.updated_at)
      return closed.getFullYear() === now.getFullYear() && closed.getMonth() === now.getMonth()
    })
    return {
      pipelineValue: open.reduce((s, d) => s + (Number(d.value) || 0), 0),
      closedThisMonth: closedThisMonth.length,
      openDeals: open.length,
    }
  }, [deals])

  const chartData = useMemo(
    () =>
      STAGES.map((s) => ({
        stage: s.label,
        count: deals.filter((d) => d.stage === s.id).length,
      })),
    [deals],
  )

  const leaderboard = useMemo(() => {
    if (!isAdmin) return []
    return profiles
      .map((p) => {
        const won = deals.filter((d) => d.assigned_to === p.id && d.stage === 'closed_won')
        return {
          ...p,
          closedCount: won.length,
          closedValue: won.reduce((s, d) => s + (Number(d.value) || 0), 0),
        }
      })
      .sort((a, b) => b.closedValue - a.closedValue)
  }, [isAdmin, profiles, deals])

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading dashboard…</div>
  }

  return (
    <div className="p-8">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500">
        Welcome back, {profile?.full_name || profile?.email}
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Total Pipeline Value"
          value={formatCurrency(stats.pipelineValue)}
          tint="bg-indigo-100 text-indigo-600"
        />
        <StatCard
          icon={Trophy}
          label="Closed This Month"
          value={stats.closedThisMonth}
          tint="bg-green-100 text-green-600"
        />
        <StatCard
          icon={Clock}
          label="Tasks Due Today"
          value={tasksDueToday}
          tint="bg-yellow-100 text-yellow-600"
        />
        <StatCard
          icon={Briefcase}
          label="Open Deals"
          value={stats.openDeals}
          tint="bg-blue-100 text-blue-600"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Deals by Stage</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="stage"
                tick={{ fontSize: 11, fill: '#64748b' }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={54}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Recent Activity</h2>
          {activities.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No recent activity.</p>
          ) : (
            <ul className="space-y-3">
              {activities.map((a) => {
                const Icon = ACTIVITY_ICONS[a.type] ?? FileText
                return (
                  <li key={a.id} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                      <Icon className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-700">{a.body}</p>
                      <p className="text-xs text-slate-400">
                        {a.creator?.full_name || a.creator?.email || 'Unknown'}
                        {a.deal && (
                          <>
                            {' · '}
                            <Link to={`/deals/${a.deal.id}`} className="text-indigo-600 hover:underline">
                              {a.deal.title}
                            </Link>
                          </>
                        )}
                        {' · '}
                        {formatDateTime(a.created_at)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">Rep Leaderboard</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2">Rep</th>
                <th className="pb-2">Deals Closed</th>
                <th className="pb-2">Total Value Closed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaderboard.map((rep) => (
                <tr key={rep.id}>
                  <td className="py-2 font-medium text-slate-900">{rep.full_name || rep.email}</td>
                  <td className="py-2 text-slate-600">{rep.closedCount}</td>
                  <td className="py-2 font-medium text-green-600">{formatCurrency(rep.closedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
