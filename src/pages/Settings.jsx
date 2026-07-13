import { useCallback, useEffect, useState } from 'react'
import { UserPlus, ShieldCheck, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatDate, sanitize } from '../lib/format'
import Modal from '../components/ui/Modal'

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

function InviteModal({ onClose, onInvited }) {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('rep')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: sanitize(email, 254).toLowerCase(), role }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Invite failed (${res.status})`)
      }
      onInvited()
    } catch (err) {
      setError(err.message)
      setSending(false)
    }
  }

  return (
    <Modal title="Invite User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="newrep@hireiqx.com"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            <option value="rep">Rep</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setUsers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleRole = async (u) => {
    if (u.id === user.id) {
      setNotice("You can't change your own role.")
      return
    }
    const newRole = u.role === 'admin' ? 'rep' : 'admin'
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', u.id)
    if (error) {
      setNotice(`Role update failed: ${error.message}`)
      return
    }
    setUsers((prev) => prev.map((p) => (p.id === u.id ? { ...p, role: newRole } : p)))
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Settings</h1>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase text-slate-500">User Management</h2>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <UserPlus className="h-4 w-4" />
            Invite User
          </button>
        </div>

        {notice && (
          <div className="mx-5 mt-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {notice}
            <button onClick={() => setNotice('')} className="font-medium">
              ✕
            </button>
          </div>
        )}

        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                  Loading users…
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {u.full_name || '—'}
                    {u.id === user.id && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {u.role === 'admin' ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(u.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => toggleRole(u)}
                      disabled={u.id === user.id}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Make {u.role === 'admin' ? 'rep' : 'admin'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false)
            load()
          }}
        />
      )}
    </div>
  )
}
