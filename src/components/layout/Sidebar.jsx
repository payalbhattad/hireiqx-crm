import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  CheckSquare,
  Settings,
  LogOut,
  Briefcase,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { initials } from '../../lib/format'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
]

export default function Sidebar() {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-slate-900">
      <div className="flex items-center gap-2 px-5 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <Briefcase className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-semibold text-white">HireIQX CRM</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
            {initials(profile?.full_name || profile?.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {profile?.full_name || profile?.email}
            </p>
            <span
              className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {profile?.role ?? 'rep'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
