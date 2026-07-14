import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

// Searchable company combobox: type to filter, click a result to select.
// Reports the full company row ({ id, name }) on selection, or null on clear.
export default function CompanySearchSelect({
  value,
  onSelect,
  label = 'Company',
  labelClassName = 'mb-1 block text-sm font-medium text-slate-700',
}) {
  const [companies, setCompanies] = useState([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    supabase
      .from('companies')
      .select('id, name')
      .order('name')
      .then(({ data }) => setCompanies(data ?? []))
  }, [])

  useEffect(() => {
    if (!value) return
    const match = companies.find((c) => c.id === value)
    if (match) setQuery(match.name)
  }, [value, companies])

  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return companies
    return companies.filter((c) => c.name.toLowerCase().includes(q))
  }, [companies, query])

  const select = (company) => {
    setQuery(company.name)
    setOpen(false)
    onSelect(company)
  }

  return (
    <div ref={boxRef} className="relative">
      <label className={labelClassName}>{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (value) onSelect(null)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search companies…"
          className={`${inputCls} pl-9`}
        />
      </div>
      {open && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No companies found.</li>
          ) : (
            matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => select(c)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
                >
                  {c.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
