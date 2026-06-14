import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Target, Users, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

const FIELD_LABELS: Record<string, string> = {
  totalSpend:          'Total Spend',
  orderCount:          'Orders',
  lastOrderAt:         'Last Order',
  firstOrderAt:        'First Order',
  city:                'City',
  tags:                'Tags',
}

const OP_LABELS: Record<string, string> = {
  gt:               '>',
  lt:               '<',
  gte:              '≥',
  lte:              '≤',
  eq:               '=',
  in:               'in',
  notOrderedInDays: 'inactive for >',
  orderedInLastDays: 'ordered in last',
}

function RuleChip({ condition }: { condition: { field: string; operator: string; value: unknown } }) {
  const val = Array.isArray(condition.value) ? condition.value.join(', ') : String(condition.value)
  const suffix = condition.operator.includes('Days') ? ' days' : ''
  const prefix = condition.field === 'totalSpend' ? '₹' : ''
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-light text-primary text-xs rounded-lg font-medium">
      {FIELD_LABELS[condition.field] ?? condition.field}
      <span className="text-primary/60">{OP_LABELS[condition.operator] ?? condition.operator}</span>
      {prefix}{val}{suffix}
    </span>
  )
}

export default function Segments() {
  const qc = useQueryClient()
  const { data: segments, isLoading } = useQuery({
    queryKey: ['segments'],
    queryFn:  api.segments.list,
  })

  const deleteMutation = useMutation({
    mutationFn: api.segments.delete,
    onSuccess: () => {
      toast.success('Segment deleted')
      qc.invalidateQueries({ queryKey: ['segments'] })
    },
  })

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Segments</h1>
          <p className="text-text-muted text-sm mt-0.5">Define audiences from your customer data</p>
        </div>
        <Link to="/segments/new" className="btn-primary">
          <Plus className="w-4 h-4" /> New Segment
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 skeleton rounded-xl" />)}
        </div>
      ) : segments?.length === 0 ? (
        <div className="text-center py-20 card">
          <Target className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <h3 className="font-semibold text-text-primary mb-1">No segments yet</h3>
          <p className="text-text-muted text-sm mb-4">Create an audience segment to start sending targeted campaigns</p>
          <Link to="/segments/new" className="btn-primary">Create Segment</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {segments?.map((seg) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rules = seg.rules as any
            const conditions = rules?.conditions ?? []
            return (
              <div key={seg.id} className="card hover:shadow-card-hover transition-all duration-200 group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-primary-light rounded-xl flex items-center justify-center">
                      <Target className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-primary leading-tight">{seg.name}</h3>
                      <p className="text-xs text-text-muted mt-0.5">{seg.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${seg.name}"?`)) deleteMutation.mutate(seg.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Rules preview */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {conditions.slice(0, 3).map((c: { field: string; operator: string; value: unknown }, i: number) => (
                    <RuleChip key={i} condition={c} />
                  ))}
                  {conditions.length > 3 && (
                    <span className="text-xs text-text-muted self-center">+{conditions.length - 3} more</span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Users className="w-4 h-4 text-text-muted" />
                    <span className="font-semibold text-text-primary">{seg.count.toLocaleString()}</span>
                    <span className="text-text-muted">customers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">{format(new Date(seg.createdAt), 'dd MMM')}</span>
                    <Link
                      to={`/campaigns/new?segmentId=${seg.id}`}
                      className={clsx('text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors',
                        'bg-primary-light text-primary hover:bg-primary hover:text-white'
                      )}
                    >
                      Send Campaign
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
