import { subDays } from 'date-fns'
import prisma from '../lib/prisma'
import type { Prisma } from '@prisma/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SegmentCondition {
  field:    'totalSpend' | 'orderCount' | 'lastOrderAt' | 'firstOrderAt' | 'city' | 'tags'
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'in' | 'notOrderedInDays' | 'orderedInLastDays' | 'contains' | 'has' | 'hasAny'
  value:    number | string | string[]
}

export interface SegmentRules {
  operator:   'AND' | 'OR'
  conditions: SegmentCondition[]
}

// ── Condition → Prisma WHERE clause ──────────────────────────────────────────

function conditionToWhere(cond: SegmentCondition): Prisma.CustomerWhereInput {
  const { field, operator, value } = cond
  const now = new Date()

  switch (operator) {
    case 'gt':
      return { [field]: { gt: value } }

    case 'lt':
      return { [field]: { lt: value } }

    case 'gte':
      return { [field]: { gte: value } }

    case 'lte':
      return { [field]: { lte: value } }

    case 'eq':
      // PostgreSQL equals is case-sensitive, but we want our segment builder to be robust.
      // However Prisma doesn't support mode: 'insensitive' on equals, so we'll leave it as is 
      // but 'contains' will provide a better insensitive match option.
      return { [field]: { equals: value } }

    case 'contains':
      return { [field]: { contains: value as string, mode: 'insensitive' } }

    case 'in':
      if (field === 'tags') {
        const tagValues = Array.isArray(value) ? value : [value as string]
        return { tags: { hasSome: tagValues } }
      }
      return { [field]: { in: Array.isArray(value) ? value : [value as string] } }

    case 'has':
      return { [field]: { has: value as string } }

    case 'hasAny':
      return { [field]: { hasSome: Array.isArray(value) ? value : [value as string] } }

    case 'notOrderedInDays': {
      // Customers who haven't ordered in N days (or never ordered)
      const cutoff = subDays(now, Number(value))
      return {
        OR: [
          { [field]: { lt: cutoff } },
          { [field]: null },
        ],
      }
    }

    case 'orderedInLastDays': {
      // Customers who ordered within the last N days
      const cutoff = subDays(now, Number(value))
      return { [field]: { gte: cutoff } }
    }

    default:
      throw new Error(`Unknown segment operator: ${operator}`)
  }
}

// ── Main export: rules → Prisma WHERE ────────────────────────────────────────

export function buildWhereClause(rules: SegmentRules): Prisma.CustomerWhereInput {
  const clauses = rules.conditions.map(conditionToWhere)

  if (rules.operator === 'AND') {
    return { AND: clauses }
  } else {
    return { OR: clauses }
  }
}

// ── Count matching customers ──────────────────────────────────────────────────

export async function countSegment(rules: SegmentRules): Promise<number> {
  const where = buildWhereClause(rules)
  return prisma.customer.count({ where })
}

// ── Preview matching customers (first N) ──────────────────────────────────────

export async function previewSegment(rules: SegmentRules, limit = 10) {
  const where = buildWhereClause(rules)
  return prisma.customer.findMany({
    where,
    take: limit,
    orderBy: { totalSpend: 'desc' },
    select: {
      id:          true,
      firstName:   true,
      lastName:    true,
      email:       true,
      city:        true,
      totalSpend:  true,
      orderCount:  true,
      lastOrderAt: true,
      tags:        true,
    },
  })
}
