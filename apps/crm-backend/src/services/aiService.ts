import Groq from 'groq-sdk'
import type { Response } from 'express'
import type { SegmentRules } from './segmentEngine'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

// ── Helper: extract JSON from model response (handles markdown code fences) ──

function extractJson(text: string): string {
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()
  // Try to extract raw JSON object/array
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text.trim()
}

// ── Rate limit error guard ────────────────────────────────────────────────────

function isRateLimitError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: number }).status === 429
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Generate Segment Rules from plain English
// ─────────────────────────────────────────────────────────────────────────────

export interface GeneratedSegment {
  name:        string
  description: string
  rules:       SegmentRules
}

export async function generateSegmentRules(prompt: string): Promise<GeneratedSegment> {
  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You are a CRM segment builder for a D2C fashion brand. Convert the user's plain English audience description into a structured JSON rules object.

Rules schema:
{
  "operator": "AND" | "OR",
  "conditions": [
    {
      "field": "totalSpend" | "orderCount" | "lastOrderAt" | "firstOrderAt" | "city" | "tags",
      "operator": "gt" | "lt" | "gte" | "lte" | "eq" | "in" | "notOrderedInDays" | "orderedInLastDays",
      "value": number | string | string[]
    }
  ]
}

Also return a suggested segment name and description.

Respond ONLY with valid JSON in this exact format, no markdown, no explanation:
{
  "name": "Suggested segment name",
  "description": "One sentence describing this audience",
  "rules": { "operator": "AND", "conditions": [...] }
}

Examples:
- "customers who haven't bought in 45 days" → conditions: [{ "field": "lastOrderAt", "operator": "notOrderedInDays", "value": 45 }]
- "high value customers who spent over 5000" → conditions: [{ "field": "totalSpend", "operator": "gte", "value": 5000 }]
- "customers from Mumbai or Delhi who bought more than 3 times" → { "operator": "AND", "conditions": [{ "field": "city", "operator": "in", "value": ["Mumbai", "Delhi"] }, { "field": "orderCount", "operator": "gt", "value": 3 }] }
- "customers who ordered in the last 30 days" → conditions: [{ "field": "lastOrderAt", "operator": "orderedInLastDays", "value": 30 }]
- "VIP customers" → conditions: [{ "field": "tags", "operator": "in", "value": ["vip"] }]`,
        },
        { role: 'user', content: prompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    const json = extractJson(raw)

    try {
      const parsed = JSON.parse(json) as GeneratedSegment
      if (!parsed.name || !parsed.rules || !parsed.rules.conditions) {
        throw new Error('Invalid response structure from AI')
      }
      return parsed
    } catch {
      throw new Error(`AI returned invalid JSON: ${raw.slice(0, 200)}`)
    }
  } catch (err) {
    if (isRateLimitError(err)) {
      throw new Error('AI is a bit busy right now. Please try again in a moment.')
    }
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Draft a campaign message
// ─────────────────────────────────────────────────────────────────────────────

export type DraftResult = string | { subject: string; body: string }

export async function draftMessage(
  brief: string,
  channel: string,
  sampleCustomer?: object
): Promise<{ message: DraftResult }> {
  const sampleContext = sampleCustomer
    ? `\n\nSample customer for context: ${JSON.stringify(sampleCustomer)}`
    : ''

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You are a marketing copywriter for a D2C fashion brand called "Xeno Style". Write a short personalised message.

Rules:
- SMS: max 160 characters, very concise, one clear CTA
- WhatsApp/RCS: max 300 characters, friendly and conversational, can use 1 emoji
- Email: return JSON { "subject": "...", "body": "..." }, body max 150 words, slightly more formal
- Use personalisation merge tags: {{firstName}}, {{totalSpend}}, {{orderCount}}, {{city}}
- End with a specific call-to-action
- Never use ALL CAPS
- Sound human, not robotic
- For SMS/WhatsApp/RCS: return ONLY the message text
- For email: return ONLY valid JSON with "subject" and "body" fields`,
        },
        {
          role: 'user',
          content: `Channel: ${channel}\nBrief: ${brief}${sampleContext}`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? ''

    if (channel === 'email') {
      try {
        const json = extractJson(raw)
        const parsed = JSON.parse(json) as { subject: string; body: string }
        return { message: parsed }
      } catch {
        // Fallback: treat as plain text if JSON parse fails
        return { message: raw }
      }
    }

    return { message: raw }
  } catch (err) {
    if (isRateLimitError(err)) {
      throw new Error('AI is a bit busy right now. Please try again in a moment.')
    }
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Streaming chat for AI Chat interface (SSE)
// ─────────────────────────────────────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT = `You are an intelligent CRM assistant helping a marketer for a D2C fashion brand called "Xeno Style".
You help create and send marketing campaigns through natural conversation.

You can:
1. Understand audience descriptions and create customer segments
2. Write personalised campaign messages for WhatsApp, SMS, Email, or RCS
3. Help send campaigns to the right audience
4. Show campaign performance and stats

When the user tells you what they want to do:
1. Understand their intent clearly
2. If they want to reach customers — describe the segment you'll create
3. Draft an appropriate message for the channel
4. Tell them how many customers match and show a preview of the message
5. Ask for confirmation before sending ("Should I go ahead and send this?")
6. On confirmation, trigger the actual send

When you need to perform a backend action, output this exact XML tag in your response (on its own line):
<action>{"type":"GENERATE_SEGMENT","payload":{"prompt":"<audience description>"}}</action>
OR
<action>{"type":"DRAFT_MESSAGE","payload":{"brief":"<message brief>","channel":"whatsapp"}}</action>
OR
<action>{"type":"CREATE_AND_SEND","payload":{}}</action>

Keep responses concise and action-oriented. When showing numbers, be specific.
Use Indian currency format (₹) when mentioning money.
Be warm, professional, and helpful — like a smart marketing assistant.`

export async function streamChat(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  context: object,
  res: Response,
  sessionId?: string
): Promise<void> {
  const systemWithContext = CHAT_SYSTEM_PROMPT.replace(
    'CONTEXT_PLACEHOLDER',
    JSON.stringify(context)
  )

  // Inject context into system message
  const fullSystemPrompt =
    CHAT_SYSTEM_PROMPT +
    `\n\nCurrent campaign builder context: ${JSON.stringify(context)}`

  let fullResponse = ''
  let newSessionId = sessionId

  try {
    // Implement sliding window for context (keep last 10 messages)
    const recentMessages = messages.slice(-10)

    const stream = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      stream: true,
      messages: [
        { role: 'system', content: fullSystemPrompt },
        ...recentMessages,
      ],
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) {
        fullResponse += delta
        res.write(`data: ${JSON.stringify({ delta })}\n\n`)
      }
    }

    // Persist session to database after successful stream
    const { default: prisma } = await import('../lib/prisma')
    const finalMessages = [...messages, { role: 'assistant', content: fullResponse }]
    
    if (newSessionId) {
      await prisma.chatSession.update({
        where: { id: newSessionId },
        data: { messages: finalMessages, context: context as any }
      })
    } else {
      const session = await prisma.chatSession.create({
        data: { messages: finalMessages, context: context as any }
      })
      newSessionId = session.id
    }

    res.write(`data: ${JSON.stringify({ done: true, sessionId: newSessionId })}\n\n`)
    res.end()
  } catch (err) {
    if (isRateLimitError(err)) {
      res.write(`data: ${JSON.stringify({ delta: '\n\nAI is a bit busy right now. Please try again in a moment.' })}\n\n`)
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
      res.end()
      return
    }
    res.write(`data: ${JSON.stringify({ error: 'Stream failed', done: true })}\n\n`)
    res.end()
  }

  void systemWithContext // suppress unused var warning
}
