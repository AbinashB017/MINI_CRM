import { Router } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

// Status lifecycle: pending → sent → delivered → opened → read → clicked
// Any status → failed is always allowed
const STATUS_ORDER: Record<string, number> = {
  pending:   0,
  sent:      1,
  delivered: 2,
  opened:    3,
  read:      4,
  clicked:   5,
  failed:    99, // Always overrides
}

const STATUS_TO_TIMESTAMP: Record<string, string> = {
  delivered: 'deliveredAt',
  opened:    'openedAt',
  read:      'readAt',
  clicked:   'clickedAt',
}

const receiptSchema = z.object({
  recipientId: z.string().min(1),
  event:       z.enum(['delivered', 'failed', 'opened', 'read', 'clicked']),
  timestamp:   z.string().datetime(),
  reason:      z.string().optional(), // only for failed
})

/**
 * POST /api/webhooks/receipt
 * Called by the channel stub when a message event occurs.
 * Implements ordered status lifecycle — never downgrades status.
 */
router.post('/receipt', asyncHandler(async (req, res) => {
  const parsed = receiptSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid payload' },
    })
  }

  const { recipientId, event, timestamp, reason } = parsed.data

  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: recipientId },
  })

  if (!recipient) {
    // Return 200 so stub doesn't retry endlessly
    return res.json({ success: false, message: 'Recipient not found' })
  }

  // Determine if we should update the primary status string
  const currentOrder = STATUS_ORDER[recipient.status] ?? 0
  const incomingOrder = STATUS_ORDER[event] ?? 0
  const shouldUpdateStatus = event === 'failed' || incomingOrder > currentOrder

  // Build the update payload
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(timestamp),
  }

  if (shouldUpdateStatus) {
    updateData.status = event
  }

  if (event === 'failed') {
    updateData.failReason = reason ?? 'Unknown error'
  }

  const tsField = STATUS_TO_TIMESTAMP[event]
  if (tsField) {
    updateData[tsField] = new Date(timestamp)
  }

  await prisma.campaignRecipient.update({
    where: { id: recipientId },
    data: updateData,
  })

  // Respond 200 immediately so the stub doesn't retry
  res.json({ success: true, event, recipientId })
}))

export default router
