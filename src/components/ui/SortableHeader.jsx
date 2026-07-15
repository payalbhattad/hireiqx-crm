import { ArrowUp, ArrowDown } from 'lucide-react'

// Clickable <th> for table sorting. Parent owns { key, dir } sort state and
// the compare logic — this just renders the header + active-column arrow.
export default function SortableHeader({ label, sortKey, sort, onSort, className = '' }) {
  const active = sort.key === sortKey
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 hover:text-slate-700"
      >
        {label}
        {active &&
          (sort.dir === 'asc' ? (
            <ArrowUp className="h-3 w-3 text-indigo-600" />
          ) : (
            <ArrowDown className="h-3 w-3 text-indigo-600" />
          ))}
      </button>
    </th>
  )
}
