import prisma from '../lib/prisma'
import { Queue } from 'bullmq'
import { bullMQConnection } from '../lib/redis'
import { buildWhereClause } from './segmentEngine'
import type { SegmentRules } from './segmentEngine'

const sendQueue = new Queue('campaign-send', { connection: bullMQConnection })

/**
 * Triggers a campaign send:
 * 1. Resolve all matching customers via segment engine
 * 2. Batch-create CampaignRecipient records
 * 3. Push one BullMQ job per recipient
 * 4. Update campaign status to 'sending'
 */
export async function triggerCampaignSend(
  campaignId: string
): Promise<{ jobCount: number }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { segment: true },
  })

  if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

  // ── 1. Resolve matching customers ─────────────────────────────────────────
  let customerIds: string[] = []

  if (campaign.segment && campaign.segment.rules) {
    const rules = campaign.segment.rules as unknown as SegmentRules
    const where = buildWhereClause(rules)
    const customers = await prisma.customer.findMany({
      where,
      select: { id: true },
    })
    customerIds = customers.map((c) => c.id)
  } else {
    // No segment — send to ALL customers
    const customers = await prisma.customer.findMany({ select: { id: true } })
    customerIds = customers.map((c) => c.id)
  }

  if (customerIds.length === 0) {
    return { jobCount: 0 }
  }

  // ── 2 & 3. Process customers in memory-safe chunks ─────────────────────────
  const CHUNK_SIZE = 500
  let totalJobs = 0

  for (let i = 0; i < customerIds.length; i += CHUNK_SIZE) {
    const chunk = customerIds.slice(i, i + CHUNK_SIZE)
    
    // Create recipients
    await prisma.campaignRecipient.createMany({
      data: chunk.map((customerId) => ({
        campaignId,
        customerId,
        message: campaign.messageTemplate,
        status: 'pending',
      })),
      skipDuplicates: true,
    })

    // Fetch ONLY the newly created pending recipients for this specific chunk
    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId, customerId: { in: chunk }, status: 'pending' },
      select: { id: true, customerId: true },
    })

    const jobs = recipients.map((r) => ({
      name: 'send-message',
      data: {
        recipientId: r.id,
        campaignId,
        customerId:  r.customerId,
        channel:     campaign.channel,
      },
      opts: {
        attempts:         5,
        backoff: { type: 'exponential' as const, delay: 3000 },
        removeOnComplete: 1000,
        removeOnFail:     500,
      },
    }))

    if (jobs.length > 0) {
      await sendQueue.addBulk(jobs)
      totalJobs += jobs.length
    }
  }

  // ── 4. Update campaign status ─────────────────────────────────────────────
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'sending',
      sentAt: new Date(),
    },
  })

  console.log(`📣 Campaign ${campaignId} — queued ${totalJobs} messages`)
  return { jobCount: totalJobs }
}
