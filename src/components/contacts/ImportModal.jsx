import { useCallback, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react'
import Modal from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { sanitize } from '../../lib/format'

const BATCH_SIZE = 500

// Map an Apollo export row (header → value) to a contacts payload.
// company_name is resolved to a company_id at import time (see handleImport).
function mapApolloRow(row) {
  const get = (key) => {
    const found = Object.keys(row).find((k) => k.trim().toLowerCase() === key.toLowerCase())
    return found ? String(row[found] ?? '').trim() : ''
  }
  const first = get('First Name')
  const last = get('Last Name')
  const fullName = [first, last].filter(Boolean).join(' ')
  return {
    full_name: sanitize(fullName, 200),
    company_name: sanitize(get('Company'), 200) || null,
    email: sanitize(get('Email'), 254).toLowerCase() || null,
    phone: sanitize(get('Phone'), 50) || null,
    title: sanitize(get('Title'), 200) || null,
    linkedin: sanitize(get('LinkedIn URL'), 300) || null,
  }
}

export default function ImportModal({ onClose, onImported }) {
  const { user } = useAuth()
  const [rows, setRows] = useState(null)
  const [fileName, setFileName] = useState('')
  const [existingEmails, setExistingEmails] = useState(new Set())
  const [existingCompanies, setExistingCompanies] = useState(new Map()) // lowercase name -> id
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState(null) // { imported, duplicates, newCompanies }

  const handleParsed = async (rawRows, name) => {
    const mapped = rawRows.map(mapApolloRow).filter((r) => r.full_name)
    if (mapped.length === 0) {
      setError('No valid rows found. Expected Apollo columns like "First Name", "Last Name", "Email".')
      return
    }
    const [emailsRes, companiesRes] = await Promise.all([
      supabase.from('contacts').select('email').not('email', 'is', null),
      supabase.from('companies').select('id, name'),
    ])
    setExistingEmails(new Set((emailsRes.data ?? []).map((c) => c.email.toLowerCase())))
    setExistingCompanies(new Map((companiesRes.data ?? []).map((c) => [c.name.toLowerCase(), c.id])))
    setRows(mapped)
    setFileName(name)
  }

  const onDrop = useCallback((accepted) => {
    setError('')
    const file = accepted[0]
    if (!file) return

    if (file.name.toLowerCase().endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => handleParsed(result.data, file.name),
        error: () => setError('Failed to parse the CSV file.'),
      })
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' })
          const sheet = wb.Sheets[wb.SheetNames[0]]
          handleParsed(XLSX.utils.sheet_to_json(sheet, { defval: '' }), file.name)
        } catch {
          setError('Failed to parse the Excel file.')
        }
      }
      reader.onerror = () => setError('Failed to read the file.')
      reader.readAsArrayBuffer(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
  })

  const { toImport, duplicateCount, newCompanyNames } = useMemo(() => {
    if (!rows) return { toImport: [], duplicateCount: 0, newCompanyNames: new Set() }
    const seenEmails = new Set()
    const fresh = []
    let dupes = 0
    const newNames = new Set()
    for (const r of rows) {
      if (r.email && (existingEmails.has(r.email) || seenEmails.has(r.email))) {
        dupes += 1
        continue
      }
      if (r.email) seenEmails.add(r.email)
      if (r.company_name && !existingCompanies.has(r.company_name.toLowerCase())) {
        newNames.add(r.company_name)
      }
      fresh.push(r)
    }
    return { toImport: fresh, duplicateCount: dupes, newCompanyNames: newNames }
  }, [rows, existingEmails, existingCompanies])

  const handleImport = async () => {
    setImporting(true)
    setError('')

    // Create any not-yet-seen companies first, so every row can be linked by id.
    const companyMap = new Map(existingCompanies)
    if (newCompanyNames.size > 0) {
      const { data: created, error: companyError } = await supabase
        .from('companies')
        .insert(Array.from(newCompanyNames).map((name) => ({ name, status: 'New' })))
        .select('id, name')
      if (companyError) {
        setError(`Import failed while creating companies: ${companyError.message}`)
        setImporting(false)
        return
      }
      for (const c of created ?? []) companyMap.set(c.name.toLowerCase(), c.id)
    }

    const payload = toImport.map((r) => ({
      full_name: r.full_name,
      company_id: r.company_name ? companyMap.get(r.company_name.toLowerCase()) ?? null : null,
      email: r.email,
      phone: r.phone,
      title: r.title,
      linkedin: r.linkedin,
      icp_category: null,
      created_by: user.id,
    }))

    setProgress({ done: 0, total: payload.length })

    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const batch = payload.slice(i, i + BATCH_SIZE)
      const { error: dbError } = await supabase.from('contacts').insert(batch)
      if (dbError) {
        setError(`Import failed: ${dbError.message}`)
        setImporting(false)
        return
      }
      setProgress({ done: Math.min(i + BATCH_SIZE, payload.length), total: payload.length })
    }

    setImporting(false)
    setSummary({
      imported: payload.length,
      duplicates: duplicateCount,
      newCompanies: newCompanyNames.size,
    })
  }

  const handleModalClose = importing ? () => {} : onClose

  return (
    <Modal title="Import Contacts from Apollo" onClose={handleModalClose} wide>
      {summary ? (
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Import complete!</h3>
          <ul className="mx-auto max-w-xs space-y-1 text-left text-sm text-slate-600">
            <li>{summary.imported.toLocaleString()} contacts imported</li>
            <li>{summary.duplicates.toLocaleString()} duplicates skipped</li>
            <li>{summary.newCompanies.toLocaleString()} new companies created</li>
          </ul>
          <button
            onClick={() => onImported(summary.imported)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Close
          </button>
        </div>
      ) : !rows ? (
        <>
          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
              isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="mb-3 h-10 w-10 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">
              Drag & drop an Apollo export here, or click to browse
            </p>
            <p className="mt-1 text-xs text-slate-500">.csv or .xlsx — columns: First Name, Last Name, Company, Email, Phone, Title, LinkedIn URL</p>
          </div>
          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
            <span className="font-medium">{fileName}</span>
            <span>— {rows.length.toLocaleString()} rows parsed</span>
            {duplicateCount > 0 && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                {duplicateCount.toLocaleString()} duplicate email{duplicateCount === 1 ? '' : 's'}
              </span>
            )}
            {newCompanyNames.size > 0 && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {newCompanyNames.size.toLocaleString()} new compan{newCompanyNames.size === 1 ? 'y' : 'ies'} will be created
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Title</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium text-slate-900">{r.full_name}</td>
                    <td className="px-3 py-2 text-slate-600">{r.company_name ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.email ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.phone ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.title ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 10 && (
            <p className="text-xs text-slate-500">Showing first 10 of {rows.length.toLocaleString()} rows.</p>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          {importing && (
            <div>
              <p className="mb-2 text-sm text-slate-600">
                Importing {progress.done.toLocaleString()} of {progress.total.toLocaleString()} contacts…
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-indigo-600 transition-all"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setRows(null)
                setFileName('')
                setError('')
              }}
              disabled={importing}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Choose another file
            </button>
            <button
              onClick={handleImport}
              disabled={importing || toImport.length === 0}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              {importing
                ? 'Importing…'
                : `Import ${toImport.length.toLocaleString()} contact${toImport.length === 1 ? '' : 's'}${
                    duplicateCount > 0 ? ` (skip ${duplicateCount.toLocaleString()} duplicate${duplicateCount === 1 ? '' : 's'})` : ''
                  }`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
