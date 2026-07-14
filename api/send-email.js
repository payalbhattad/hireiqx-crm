import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Server-side only — RESEND_API_KEY and SUPABASE_SERVICE_ROLE_KEY must never
// carry the VITE_ prefix, or Vite would bundle them into the browser build.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sanitize(value, maxLength) {
  if (value == null) return ''
  // eslint-disable-next-line no-control-regex
  return String(value).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLength)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  // Verify the caller's Supabase JWT.
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing Authorization header' })
  }
  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !userData?.user) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' })
  }

  const { to, subject, body } = req.body ?? {}
  const cleanTo = (Array.isArray(to) ? to : [to]).map((t) => sanitize(t, 254)).filter(Boolean)
  const cleanSubject = sanitize(subject, 300)
  const cleanBody = String(body ?? '').slice(0, 10000)

  if (cleanTo.length === 0 || !cleanTo.every((t) => EMAIL_RE.test(t))) {
    return res.status(400).json({ success: false, error: 'Invalid recipient email' })
  }
  if (!cleanSubject || !cleanBody.trim()) {
    return res.status(400).json({ success: false, error: 'Subject and body are required' })
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'HireIQX CRM <onboarding@resend.dev>',
      to: cleanTo.length === 1 ? cleanTo[0] : cleanTo,
      subject: cleanSubject,
      text: cleanBody,
    })
    if (error) {
      return res.status(502).json({ success: false, error: error.message || 'Resend rejected the email' })
    }
    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to send email' })
  }
}
