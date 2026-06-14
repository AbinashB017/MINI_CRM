import 'dotenv/config'
import express, { Request, Response } from 'express'
import axios from 'axios'
import { v4 as uuid } from 'uuid'

const app = express()
app.use(express.json())

// ── Delivery simulation probabilities ───────────────────────────────────────
const PROBS = {
  delivered: 0.92,
  opened: 0.65,
  read: 0.80,
  clicked: 0.28,
  failReasons: ['Invalid number', 'User opted out', 'Network error', 'Quota exceeded'],
}

// ── Delay ranges in ms [min, max] ───────────────────────────────────────────
const DELAYS = {
  toDelivered: [800, 3000] as [number, number],
  toOpened: [3000, 10000] as [number, number],
  toRead: [1000, 5000] as [number, number],
  toClicked: [500, 3000] as [number, number],
}

// ── In-memory stats ─────────────────────────────────────────────────────────
const stats = {
  received: 0,
  delivered: 0,
  failed: 0,
  opened: 0,
  read: 0,
  clicked: 0,
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function roll(probability: number): boolean {
  return Math.random() < probability
}

async function fireCallback(callbackUrl: string, data: object): Promise<void> {
  try {
    await axios.post(callbackUrl, data, { timeout: 5000 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`❌ Callback failed to ${callbackUrl}: ${message}`)
    // Retry once after 3 seconds
    setTimeout(async () => {
      try {
        await axios.post(callbackUrl, data)
      } catch {
        console.error(`❌ Retry also failed to ${callbackUrl}`)
      }
    }, 3000)
  }
}

// ── Core simulation logic ───────────────────────────────────────────────────
async function simulateDelivery(recipientId: string, callbackUrl: string): Promise<void> {
  const now = () => new Date().toISOString()

  // Wait before attempting delivery
  await new Promise((r) => setTimeout(r, randomBetween(...DELAYS.toDelivered)))

  // 8% chance of failure
  if (!roll(PROBS.delivered)) {
    const reason = PROBS.failReasons[Math.floor(Math.random() * PROBS.failReasons.length)]
    stats.failed++
    await fireCallback(callbackUrl, {
      recipientId,
      event: 'failed',
      timestamp: now(),
      reason,
    })
    return
  }

  // Delivered
  stats.delivered++
  await fireCallback(callbackUrl, { recipientId, event: 'delivered', timestamp: now() })

  // 65% chance opened
  if (!roll(PROBS.opened)) return
  await new Promise((r) => setTimeout(r, randomBetween(...DELAYS.toOpened)))
  stats.opened++
  await fireCallback(callbackUrl, { recipientId, event: 'opened', timestamp: now() })

  // 80% of opened → read
  if (!roll(PROBS.read)) return
  await new Promise((r) => setTimeout(r, randomBetween(...DELAYS.toRead)))
  stats.read++
  await fireCallback(callbackUrl, { recipientId, event: 'read', timestamp: now() })

  // 28% of read → clicked
  if (!roll(PROBS.clicked)) return
  await new Promise((r) => setTimeout(r, randomBetween(...DELAYS.toClicked)))
  stats.clicked++
  await fireCallback(callbackUrl, { recipientId, event: 'clicked', timestamp: now() })
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /send — called by CRM worker for each recipient
app.post('/send', (req: Request, res: Response) => {
  const { recipientId, callbackUrl, channel, to, message } = req.body

  if (!recipientId || !callbackUrl) {
    return res.status(400).json({ error: 'recipientId and callbackUrl are required' })
  }

  stats.received++
  const messageId = uuid()

  console.log(
    `📨 [${channel?.toUpperCase() || 'MSG'}] Sending to ${to} (recipient: ${recipientId}) — msg: ${(message || '').slice(0, 60)}...`
  )

  // Respond immediately — simulate async delivery in background
  res.json({ accepted: true, messageId })

  // Fire and forget — do NOT await
  simulateDelivery(recipientId, callbackUrl).catch(console.error)
})

// GET /health — for UptimeRobot
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', stats, timestamp: new Date() })
})

// GET /stats — quick stats check
app.get('/stats', (_req: Request, res: Response) => {
  res.json(stats)
})

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.CHANNEL_STUB_PORT || 4001
app.listen(PORT, () => {
  console.log(`📡 Channel Stub running on http://localhost:${PORT}`)
})
