import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import morgan from 'morgan'

// Routes
import customerRoutes from './routes/customers'
import segmentRoutes  from './routes/segments'
import campaignRoutes from './routes/campaigns'
import webhookRoutes  from './routes/webhooks'
import aiRoutes       from './routes/ai'

// BullMQ Worker
import { createSendWorker } from './workers/sendWorker'

const app = express()
const PORT = process.env.PORT || 3001

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '10mb' }))
app.use(morgan('dev'))

// ── Health check (UptimeRobot / Render pings this) ──────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date(), service: 'crm-backend' })
})

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/customers', customerRoutes)
app.use('/api/segments',  segmentRoutes)
app.use('/api/campaigns', campaignRoutes)
app.use('/api/webhooks',  webhookRoutes)
app.use('/api/ai',        aiRoutes)

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
})

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err.stack)
  res.status(500).json({
    error: {
      code:    'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    },
  })
})

// ── Start server & workers ────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`🚀 CRM Backend running on http://localhost:${PORT}`)

  // Start BullMQ worker (runs in-process; use a separate process in production)
  const worker = createSendWorker()
  console.log('⚙️  BullMQ send worker started (concurrency: 5)')

  // Graceful SIGTERM shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received — shutting down gracefully')
    await worker.close()
    server.close(() => {
      console.log('Server closed')
      process.exit(0)
    })
  })
})

export default app
