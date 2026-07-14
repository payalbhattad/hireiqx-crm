import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Building2, Mail, Phone, Briefcase, Link2, Pencil, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ICP_CATEGORY_LABELS, ICP_CATEGORY_COLORS } from '../lib/constants'
import { formatDateTime, initials } from '../lib/format'
import ContactModal from '../components/contacts/ContactModal'

export default function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [contact, setContact] = useState(null)
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [creatingLead, setCreatingLead] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [contactRes, notesRes] = await Promise.all([
      supabase.from('contacts').select('*, company:companies(id, name)').eq('id', id).maybeSingle(),
      supabase
        .from('notes')
        .select('*, creator:profiles!notes_created_by_fkey(full_name, email)')
        .eq('contact_id', id)
        .order('created_at', { ascending: false }),
    ])
    setContact(contactRes.data ?? null)
    setNotes(notesRes.data ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleCreateLead = async () => {
    setError('')
    setCreatingLead(true)
    const title = contact.company?.name
      ? `${contact.company.name} — New Lead`
      : `${contact.full_name} — New Lead`

    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        title,
        contact_id: contact.id,
        stage: 'lead',
        assigned_to: user.id,
      })
      .select()
      .single()

    if (dealError) {
      setError(dealError.message)
      setCreatingLead(false)
      return
    }

    if (contact.company_id) {
      await supabase.from('companies').update({ status: 'Lead' }).eq('id', contact.company_id)
    }

    navigate(`/deals/${deal.id}`)
  }

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading contact…</div>
  }

  if (!contact) {
    return (
      <div className="p-8">
        <p className="text-slate-600">Contact not found.</p>
        <Link to="/contacts" className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline">
          ← Back to Contacts
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8">
      <Link to="/contacts" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600">
        <ArrowLeft className="h-4 w-4" />
        Contacts
      </Link>

      {/* Header */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-base font-semibold text-white">
              {initials(contact.full_name)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{contact.full_name}</h1>
              {contact.title && <p className="text-sm text-slate-500">{contact.title}</p>}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={handleCreateLead}
              disabled={creatingLead}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <TrendingUp className="h-4 w-4" />
              {creatingLead ? 'Creating…' : 'Create Lead'}
            </button>
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
          {contact.company && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              <Link to={`/companies/${contact.company.id}`} className="text-indigo-600 hover:underline">
                {contact.company.name}
              </Link>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" />
              {contact.email}
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" />
              {contact.phone}
            </div>
          )}
          {contact.title && (
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-slate-400" />
              {contact.title}
            </div>
          )}
          {contact.linkedin && (
            <a href={contact.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline">
              <Link2 className="h-4 w-4" />
              LinkedIn
            </a>
          )}
          {contact.icp_category && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ICP_CATEGORY_COLORS[contact.icp_category]}`}>
              {ICP_CATEGORY_LABELS[contact.icp_category]}
            </span>
          )}
        </dl>
      </div>

      {/* Notes tab */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200">
          <span className="inline-block border-b-2 border-indigo-600 px-5 py-3 text-sm font-medium text-indigo-600">
            Notes ({notes.length})
          </span>
        </div>

        <div className="p-5">
          {notes.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No notes yet.</p>
          ) : (
            <ul className="space-y-4">
              {notes.map((n) => (
                <li key={n.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {n.creator?.full_name || n.creator?.email || 'Unknown'} · {formatDateTime(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {editing && (
        <ContactModal
          contact={contact}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            load()
          }}
        />
      )}
    </div>
  )
}
