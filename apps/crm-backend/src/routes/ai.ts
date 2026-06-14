import { Router, Response } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler'
import { generateSegmentRules, draftMessage, streamChat } from '../services/aiService'
import prisma from '../lib/prisma'

const router = Router()

/**
 * GET /api/ai/sessions
 * Fetch all chat sessions
 */
router.get('/sessions', asyncHandler(async (req, res) => {
  const sessions = await prisma.chatSession.findMany({
    orderBy: { updatedAt: 'desc' },
    select: { id: true, updatedAt: true, createdAt: true }
  })
  res.json(sessions)
}))

/**
 * GET /api/ai/sessions/:id
 * Fetch a specific chat session
 */
router.get('/sessions/:id', asyncHandler(async (req, res) => {
  const session = await prisma.chatSession.findUnique({
    where: { id: req.params.id }
  })
  if (!session) return res.status(404).json({ error: 'Session not found' })
  res.json(session)
}))

/**
 * POST /api/ai/segment
 * Converts a plain-English audience description into structured segment rules.
 */
router.post('/segment', asyncHandler(async (req, res) => {
  const { prompt } = z.object({ prompt: z.string().min(1) }).parse(req.body)
  const result = await generateSegmentRules(prompt)
  res.json(result)
}))

/**
 * POST /api/ai/draft
 * Generates a personalised campaign message for a given channel.
 */
router.post('/draft', asyncHandler(async (req, res) => {
  const { brief, channel, customerSample } = z
    .object({
      brief:          z.string().min(1),
      channel:        z.enum(['whatsapp', 'sms', 'email', 'rcs']).default('whatsapp'),
      customerSample: z.record(z.unknown()).optional(),
    })
    .parse(req.body)

  const result = await draftMessage(brief, channel, customerSample)
  res.json(result)
}))

/**
 * POST /api/ai/chat
 * SSE streaming endpoint for the AI chat interface.
 * Streams tokens as Server-Sent Events.
 */
router.post('/chat', async (req, res: Response) => {
  const { messages, context, sessionId } = z
    .object({
      messages: z.array(
        z.object({
          role:    z.enum(['user', 'assistant', 'system']),
          content: z.string(),
        })
      ),
      context: z.record(z.unknown()).default({}),
      sessionId: z.string().optional(),
    })
    .parse(req.body)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  await streamChat(messages, context, res, sessionId)
})

export default router
