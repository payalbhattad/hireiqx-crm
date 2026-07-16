import { useCallback, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react'
import Modal from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { sanitize } from '../../lib/format'
import { INDUSTRIES, COMPANY_SIZES } from '../../lib/constants'

const BATCH_SIZE = 500

function findHeader(row, candidates) {
  const keys = Object.keys(row)
  for (const candidate of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase() === candidate.toLowerCase())
    if (found) return found
  }
  return null
}

function getValue(row, candidates) {
  const key = findHeader(row, candidates)
  return key ? String(row[key] ?? '').trim() : ''
}

// Match against the live industry enum case-insensitively; unrecognized
// values are dropped to null rather than failing the whole row.
function mapIndustry(raw) {
  if (!raw) return null
  return INDUSTRIES.find((i) => i.toLowerCase() === raw.toLowerCase()) ?? null
}

// Accepts either an exact bucket ("11-50") or a raw headcount number
// and buckets it into the company size enum.
function mapSize(raw) {
  if (!raw) return null
  const trimmed = raw.trim()
  const direct = COMPANY_SIZES.find((s) => s.toLowerCase() === trimmed.toLowerCase())
  if (direct) return direct
  const num = Number(trimmed.replace(/,/g, '').match(/\d+/)?.[0])
  if (!num) return null
  if (num <= 10) return '1-10'
  if (num <= 50) return '11-50'
  if (num <= 200) return '51-200'
  if (num <= 500) return '201-500'
  if (num <= 1000) return '501-1000'
  return '1000+'
}

// Strips currency formatting and supports "1.2M" / "500K" shorthand.
function parseRevenue(raw) {
  if (!raw) return null
  let s = raw.replace(/[$,]/g, '').trim()
  let mult = 1
  if (/m$/i.test(s)) {
    mult = 1_000_000
    s = s.slice(0, -1)
  } else if (/k$/i.test(s)) {
    mult = 1_000
    s = s.slice(0, -1)
  }
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * mult) : null
}

function mapCompanyRow(row) {
  return {
    name: sanitize(getValue(row, ['Company Name', 'Name']), 200),
    website: sanitize(getValue(row, ['Website', 'Domain']), 300) || null,
    industry: mapIndustry(getValue(row, ['Industry'])),
    phone: sanitize(getValue(row, ['Phone']), 50) || null,
    linkedin: sanitize(getValue(row, ['LinkedIn', 'LinkedIn URL']), 300) || null,
    address: sanitize(getValue(row, ['Address', 'HQ', 'Headquarters']), 300) || null,
    size: mapSize(getValue(row, ['Employees', 'Size', 'Number of Employees'])),
    annual_revenue: parseRevenue(getValue(row, ['Annual Revenue', 'Revenue'])),
  }
}

export default function CompanyImportModal({ onClose, onImported }) {
  const { user } = useAuth()
  const [rows, setRows] = useState(null)
  const [fileName, setFileName] = useState('')
  const [existingNames, setExistingNames] = useState(new Set())
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState(null) // { imported, duplicates }

  const handleParsed = async (rawRows, name) => {
    const mapped = rawRows.map(mapCompanyRow).filter((r) => r.name)
    if (mapped.length === 0) {
      setError('No valid rows found. Expected a "Company Name" or "Name" column.')
      return
    }
    const { data } = await supabase.from('companies').select('name')
    setExistingNames(new Set((data ?? []).map((c) => c.name.toLowerCase())))
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

  const { toImport, duplicateCount } = useMemo(() => {
    if (!rows) return { toImport: [], duplicateCount: 0 }
    const seenNames = new Set()
    const fresh = []
    let dupes = 0
    for (const r of rows) {
      const key = r.name.toLowerCase()
      if (existingNames.has(key) || seenNames.has(key)) {
        dupes += 1
        continue
      }
      seenNames.add(key)
      fresh.push(r)
    }
    return { toImport: fresh, duplicateCount: dupes }
  }, [rows, existingNames])

  const handleImport = async () => {
    setImporting(true)
    setError('')

    const payload = toImport.map((r) => ({ ...r, status: 'New', created_by: user.id }))
    setProgress({ done: 0, total: payload.length })

    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const batch = payload.slice(i, i + BATCH_SIZE)
      const { error: dbError } = await supabase.from('companies').insert(batch)
      if (dbError) {
        setError(`Import failed: ${dbError.message}`)
        setImporting(false)
        return
      }
      setProgress({ done: Math.min(i + BATCH_SIZE, payload.length), total: payload.length })
    }

    setImporting(false)
    setSummary({ imported: payload.length, duplicates: duplicateCount })
  }

  const handleModalClose = importing ? () => {} : onClose

  return (
    <Modal title="Import Companies" onClose={handleModalClose} wide>
      {summary ? (
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Import complete!</h3>
          <ul className="mx-auto max-w-xs space-y-1 text-left text-sm text-slate-600">
            <li>{summary.imported.toLocaleString()} companies imported</li>
            <li>{summary.duplicates.toLocaleString()} duplicates skipped</li>
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
              Drag & drop a company export here, or click to browse
            </p>
            <p className="mt-1 text-xs text-slate-500">
              .csv or .xlsx — columns: Company Name, Website, Industry, Phone, LinkedIn, Address, Employees, Annual Revenue
            </p>
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
                {duplicateCount.toLocaleString()} duplicate name{duplicateCount === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Website</th>
                  <th className="px-3 py-2">Industry</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium text-slate-900">{r.name}</td>
                    <td className="px-3 py-2 text-slate-600">{r.website ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.industry ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.size ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{r.phone ?? '—'}</td>
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
                Importing {progress.done.toLocaleString()} of {progress.total.toLocaleString()} companies…
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
                : `Import ${toImport.length.toLocaleString()} compan${toImport.length === 1 ? 'y' : 'ies'}${
                    duplicateCount > 0 ? ` (skip ${duplicateCount.toLocaleString()} duplicate${duplicateCount === 1 ? '' : 's'})` : ''
                  }`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
