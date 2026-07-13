import { createClient } from '@supabase/supabase-js'

// Server-side only — uses the service role key, which must never be exposed
// to the frontend (no VITE_ prefix).
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  // Only admins may invite users.
  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()
  if (callerProfile?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' })
  }

  const { email, role } = req.body ?? {}
  const cleanEmail = String(email ?? '').trim().toLowerCase().slice(0, 254)
  const cleanRole = role === 'admin' ? 'admin' : 'rep'

  if (!EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'Invalid email address' })
  }

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
    data: { role: cleanRole },
  })
  if (error) {
    return res.status(502).json({ success: false, error: error.message })
  }
  return res.status(200).json({ success: true })
}
