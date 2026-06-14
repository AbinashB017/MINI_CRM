import { Router } from 'express'
import { z, ZodError } from 'zod'
import prisma from '../lib/prisma'
import { asyncHandler } from '../utils/asyncHandler'
import { triggerCampaignSend } from '../services/campaignSender'

const router = Router()

function zodError(err: ZodError) {
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      fields: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    },
  }
}

const createCampaignSchema = z.object({
  name:            z.string().min(1),
  segmentId:       z.string().optional().nullable(),
  channel:         z.enum(['whatsapp', 'sms', 'email', 'rcs']).default('whatsapp'),
  messageTemplate: z.string().min(1),
  status:          z.enum(['draft', 'sending', 'sent']).default('draft'),
  scheduledAt:     z.string().datetime().optional().nullable(),
})

/**
 * GET /api/campaigns/analytics/overview
 * Must be BEFORE /:id to avoid routing conflict
 */
router.get('/analytics/overview', asyncHandler(async (_req, res) => {
  const campaigns = await prisma.campaign.findMany({
    where: { status: { in: ['sent', 'sending'] } },
    select: { id: true },
  })
  
  const campaignIds = campaigns.map(c => c.id)

  const stats = await prisma.campaignRecipient.groupBy({
    by: ['status'],
    where: { campaignId: { in: campaignIds } },
    _count: { status: true },
  })

  const rawTotals = { sent: 0, delivered: 0, opened: 0, read: 0, clicked: 0, failed: 0 }
  for (const s of stats) {
    if (s.status in rawTotals) {
      rawTotals[s.status as keyof typeof rawTotals] = s._count.status
    }
  }

  const clicked = rawTotals.clicked
  const read = rawTotals.read + clicked
  const opened = rawTotals.opened + read
  const delivered = rawTotals.delivered + opened
  const failed = rawTotals.failed
  const sent = rawTotals.sent + delivered + failed

  const totals = { sent, delivered, opened, read, clicked, failed }

  const deliveryRate = totals.sent > 0 ? Math.round((totals.delivered / totals.sent) * 100) : 0
  const openRate     = totals.delivered > 0 ? Math.round((totals.opened  / totals.delivered) * 100) : 0
  const clickRate    = totals.opened > 0 ? Math.round((totals.clicked / totals.opened) * 100) : 0

  const orders = await prisma.order.aggregate({
    where: { campaignId: { in: campaignIds } },
    _sum: { amount: true },
    _count: { id: true },
  })

  res.json({
    campaignCount: campaignIds.length,
    ...totals,
    deliveryRate,
    openRate,
    clickRate,
    revenue: orders._sum.amount || 0,
    ordersGenerated: orders._count.id || 0,
  })
}))

/**
 * GET /api/campaigns
 */
router.get('/', asyncHandler(async (_req, res) => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      segment: { select: { id: true, name: true, count: true } },
      _count:  { select: { recipients: true } },
    },
  })

  const campaignIds = campaigns.map((c) => c.id)
  
  const stats = await prisma.campaignRecipient.groupBy({
    by: ['campaignId', 'status'],
    where: { campaignId: { in: campaignIds } },
    _count: { status: true },
  })

  const statsMap = new Map<string, Record<string, number>>()
  for (const c of campaignIds) statsMap.set(c, { sent: 0, delivered: 0, opened: 0, read: 0, clicked: 0, failed: 0 })
  for (const s of stats) {
    statsMap.get(s.campaignId)![s.status] = s._count.status
  }

  for (const st of statsMap.values()) {
    const clicked = st.clicked || 0
    const read = (st.read || 0) + clicked
    const opened = (st.opened || 0) + read
    const delivered = (st.delivered || 0) + opened
    const failed = st.failed || 0
    const sent = (st.sent || 0) + delivered + failed

    st.clicked = clicked
    st.read = read
    st.opened = opened
    st.delivered = delivered
    st.failed = failed
    st.sent = sent
  }

  const campaignsWithStats = campaigns.map((c) => ({
    ...c,
    stats: statsMap.get(c.id) || {}
  }))

  res.json(campaignsWithStats)
}))

/**
 * POST /api/campaigns
 */
router.post('/', asyncHandler(async (req, res) => {
  const parsed = createCampaignSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json(zodError(parsed.error))

  const campaign = await prisma.campaign.create({
    data: {
      ...parsed.data,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
    },
  })

  res.status(201).json(campaign)
}))

/**
 * GET /api/campaigns/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: req.params.id },
    include: {
      segment: true,
      _count: { select: { recipients: true } },
    },
  })

  if (!campaign) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } })
  }

  const stats = await prisma.campaignRecipient.groupBy({
    by: ['status'],
    where: { campaignId: campaign.id },
    _count: { status: true },
  })

  const orders = await prisma.order.aggregate({
    where: { campaignId: campaign.id },
    _sum: { amount: true },
    _count: { id: true },
  })
  const rawMap = Object.fromEntries(stats.map((s) => [s.status, s._count.status]))
  const clicked = rawMap.clicked || 0
  const read = (rawMap.read || 0) + clicked
  const opened = (rawMap.opened || 0) + read
  const delivered = (rawMap.delivered || 0) + opened
  const failed = rawMap.failed || 0
  const sent = (rawMap.sent || 0) + delivered + failed

  const statMap = { sent, delivered, opened, read, clicked, failed }

  res.json({ 
    ...campaign, 
    stats: statMap, 
    revenue: orders._sum.amount || 0, 
    ordersGenerated: orders._count.id || 0 
  })
}))

/**
 * PUT /api/campaigns/:id
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const parsed = createCampaignSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json(zodError(parsed.error))

  const campaign = await prisma.campaign.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
    },
  })

  res.json(campaign)
}))

/**
 * POST /api/campaigns/:id/send
 * Triggers campaign send via BullMQ
 */
router.post('/:id/send', asyncHandler(async (req, res) => {
  const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } })
  if (!campaign) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } })
  }
  if (campaign.status === 'sent' || campaign.status === 'sending') {
    return res.status(400).json({ error: { code: 'ALREADY_SENT', message: 'Campaign has already been sent or is currently sending' } })
  }

  const result = await triggerCampaignSend(campaign.id)
  res.json({ ...result, campaignId: campaign.id })
}))

/**
 * POST /api/campaigns/:id/simulate-order
 * Simulates a customer placing an order after receiving a campaign message
 */
router.post('/:id/simulate-order', asyncHandler(async (req, res) => {
  const { customerId } = req.body
  if (!customerId) return res.status(400).json({ error: 'customerId is required' })

  const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } })
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })

  // Simulate an order of $50 to $200
  const amount = Math.floor(Math.random() * 150) + 50
  
  const order = await prisma.order.create({
    data: {
      customerId,
      campaignId: campaign.id,
      orderNumber: `ORD-SIM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      amount,
      status: 'completed',
      orderedAt: new Date(),
      items: JSON.stringify([{ name: 'Simulated Product', price: amount, quantity: 1 }]),
    }
  })

  // Update customer LTV
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      totalSpend: { increment: amount },
      orderCount: { increment: 1 },
      lastOrderAt: new Date(),
    }
  })

  res.status(201).json(order)
}))

/**
 * GET /api/campaigns/:id/recipients
 */
router.get('/:id/recipients', asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25))
  const search = (req.query.search as string) || ''

  const where = {
    campaignId: req.params.id,
    ...(search
      ? {
          customer: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName:  { contains: search, mode: 'insensitive' as const } },
              { email:     { contains: search, mode: 'insensitive' as const } },
            ],
          },
        }
      : {}),
  }

  const [recipients, total] = await Promise.all([
    prisma.campaignRecipient.findMany({
      where,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.campaignRecipient.count({ where }),
  ])

  res.json({
    data: recipients,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
}))

export default router
