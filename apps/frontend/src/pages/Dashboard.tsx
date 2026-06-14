import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Users, Megaphone, TrendingUp, Eye, ArrowUpRight, Circle } from 'lucide-react'
import { subWeeks, startOfWeek, format } from 'date-fns'
import { api } from '../lib/api'
import type { Campaign } from '../lib/api'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'

// ── Skeleton ──────────────────────────────────────────────────────────────────
function StatCardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
      <div className="h-8 bg-gray-100 rounded w-1/3 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-2/3" />
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="card hover:shadow-card-hover transition-shadow duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{label}</p>
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', color)}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <p className="text-3xl font-bold text-text-primary mb-1">{value}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    sent:    'status-sent',
    sending: 'status-sending',
    draft:   'status-draft',
    failed:  'status-failed',
  }
  return <span className={cls[status] ?? 'badge-gray'}>{status}</span>
}

// ── Channel icon ──────────────────────────────────────────────────────────────
function ChannelBadge({ channel }: { channel: string }) {
  const map: Record<string, string> = {
    whatsapp: '💬',
    sms:      '📱',
    email:    '✉️',
    rcs:      '🔵',
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
      {map[channel] ?? '📨'} {channel}
    </span>
  )
}

// ── Build last-8-weeks chart data from campaigns ─────────────────────────────
function buildWeeklyChartData(campaigns: Campaign[]) {
  const now = new Date()
  return Array.from({ length: 8 }, (_, i) => {
    const weekStart = startOfWeek(subWeeks(now, 7 - i))
    const weekEnd   = subWeeks(now, 6 - i)
    const count = campaigns.filter((c) => {
      if (!c.sentAt) return false
      const d = new Date(c.sentAt)
      return d >= weekStart && d < weekEnd
    }).length
    return { week: format(weekStart, 'MMM d'), sent: count }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: api.customers.stats,
  })

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: api.campaigns.analyticsOverview,
  })

  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: api.campaigns.list,
  })

  const chartData  = campaigns ? buildWeeklyChartData(campaigns) : []
  const recentFive = campaigns?.slice(0, 5) ?? []
  const isLoading  = statsLoading || overviewLoading || campaignsLoading

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-text-muted text-sm mt-0.5">Welcome back — here's what's happening</p>
        </div>
        <Link to="/chat" className="btn-primary">
          <span>✨</span>
          Start AI Campaign
        </Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Customers"
              value={stats?.total?.toLocaleString('en-IN') ?? '—'}
              sub={`${stats?.activeThisMonth ?? 0} active this month`}
              icon={Users}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              label="Campaigns Sent"
              value={overview?.campaignCount ?? '—'}
              sub={`${overview?.sent?.toLocaleString() ?? 0} messages sent`}
              icon={Megaphone}
              color="bg-primary-light text-primary"
            />
            <StatCard
              label="Avg Delivery Rate"
              value={`${overview?.deliveryRate ?? 0}%`}
              sub={`${overview?.delivered?.toLocaleString() ?? 0} delivered`}
              icon={TrendingUp}
              color="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              label="Campaign Revenue"
              value={`₹${overview?.revenue?.toLocaleString() ?? 0}`}
              sub={`${overview?.ordersGenerated?.toLocaleString() ?? 0} orders generated`}
              icon={TrendingUp}
              color="bg-purple-50 text-purple-600"
            />
          </>
        )}
      </div>

      {/* Chart + Recent campaigns */}
      <div className="grid grid-cols-5 gap-4">
        {/* Bar chart */}
        <div className="col-span-3 card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-text-primary">Campaigns Sent — Last 8 Weeks</h2>
          </div>
          {campaignsLoading ? (
            <div className="h-48 skeleton rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E3F0" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6B6B80' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B6B80' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #E5E3F0', fontSize: 12 }}
                  cursor={{ fill: '#EEE9FF' }}
                />
                <Bar dataKey="sent" fill="#6C47FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quick stats */}
        <div className="col-span-2 card">
          <h2 className="font-semibold text-text-primary mb-4">Engagement Funnel</h2>
          {overviewLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 skeleton rounded" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Sent',      value: overview?.sent ?? 0,      pct: 100,                         color: 'bg-blue-500' },
                { label: 'Delivered', value: overview?.delivered ?? 0,  pct: overview?.deliveryRate ?? 0, color: 'bg-emerald-500' },
                { label: 'Opened',    value: overview?.opened ?? 0,     pct: overview?.openRate ?? 0,     color: 'bg-violet-500' },
                { label: 'Read',      value: overview?.read ?? 0,       pct: overview?.read && overview?.opened ? Math.round((overview.read / overview.opened) * 100) : 0, color: 'bg-indigo-500' },
                { label: 'Clicked',   value: overview?.clicked ?? 0,    pct: overview?.clickRate ?? 0,    color: 'bg-amber-500' },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-muted font-medium">{row.label}</span>
                    <span className="text-text-primary font-semibold">{row.value.toLocaleString()} <span className="text-text-muted font-normal">({row.pct}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full transition-all duration-500', row.color)}
                      style={{ width: `${Math.min(row.pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent campaigns table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-text-primary">Recent Campaigns</h2>
          <Link to="/campaigns" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
            View all <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {campaignsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 skeleton rounded" />)}
          </div>
        ) : recentFive.length === 0 ? (
          <div className="text-center py-12">
            <Circle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-text-muted text-sm">No campaigns yet</p>
            <Link to="/campaigns/new" className="btn-primary mt-3 inline-flex">Create Campaign</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Campaign', 'Channel', 'Sent', 'Delivered %', 'Opened %', 'Clicked %', 'Status'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-text-muted pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentFive.map((c) => {
                  const sent      = c.stats?.sent ?? c._count?.recipients ?? 0
                  const delivered = c.stats?.delivered ?? 0
                  const opened    = c.stats?.opened ?? 0
                  const clicked   = c.stats?.clicked ?? 0
                  const pct = (n: number) => sent > 0 ? `${Math.round((n / sent) * 100)}%` : '—'

                  return (
                    <tr key={c.id} className="hover:bg-surface transition-colors group">
                      <td className="py-3 pr-4 font-medium text-text-primary">
                        <Link to={`/campaigns/${c.id}`} className="hover:text-primary transition-colors">
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4"><ChannelBadge channel={c.channel} /></td>
                      <td className="py-3 pr-4 text-text-muted">{sent.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-emerald-600 font-medium">{pct(delivered)}</td>
                      <td className="py-3 pr-4 text-violet-600 font-medium">{pct(opened)}</td>
                      <td className="py-3 pr-4 text-amber-600 font-medium">{pct(clicked)}</td>
                      <td className="py-3"><StatusBadge status={c.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
