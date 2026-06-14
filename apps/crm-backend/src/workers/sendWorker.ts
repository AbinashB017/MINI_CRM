import { Worker, Job } from 'bullmq'
import axios from 'axios'
import { bullMQConnection } from '../lib/redis'
import prisma from '../lib/prisma'

const CHANNEL_STUB_URL = process.env.CHANNEL_STUB_URL || 'http://localhost:4001'
const CRM_WEBHOOK_URL  = process.env.CRM_WEBHOOK_URL  || 'http://localhost:3001/api/webhooks/receipt'

interface SendJobData {
  recipientId: string
  campaignId:  string
  customerId:  string
  channel:     string
}

/**
 * Personalise a message template by replacing merge tags with customer data.
 */
function personalise(template: string, customer: {
  firstName:  string
  lastName:   string
  city:       string | null
  totalSpend: number
  orderCount: number
}): string {
  return template
    .replace(/\{\{firstName\}\}/g,  customer.firstName)
    .replace(/\{\{lastName\}\}/g,   customer.lastName)
    .replace(/\{\{city\}\}/g,       customer.city ?? '')
    .replace(/\{\{totalSpend\}\}/g, `₹${Math.round(customer.totalSpend).toLocaleString('en-IN')}`)
    .replace(/\{\{orderCount\}\}/g, String(customer.orderCount))
}

export function createSendWorker() {
  const worker = new Worker<SendJobData>(
    'campaign-send',
    async (job: Job<SendJobData>) => {
      const { recipientId, customerId, channel } = job.data

      // ── 1. Fetch recipient + customer + campaign ────────────────────────────
      const recipient = await prisma.campaignRecipient.findUnique({
        where: { id: recipientId },
        include: {
          customer: true,
          campaign: true,
        },
      })

      if (!recipient) {
        console.warn(`⚠️  Recipient ${recipientId} not found — skipping`)
        return
      }

      // ── 2. Personalise the message ─────────────────────────────────────────
      const message = personalise(recipient.campaign.messageTemplate, {
        firstName:  recipient.customer.firstName,
        lastName:   recipient.customer.lastName,
        city:       recipient.customer.city,
        totalSpend: recipient.customer.totalSpend,
        orderCount: recipient.customer.orderCount,
      })

      // ── 3. POST to channel stub ─────────────────────────────────────────────
      const to = channel === 'email'
        ? recipient.customer.email
        : (recipient.customer.phone ?? recipient.customer.email)

      await axios.post(
        `${CHANNEL_STUB_URL}/send`,
        {
          recipientId,
          customerId,
          channel,
          to,
          message,
          callbackUrl: CRM_WEBHOOK_URL,
        },
        { timeout: 10000 }
      )

      // ── 4. Update recipient: pending → sent ────────────────────────────────
      await prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: {
          status:  'sent',
          message, // save the personalised version
          sentAt:  new Date(),
        },
      })

      console.log(`✅ Sent to ${to} (${channel}) — recipient: ${recipientId}`)
    },
    {  connection:  bullMQConnection,
      concurrency: 2, // process 2 messages simultaneously
      limiter: {
        max: 2, // maximum 2 jobs
        duration: 1000, // per 1 second
      }
    }
  )

  worker.on('failed', async (job, err) => {
    console.error(
      `❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`
    )
    if (job?.data?.recipientId) {
      try {
        await prisma.campaignRecipient.update({
          where: { id: job.data.recipientId },
          data: { status: 'failed', failReason: err.message.substring(0, 255) }
        })
      } catch (dbErr) {
        console.error(`Could not update recipient ${job.data.recipientId} to failed:`, dbErr)
      }
    }
  })

  worker.on('error', (err) => {
    console.error('Worker error:', err)
  })

  worker.on('completed', (job) => {
    console.log(`✔  Job ${job.id} completed`)
  })

  worker.on('drained', async () => {
    console.log('🏁 Queue drained — checking for completed campaigns...')
    try {
      // Small delay to ensure any currently executing jobs or batch enqueues finish
      await new Promise(r => setTimeout(r, 2000))
      
      const sendingCampaigns = await prisma.campaign.findMany({
        where: { status: 'sending' }
      })
      for (const c of sendingCampaigns) {
        const pendingCount = await prisma.campaignRecipient.count({
          where: { campaignId: c.id, status: 'pending' }
        })
        if (pendingCount === 0) {
          await prisma.campaign.update({
            where: { id: c.id },
            data: { status: 'sent' }
          })
          console.log(`🎉 Campaign ${c.id} finalized to 'sent'`)
        }
      }
    } catch (err) {
      console.error('Error checking completed campaigns on drain:', err)
    }
  })

  return worker
}
