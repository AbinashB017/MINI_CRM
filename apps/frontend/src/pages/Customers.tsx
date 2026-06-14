import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Users, Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { clsx } from 'clsx'
import { format } from 'date-fns'

function TagBadge({ tag }: { tag: string }) {
  const colors: Record<string, string> = {
    vip:    'bg-amber-50 text-amber-700 border-amber-200',
    loyal:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    lapsed: 'bg-red-50 text-red-600 border-red-200',
    new:    'bg-blue-50 text-blue-700 border-blue-200',
  }
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', colors[tag] ?? 'bg-gray-50 text-gray-600 border-gray-200')}>
      {tag}
    </span>
  )
}

export default function Customers() {
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [inputVal, setInputVal] = useState('')
  const [sort, setSort]     = useState('createdAt')
  const [order, setOrder]   = useState<'asc' | 'desc'>('desc')

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search, sort, order],
    queryFn:  () => api.customers.list({ page, limit: 25, search, sort, order }),
  })

  const { data: stats } = useQuery({
    queryKey: ['customer-stats'],
    queryFn:  api.customers.stats,
  })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(inputVal)
    setPage(1)
  }

  function toggleSort(field: string) {
    if (sort === field) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    else { setSort(field); setOrder('desc') }
  }

  const SortIcon = ({ field }: { field: string }) => (
    <ArrowUpDown className={clsx('w-3 h-3 inline ml-1', sort === field ? 'text-primary' : 'text-gray-300')} />
  )

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Customers</h1>
          <p className="text-sm text-text-muted mt-1">Manage your audience base and their purchase history.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <div className="text-text-muted text-xs font-medium mb-1 flex items-center gap-2"><Users className="w-4 h-4"/> Total Base</div>
          <div className="text-2xl font-bold text-text-primary">{stats?.total.toLocaleString() ?? '-'}</div>
        </div>
        <div className="card">
          <div className="text-text-muted text-xs font-medium mb-1">Active (30d)</div>
          <div className="text-2xl font-bold text-primary">{stats?.activeThisMonth.toLocaleString() ?? '-'}</div>
        </div>
        <div className="card">
          <div className="text-text-muted text-xs font-medium mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-emerald-600">₹{stats?.totalRevenue.toLocaleString('en-IN') ?? '-'}</div>
        </div>
        <div className="card">
          <div className="text-text-muted text-xs font-medium mb-1">Avg Order Value</div>
          <div className="text-2xl font-bold text-text-primary">₹{stats?.avgSpend.toLocaleString('en-IN') ?? '-'}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="card py-3 px-4 flex items-center justify-between">
        <form onSubmit={handleSearch} className="relative w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="input pl-9 h-9 text-sm"
            placeholder="Search name, email, phone..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
          />
        </form>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface border-b border-border text-xs text-text-muted uppercase tracking-wider">
              <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('firstName')}>Customer <SortIcon field="firstName" /></th>
              <th className="p-4 font-semibold">Contact</th>
              <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('city')}>Location <SortIcon field="city" /></th>
              <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100 text-right" onClick={() => toggleSort('totalSpend')}>Spend <SortIcon field="totalSpend" /></th>
              <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100 text-right" onClick={() => toggleSort('orderCount')}>Orders <SortIcon field="orderCount" /></th>
              <th className="p-4 font-semibold">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-text-muted"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
            ) : data?.data.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-text-muted">No customers found.</td></tr>
            ) : (
              data?.data.map((c) => (
                <tr key={c.id} className="hover:bg-surface/50 transition-colors group">
                  <td className="p-4">
                    <Link to={`/customers/${c.id}`} className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                      {c.firstName} {c.lastName}
                    </Link>
                    <div className="text-xs text-text-muted mt-0.5">Joined {format(new Date(c.createdAt), 'MMM yyyy')}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">{c.email}</div>
                    <div className="text-xs text-text-muted">{c.phone || '—'}</div>
                  </td>
                  <td className="p-4 text-sm text-text-muted">{c.city || '—'}</td>
                  <td className="p-4 text-right font-medium text-text-primary">₹{c.totalSpend.toLocaleString('en-IN')}</td>
                  <td className="p-4 text-right text-text-muted">{c.orderCount}</td>
                  <td className="p-4">
                    <div className="flex gap-1 flex-wrap">
                      {c.tags.map((t) => <TagBadge key={t} tag={t} />)}
                      {c.tags.length === 0 && <span className="text-xs text-gray-300">—</span>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-muted px-2">
          <div>Showing page {page} of {data.pagination.pages} ({data.pagination.total} total)</div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary px-3 py-1.5" disabled={!data.pagination.hasPrev} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4"/> Prev</button>
            <button className="btn-secondary px-3 py-1.5" disabled={!data.pagination.hasNext} onClick={() => setPage(p => p + 1)}>Next <ChevronRight className="w-4 h-4"/></button>
          </div>
        </div>
      )}
    </div>
  )
}