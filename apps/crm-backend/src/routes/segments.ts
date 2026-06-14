import { Router } from 'express'
import { z, ZodError } from 'zod'
import prisma from '../lib/prisma'
import { asyncHandler } from '../utils/asyncHandler'
import { buildWhereClause, countSegment, previewSegment } from '../services/segmentEngine'
import { generateSegmentRules } from '../services/aiService'

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

const segmentRulesConditionSchema = z.object({
  field:    z.enum(['totalSpend', 'orderCount', 'lastOrderAt', 'firstOrderAt', 'city', 'tags']),
  operator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq', 'in', 'notOrderedInDays', 'orderedInLastDays']),
  value:    z.union([z.number(), z.string(), z.array(z.string())]),
})

const segmentRulesSchema = z.object({
  operator:   z.enum(['AND', 'OR']),
  conditions: z.array(segmentRulesConditionSchema).min(1),
})

const createSegmentSchema = z.object({
  name:        z.string().min(1),
  description: z.string().optional(),
  rules:       segmentRulesSchema,
  aiPrompt:    z.string().optional(),
})

/**
 * GET /api/segments
 */
router.get('/', asyncHandler(async (_req, res) => {
  const segments = await prisma.segment.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { campaigns: true } } },
  })
  res.json(segments)
}))

/**
 * POST /api/segments/ai
 * AI generates rules from plain-English prompt
 */
router.post('/ai', asyncHandler(async (req, res) => {
  const { prompt } = z.object({ prompt: z.string().min(1) }).parse(req.body)
  const result = await generateSegmentRules(prompt)

  // Count how many customers match these AI-generated rules
  const count = await countSegment(result.rules)
  const preview = await previewSegment(result.rules, 5)

  res.json({ ...result, count, preview })
}))

/**
 * POST /api/segments
 */
router.post('/', asyncHandler(async (req, res) => {
  const parsed = createSegmentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json(zodError(parsed.error))

  const count = await countSegment(parsed.data.rules)

  const segment = await prisma.segment.create({
    data: {
      name:        parsed.data.name,
      description: parsed.data.description,
      rules:       parsed.data.rules as object,
      aiPrompt:    parsed.data.aiPrompt,
      count,
    },
  })

  res.status(201).json(segment)
}))

/**
 * GET /api/segments/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const segment = await prisma.segment.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { campaigns: true } } },
  })

  if (!segment) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Segment not found' } })
  }

  // Preview first 10 matching customers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules = segment.rules as any
  const [count, preview] = await Promise.all([
    countSegment(rules),
    previewSegment(rules, 10),
  ])

  res.json({ ...segment, count, preview })
}))

/**
 * GET /api/segments/:id/customers
 * Paginated list of all customers matching this segment
 */
router.get('/:id/customers', asyncHandler(async (req, res) => {
  const segment = await prisma.segment.findUnique({ where: { id: req.params.id } })
  if (!segment) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Segment not found' } })
  }

  const page  = Math.max(1, parseInt(req.query.page  as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules = segment.rules as any
  const where = buildWhereClause(rules)

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { totalSpend: 'desc' },
    }),
    prisma.customer.count({ where }),
  ])

  res.json({
    data: customers,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
}))

/**
 * PUT /api/segments/:id
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const parsed = createSegmentSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json(zodError(parsed.error))

  const updateData: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.rules) {
    updateData.count = await countSegment(parsed.data.rules)
    updateData.rules = parsed.data.rules as object
  }

  const segment = await prisma.segment.update({
    where: { id: req.params.id },
    data: updateData,
  })
  res.json(segment)
}))

/**
 * DELETE /api/segments/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  try {
    await prisma.segment.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Segment not found' } })
    }
    throw err
  }
}))

export default router
