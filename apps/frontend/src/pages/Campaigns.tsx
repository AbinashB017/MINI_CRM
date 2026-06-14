import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Megaphone, Send, Eye } from 'lucide-react'
import { api } from '../lib/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

const CHANNEL_ICONS: Record<string, string> = { whatsapp: '💬', sms: '📱', email: '✉️', rcs: '🔵' }
const STATUS_CLASSES: Record<string, string> = {
  sent:    'status-sent',
  sending: 'status-sending',
  draft:   'status-draft',
  failed:  'status-failed',
}

export default function Campaigns() {
  const qc = useQueryClient()
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn:  api.campaigns.list,
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.campaigns.send(id),
    onSuccess: (data) => {
      toast.success(`Queued ${data.jobCount} messages!`)
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Campaigns</h1>
          <p className="text-text-muted text-sm mt-0.5">{campaigns?.length ?? 0} total campaigns</p>
        </div>
        <Link to="/campaigns/new" className="btn-primary">
          <Plus className="w-4 h-4" /> New Campaign
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
      ) : campaigns?.length === 0 ? (
        <div className="text-center py-20 card">
          <Megaphone className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <h3 className="font-semibold text-text-primary mb-1">No campaigns yet</h3>
          <p className="text-text-muted text-sm mb-4">Create your first campaign to start reaching customers</p>
          <Link to="/campaigns/new" className="btn-primary">Create Campaign</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns?.map((c) => {
            const total     = c._count?.recipients ?? 0
            const delivered = c.stats?.delivered ?? 0
            const opened    = c.stats?.opened    ?? 0
            const clicked   = c.stats?.clicked   ?? 0
            const pct = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '—'

            return (
              <div key={c.id} className="card hover:shadow-card-hover transition-all duration-200 group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center text-xl">
                      {CHANNEL_ICONS[c.channel] ?? '📨'}
                    </div>
                    <div>
                      <Link to={`/campaigns/${c.id}`} className="font-semibold text-text-primary hover:text-primary transition-colors">
                        {c.name}
                      </Link>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={STATUS_CLASSES[c.status] ?? 'badge-gray'}>{c.status}</span>
                        {c.segment && (
                          <span className="text-xs text-text-muted">→ {c.segment.name}</span>
                        )}
                        {c.sentAt && (
                          <span className="text-xs text-text-muted">{format(new Date(c.sentAt), 'dd MMM yyyy')}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {c.status === 'draft' && (
                      <button
                        className="btn-primary py-1.5 text-xs"
                        onClick={() => sendMutation.mutate(c.id)}
                        disabled={sendMutation.isPending}
                      >
                        <Send className="w-3.5 h-3.5" /> Send Now
                      </button>
                    )}
                    <Link to={`/campaigns/${c.id}`} className="btn-secondary py-1.5 text-xs">
                      <Eye className="w-3.5 h-3.5" /> View
                    </Link>
                  </div>
                </div>

                {total > 0 && (
                  <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
                    {[
                      { label: 'Sent',      value: total,     color: 'text-blue-600' },
                      { label: 'Delivered', value: pct(delivered), color: 'text-emerald-600' },
                      { label: 'Opened',    value: pct(opened),    color: 'text-violet-600' },
                      { label: 'Clicked',   value: pct(clicked),   color: 'text-amber-600' },
                    ].map((s) => (
                      <div key={s.label} className="text-center">
                        <p className={clsx('text-lg font-bold', s.color)}>{s.value.toLocaleString()}</p>
                        <p className="text-xs text-text-muted">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message preview */}
                <p className="mt-3 text-xs text-text-muted line-clamp-1 font-mono bg-surface px-3 py-2 rounded-lg">
                  {c.messageTemplate}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
