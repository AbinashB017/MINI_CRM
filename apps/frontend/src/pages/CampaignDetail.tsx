import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '../lib/api'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'
import {
  FunnelChart, Funnel, LabelList, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useState } from 'react'

const STATUS_CLASSES: Record<string, string> = {
  sent:      'status-sent',
  delivered: 'status-delivered',
  opened:    'status-opened',
  read:      'status-read',
  clicked:   'status-clicked',
  failed:    'status-failed',
  pending:   'status-pending',
}

const FUNNEL_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#6366F1', '#F59E0B']

export default function CampaignDetail() {
  const { id }   = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [recipPage, setRecipPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn:  () => api.campaigns.get(id!),
    enabled:  !!id,
    refetchInterval: (query) =>
      query.state.data?.status === 'sending' ? 10_000 : false,
  })

  const { data: recipientsData } = useQuery({
    queryKey: ['recipients', id, recipPage, search],
    queryFn:  () => api.campaigns.recipients(id!, { page: recipPage, limit: 25, search }),
    enabled:  !!id,
  })

  const sendMutation = useMutation({
    mutationFn: () => api.campaigns.send(id!),
    onSuccess: (data) => {
      toast.success(`Queued ${data.jobCount} messages!`)
      qc.invalidateQueries({ queryKey: ['campaign', id] })
    },
  })

  if (isLoading) {
    return <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 skeleton rounded w-64" />
      <div className="grid grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}</div>
    </div>
  }

  if (!campaign) return <div className="p-6 text-text-muted">Campaign not found</div>

  const stats  = campaign.stats ?? {}
  const total  = campaign._count?.recipients ?? Object.values(stats).reduce((a, b) => a + b, 0)

  const funnelData = [
    { name: 'Sent',      value: total,               fill: FUNNEL_COLORS[0] },
    { name: 'Delivered', value: stats.delivered ?? 0, fill: FUNNEL_COLORS[1] },
    { name: 'Opened',    value: stats.opened    ?? 0, fill: FUNNEL_COLORS[2] },
    { name: 'Read',      value: stats.read      ?? 0, fill: FUNNEL_COLORS[3] },
    { name: 'Clicked',   value: stats.clicked   ?? 0, fill: FUNNEL_COLORS[4] },
  ].filter((d) => d.value > 0)

  const pct = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '—'

  const CHANNEL_ICONS: Record<string, string> = { whatsapp: '💬', sms: '📱', email: '✉️', rcs: '🔵' }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{CHANNEL_ICONS[campaign.channel] ?? '📨'}</span>
            <h1 className="text-2xl font-bold text-text-primary">{campaign.name}</h1>
            <span className={STATUS_CLASSES[campaign.status] ?? 'badge-gray'}>{campaign.status}</span>
          </div>
          {campaign.sentAt && (
            <p className="text-text-muted text-sm">Sent {format(new Date(campaign.sentAt), 'dd MMM yyyy, h:mm a')}</p>
          )}
        </div>
        {campaign.status === 'draft' && (
          <button className="btn-primary" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
            <Send className="w-4 h-4" /> Send Campaign
          </button>
        )}
        {campaign.status === 'sending' && (
          <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
            <RefreshCw className="w-4 h-4 animate-spin" /> Sending… (auto-refreshing)
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Sent',      value: total,                color: 'text-blue-600',    bg: 'bg-blue-50', pct: pct(total) },
          { label: 'Delivered', value: stats.delivered ?? 0,  color: 'text-emerald-600', bg: 'bg-emerald-50', pct: pct(stats.delivered ?? 0) },
          { label: 'Opened',    value: stats.opened    ?? 0,  color: 'text-violet-600',  bg: 'bg-violet-50', pct: pct(stats.opened ?? 0) },
          { label: 'Read',      value: stats.read      ?? 0,  color: 'text-indigo-600',  bg: 'bg-indigo-50', pct: pct(stats.read ?? 0) },
          { label: 'Clicked',   value: stats.clicked   ?? 0,  color: 'text-amber-600',   bg: 'bg-amber-50', pct: pct(stats.clicked ?? 0) },
          { label: 'Failed',    value: stats.failed    ?? 0,  color: 'text-red-600',     bg: 'bg-red-50', pct: pct(stats.failed ?? 0) },
          { label: 'Orders',    value: campaign.ordersGenerated ?? 0, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50', pct: '' },
          { label: 'Revenue',   value: `₹${campaign.revenue?.toLocaleString() ?? 0}`, color: 'text-purple-600', bg: 'bg-purple-50', pct: '' },
        ].map((s) => (
          <div key={s.label} className={clsx('rounded-xl p-4 text-center border border-border flex flex-col justify-center', s.bg)}>
            <p className={clsx('text-xl font-bold truncate', s.color)}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
            <p className="text-xs text-text-muted mt-1">{s.label}</p>
            {s.pct && <p className={clsx('text-xs font-semibold mt-0.5', s.color)}>{s.pct}</p>}
          </div>
        ))}
      </div>

      {/* Funnel + Message */}
      <div className="grid grid-cols-5 gap-4">
        {funnelData.length > 0 && (
          <div className="col-span-2 card">
            <h2 className="font-semibold text-text-primary mb-4">Engagement Funnel</h2>
            <ResponsiveContainer width="100%" height={200}>
              <FunnelChart>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="#6B6B80" stroke="none" dataKey="name" style={{ fontSize: 12 }} />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className={clsx('card', funnelData.length > 0 ? 'col-span-3' : 'col-span-5')}>
          <h2 className="font-semibold text-text-primary mb-3">Message Template</h2>
          <div className="bg-surface border border-border rounded-xl p-4 font-mono text-sm text-text-primary whitespace-pre-wrap">
            {campaign.messageTemplate}
          </div>
          {campaign.segment && (
            <div className="mt-3 text-xs text-text-muted">
              Segment: <span className="font-medium text-text-primary">{campaign.segment.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Recipients table */}
      {total > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-text-primary">Recipients</h2>
            <input
              className="input py-1.5 text-sm w-60"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setRecipPage(1) }}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr>
                  {['Customer', 'Contact', 'Message', 'Status', 'Last Update'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-text-muted px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recipientsData?.data.map((r) => (
                  <tr key={r.id} className="hover:bg-surface transition-colors">
                    <td className="px-5 py-3 font-medium text-text-primary">
                      {r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : r.customerId}
                    </td>
                    <td className="px-5 py-3 text-xs text-text-muted">
                      {r.customer?.phone ?? r.customer?.email ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-text-muted max-w-xs truncate">{r.message}</td>
                    <td className="px-5 py-3">
                      <span className={STATUS_CLASSES[r.status] ?? 'badge-gray'}>{r.status}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-text-muted">
                      {r.clickedAt   ? format(new Date(r.clickedAt), 'HH:mm:ss')   :
                       r.readAt      ? format(new Date(r.readAt),     'HH:mm:ss')   :
                       r.openedAt    ? format(new Date(r.openedAt),   'HH:mm:ss')   :
                       r.deliveredAt ? format(new Date(r.deliveredAt),'HH:mm:ss')   :
                       r.sentAt      ? format(new Date(r.sentAt),     'HH:mm:ss')   : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-text-muted">
                      {r.status !== 'pending' && r.status !== 'failed' && (
                        <button
                          className="btn-secondary text-xs py-1 px-2"
                          onClick={async () => {
                            try {
                              await api.campaigns.simulateOrder(id!, r.customerId)
                              toast.success('Test order placed! Refreshing...')
                              qc.invalidateQueries({ queryKey: ['campaign', id] })
                            } catch (err) {
                              toast.error('Failed to simulate order')
                            }
                          }}
                        >
                          Simulate Order
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {recipientsData && recipientsData.pagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface">
              <p className="text-xs text-text-muted">
                {recipientsData.pagination.total.toLocaleString()} recipients
              </p>
              <div className="flex gap-2">
                <button className="btn-secondary py-1 px-2.5 text-xs" onClick={() => setRecipPage((p) => Math.max(1, p - 1))} disabled={recipPage === 1}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs self-center">{recipPage}/{recipientsData.pagination.pages}</span>
                <button className="btn-secondary py-1 px-2.5 text-xs" onClick={() => setRecipPage((p) => p + 1)} disabled={recipPage === recipientsData.pagination.pages}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
