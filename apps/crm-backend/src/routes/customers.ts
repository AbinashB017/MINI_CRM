import { Router } from 'express'
import { z, ZodError } from 'zod'
import { subDays } from 'date-fns'
import prisma from '../lib/prisma'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

// ── Zod schemas ──────────────────────────────────────────────────────────────

const createCustomerSchema = z.object({
  firstName:    z.string().min(1, 'First name is required'),
  lastName:     z.string().min(1, 'Last name is required'),
  email:        z.string().email('Invalid email address'),
  phone:        z.string().optional(),
  city:         z.string().optional(),
  totalSpend:   z.number().min(0).optional(),
  orderCount:   z.number().int().min(0).optional(),
  lastOrderAt:  z.string().datetime().optional().nullable(),
  firstOrderAt: z.string().datetime().optional().nullable(),
  tags:         z.array(z.string()).optional(),
  externalId:   z.string().optional().nullable(),
})

const updateCustomerSchema = createCustomerSchema.partial()

const listQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sort:   z.enum(['firstName', 'city', 'totalSpend', 'lastOrderAt', 'orderCount', 'createdAt']).default('createdAt'),
  order:  z.enum(['asc', 'desc']).default('desc'),
})

// ── Helper: parse Zod error into friendly shape ───────────────────────────────
function zodError(err: ZodError) {
  return {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      fields: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: /stats and /bulk must be registered BEFORE /:id or Express will
// try to match "stats" / "bulk" as a customer ID and return 404.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/customers/stats
 * Returns aggregate stats: total, avgSpend, totalRevenue, activeThisMonth
 */
router.get('/stats', asyncHandler(async (_req, res) => {
  const [total, aggregates, activeThisMonth] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.aggregate({
      _avg: { totalSpend: true },
      _sum: { totalSpend: true },
    }),
    prisma.customer.count({
      where: {
        lastOrderAt: { gte: subDays(new Date(), 30) },
      },
    }),
  ])

  res.json({
    total,
    avgSpend:       Math.round(aggregates._avg.totalSpend ?? 0),
    totalRevenue:   Math.round(aggregates._sum.totalSpend ?? 0),
    activeThisMonth,
  })
}))

/**
 * POST /api/customers/bulk
 * Bulk-creates customers; skips duplicates on email.
 * Used by the seed script and CSV import.
 */
router.post('/bulk', asyncHandler(async (req, res) => {
  const result = z.array(createCustomerSchema).safeParse(req.body)
  if (!result.success) return res.status(400).json(zodError(result.error))

  const created = await prisma.customer.createMany({
    data: result.data.map((c) => ({
      ...c,
      lastOrderAt:  c.lastOrderAt  ? new Date(c.lastOrderAt)  : null,
      firstOrderAt: c.firstOrderAt ? new Date(c.firstOrderAt) : null,
    })),
    skipDuplicates: true,
  })

  res.status(201).json({ created: created.count, submitted: result.data.length })
}))

/**
 * GET /api/customers
 * Paginated, searchable, sortable list of customers.
 */
router.get('/', asyncHandler(async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json(zodError(parsed.error))

  const { page, limit, search, sort, order } = parsed.data

  const where = search
    ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName:  { contains: search, mode: 'insensitive' as const } },
          { email:     { contains: search, mode: 'insensitive' as const } },
          { city:      { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ])

  res.json({
    data: customers,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  })
}))

/**
 * POST /api/customers
 * Creates a single customer.
 */
router.post('/', asyncHandler(async (req, res) => {
  const result = createCustomerSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json(zodError(result.error))

  const customer = await prisma.customer.create({
    data: {
      ...result.data,
      lastOrderAt:  result.data.lastOrderAt  ? new Date(result.data.lastOrderAt)  : null,
      firstOrderAt: result.data.firstOrderAt ? new Date(result.data.firstOrderAt) : null,
    },
  })

  res.status(201).json(customer)
}))

/**
 * GET /api/customers/:id
 * Returns a single customer with all their orders.
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: {
      orders: {
        orderBy: { orderedAt: 'desc' },
      },
      _count: {
        select: {
          campaignRecipients: true,
          orders: true,
        },
      },
    },
  })

  if (!customer) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Customer ${req.params.id} not found` },
    })
  }

  res.json(customer)
}))

/**
 * PUT /api/customers/:id
 * Partially updates a customer.
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const result = updateCustomerSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json(zodError(result.error))

  try {
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        ...result.data,
        lastOrderAt:  result.data.lastOrderAt  ? new Date(result.data.lastOrderAt)  : undefined,
        firstOrderAt: result.data.firstOrderAt ? new Date(result.data.firstOrderAt) : undefined,
      },
    })
    res.json(customer)
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2025') {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Customer ${req.params.id} not found` },
      })
    }
    throw err
  }
}))

export default router
