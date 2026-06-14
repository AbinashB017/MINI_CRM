import axios from 'axios'
import toast from 'react-hot-toast'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const http = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

// ── Response interceptor: toast on 4xx/5xx ───────────────────────────────────
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.error?.message ||
      err.response?.data?.message ||
      err.message ||
      'Something went wrong'
    toast.error(message)
    return Promise.reject(err)
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  city?: string
  totalSpend: number
  orderCount: number
  lastOrderAt?: string
  firstOrderAt?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  customerId: string
  orderNumber: string
  amount: number
  status: string
  channel?: string
  items: string[]
  orderedAt: string
  createdAt: string
}

export interface SegmentCondition {
  field: string
  operator: string
  value: number | string | string[]
}

export interface SegmentRules {
  operator: 'AND' | 'OR'
  conditions: SegmentCondition[]
}

export interface Segment {
  id: string
  name: string
  description?: string
  rules: SegmentRules
  aiPrompt?: string
  count: number
  createdAt: string
  updatedAt: string
}

export interface Campaign {
  id: string
  name: string
  segmentId?: string
  channel: string
  messageTemplate: string
  status: string
  scheduledAt?: string
  sentAt?: string
  createdAt: string
  updatedAt: string
  segment?: Segment
  stats?: Record<string, number>
  _count?: { recipients: number }
  revenue?: number
  ordersGenerated?: number
}

export interface CampaignRecipient {
  id: string
  campaignId: string
  customerId: string
  message: string
  status: string
  failReason?: string
  sentAt?: string
  deliveredAt?: string
  openedAt?: string
  readAt?: string
  clickedAt?: string
  createdAt: string
  customer?: Pick<Customer, 'id' | 'firstName' | 'lastName' | 'email' | 'phone'>
}

export interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
  hasNext?: boolean
  hasPrev?: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
}

export interface CustomerStats {
  total: number
  avgSpend: number
  totalRevenue: number
  activeThisMonth: number
}

export interface AnalyticsOverview {
  campaignCount: number
  sent: number
  delivered: number
  opened: number
  read: number
  clicked: number
  failed: number
  deliveryRate: number
  openRate: number
  clickRate: number
  revenue: number
  ordersGenerated: number
}

// ─────────────────────────────────────────────────────────────────────────────
// API client
// ─────────────────────────────────────────────────────────────────────────────

export const api = {
  // ── Customers ───────────────────────────────────────────────────────────────
  customers: {
    list: (params?: {
      page?: number
      limit?: number
      search?: string
      sort?: string
      order?: 'asc' | 'desc'
    }) => http.get<PaginatedResponse<Customer>>('/api/customers', { params }).then((r) => r.data),

    get: (id: string) =>
      http.get<Customer & { orders: Order[] }>(`/api/customers/${id}`).then((r) => r.data),

    stats: () => http.get<CustomerStats>('/api/customers/stats').then((r) => r.data),

    create: (data: Partial<Customer>) =>
      http.post<Customer>('/api/customers', data).then((r) => r.data),

    update: (id: string, data: Partial<Customer>) =>
      http.put<Customer>(`/api/customers/${id}`, data).then((r) => r.data),

    bulkCreate: (data: Partial<Customer>[]) =>
      http.post<{ created: number }>('/api/customers/bulk', data).then((r) => r.data),
  },

  // ── Segments ─────────────────────────────────────────────────────────────────
  segments: {
    list: () => http.get<Segment[]>('/api/segments').then((r) => r.data),

    get: (id: string) =>
      http.get<Segment & { count: number; preview: Customer[] }>(`/api/segments/${id}`).then((r) => r.data),

    create: (data: { name: string; description?: string; rules: SegmentRules; aiPrompt?: string }) =>
      http.post<Segment>('/api/segments', data).then((r) => r.data),

    update: (id: string, data: Partial<{ name: string; description: string; rules: SegmentRules }>) =>
      http.put<Segment>(`/api/segments/${id}`, data).then((r) => r.data),

    delete: (id: string) => http.delete(`/api/segments/${id}`).then((r) => r.data),

    aiGenerate: (prompt: string) =>
      http
        .post<{ name: string; description: string; rules: SegmentRules; count: number; preview: Customer[] }>(
          '/api/segments/ai',
          { prompt }
        )
        .then((r) => r.data),

    customers: (id: string, params?: { page?: number; limit?: number }) =>
      http
        .get<PaginatedResponse<Customer>>(`/api/segments/${id}/customers`, { params })
        .then((r) => r.data),
  },

  // ── Campaigns ────────────────────────────────────────────────────────────────
  campaigns: {
    list: () => http.get<Campaign[]>('/api/campaigns').then((r) => r.data),

    get: (id: string) =>
      http.get<Campaign & { stats: Record<string, number> }>(`/api/campaigns/${id}`).then((r) => r.data),

    create: (data: Partial<Campaign>) =>
      http.post<Campaign>('/api/campaigns', data).then((r) => r.data),

    update: (id: string, data: Partial<Campaign>) =>
      http.put<Campaign>(`/api/campaigns/${id}`, data).then((r) => r.data),

    send: (id: string) =>
      http.post<{ jobCount: number; campaignId: string }>(`/api/campaigns/${id}/send`).then((r) => r.data),

    recipients: (id: string, params?: { page?: number; limit?: number; search?: string }) =>
      http
        .get<PaginatedResponse<CampaignRecipient>>(`/api/campaigns/${id}/recipients`, { params })
        .then((r) => r.data),

    analyticsOverview: () =>
      http.get<AnalyticsOverview>('/api/campaigns/analytics/overview').then((r) => r.data),

    simulateOrder: (id: string, customerId: string) =>
      http.post<Order>(`/api/campaigns/${id}/simulate-order`, { customerId }).then((r) => r.data),
  },

  // ── AI ───────────────────────────────────────────────────────────────────────
  ai: {
    sessions: () => http.get<Array<{ id: string; createdAt: string; updatedAt: string }>>('/api/ai/sessions').then((r) => r.data),
    
    getSession: (id: string) => http.get<{ id: string; messages: any[]; context: any }>(`/api/ai/sessions/${id}`).then((r) => r.data),

    segment: (prompt: string) =>
      http
        .post<{ name: string; description: string; rules: SegmentRules }>('/api/ai/segment', { prompt })
        .then((r) => r.data),

    draft: (brief: string, channel: string, customerSample?: object) =>
      http
        .post<{ message: string | { subject: string; body: string } }>('/api/ai/draft', {
          brief,
          channel,
          customerSample,
        })
        .then((r) => r.data),

    /** Returns a native fetch Response for SSE streaming */
    chatStream: (messages: Array<{ role: string; content: string }>, context: object, sessionId?: string) =>
      fetch(`${BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, context, sessionId }),
      }),
  },
}

export default api