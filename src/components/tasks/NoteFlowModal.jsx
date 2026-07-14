import { useState } from 'react'
import Modal from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { TASK_TYPES } from '../../lib/constants'
import { sanitize } from '../../lib/format'

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

// One flow, two steps, same modal: log a note against a task, then
// immediately offer to schedule the follow-up it usually implies.
export default function NoteFlowModal({ task, onClose, onDone }) {
  const { user } = useAuth()
  const [step, setStep] = useState('note') // 'note' | 'prompt' | 'followup'
  const [body, setBody] = useState('')
  const [followUp, setFollowUp] = useState({ due_date: '', task_type: 'Call' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSaveNote = async (e) => {
    e.preventDefault()
    const clean = sanitize(body, 5000)
    if (!clean) return
    setError('')
    setSaving(true)
    const { error: dbError } = await supabase.from('notes').insert({
      body: clean,
      contact_id: task.contact_id,
      task_id: task.id,
      created_by: user.id,
    })
    setSaving(false)
    if (dbError) {
      setError(dbError.message)
      return
    }
    setStep('prompt')
  }

  const handleSkipFollowUp = () => onDone()

  const handleCreateFollowUp = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    const { error: dbError } = await supabase.from('tasks').insert({
      company_id: task.company_id,
      contact_id: task.contact_id,
      task_type: followUp.task_type,
      due_date: followUp.due_date || null,
      assigned_to: task.assigned_to,
      task_status: 'Open',
    })
    setSaving(false)
    if (dbError) {
      setError(dbError.message)
      return
    }
    onDone()
  }

  if (step === 'note') {
    return (
      <Modal title="Create Note" onClose={onClose}>
        <form onSubmit={handleSaveNote} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Note</label>
            <textarea
              required
              autoFocus
              rows={5}
              placeholder="What happened on this task?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={inputCls}
            />
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
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Note'}
            </button>
          </div>
        </form>
      </Modal>
    )
  }

  if (step === 'prompt') {
    return (
      <Modal title="Create follow-up task?" onClose={handleSkipFollowUp}>
        <p className="mb-5 text-sm text-slate-600">
          Note saved. Would you like to schedule a follow-up task for this contact?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={handleSkipFollowUp}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            No, thanks
          </button>
          <button
            onClick={() => setStep('followup')}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Create follow-up task
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Schedule Follow-up Task" onClose={handleSkipFollowUp}>
      <form onSubmit={handleCreateFollowUp} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Due Date</label>
            <input
              type="date"
              value={followUp.due_date}
              onChange={(e) => setFollowUp((f) => ({ ...f, due_date: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Task Type</label>
            <select
              value={followUp.task_type}
              onChange={(e) => setFollowUp((f) => ({ ...f, task_type: e.target.value }))}
              className={inputCls}
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleSkipFollowUp}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
