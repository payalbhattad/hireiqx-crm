import { useCallback, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { UploadCloud, FileSpreadsheet } from 'lucide-react'
import Modal from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { sanitize } from '../../lib/format'

// Map an Apollo export row (header → value) to a contacts payload.
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
    company: sanitize(get('Company'), 200) || null,
    email: sanitize(get('Email'), 254).toLowerCase() || null,
    phone: sanitize(get('Phone'), 50) || null,
    title: sanitize(get('Title'), 200) || null,
    source: 'apollo',
  }
}

export default function ImportModal({ onClose, onImported }) {
  const { user } = useAuth()
  const [rows, setRows] = useState(null)
  const [fileName, setFileName] = useState('')
  const [existingEmails, setExistingEmails] = useState(new Set())
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  const loadExistingEmails = async () => {
    const { data } = await supabase.from('contacts').select('email').not('email', 'is', null)
    return new Set((data ?? []).map((c) => c.email.toLowerCase()))
  }

  const handleParsed = async (rawRows, name) => {
    const mapped = rawRows.map(mapApolloRow).filter((r) => r.full_name)
    if (mapped.length === 0) {
      setError('No valid rows found. Expected Apollo columns like "First Name", "Last Name", "Email".')
      return
    }
    setExistingEmails(await loadExistingEmails())
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
  })

  const { toImport, duplicateCount } = useMemo(() => {
    if (!rows) return { toImport: [], duplicateCount: 0 }
    const seen = new Set()
    const fresh = []
    let dupes = 0
    for (const r of rows) {
      if (r.email && (existingEmails.has(r.email) || seen.has(r.email))) {
        dupes += 1
        continue
      }
      if (r.email) seen.add(r.email)
      fresh.push(r)
    }
    return { toImport: fresh, duplicateCount: dupes }
  }, [rows, existingEmails])

  const handleImport = async () => {
    setImporting(true)
    setError('')
    const payload = toImport.map((r) => ({ ...r, created_by: user.id }))
    // Insert in chunks to stay under request-size limits.
    for (let i = 0; i < payload.length; i += 200) {
      const { error: dbError } = await supabase.from('contacts').insert(payload.slice(i, i + 200))
      if (dbError) {
        setError(`Import failed: ${dbError.message}`)
        setImporting(false)
        return
      }
    }
    onImported(toImport.length)
  }

  return (
    <Modal title="Import Contacts from Apollo" onClose={onClose} wide>
      {!rows ? (
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
            <p className="mt-1 text-xs text-slate-500">.csv or .xlsx — columns: First Name, Last Name, Company, Email, Phone, Title</p>
          </div>
          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
            <span className="font-medium">{fileName}</span>
            <span>— {rows.length} rows parsed</span>
            {duplicateCount > 0 && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                {duplicateCount} duplicate email{duplicateCount === 1 ? '' : 's'}
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
                    <td className="px-3 py-2 text-slate-600">{r.company ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.email ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.phone ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.title ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 10 && (
            <p className="text-xs text-slate-500">Showing first 10 of {rows.length} rows.</p>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setRows(null)
                setFileName('')
                setError('')
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Choose another file
            </button>
            <button
              onClick={handleImport}
              disabled={importing || toImport.length === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {importing
                ? 'Importing…'
                : `Import ${toImport.length} contact${toImport.length === 1 ? '' : 's'}${
                    duplicateCount > 0 ? ` (skip ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'})` : ''
                  }`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
