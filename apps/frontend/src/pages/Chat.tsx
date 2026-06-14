import { useState, useRef, useEffect, useCallback } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Send, Sparkles, RotateCcw, Loader2, Users, MessageSquare, Clock } from 'lucide-react'
import { api } from '../lib/api'
import type { SegmentRules } from '../lib/api'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role:    'user' | 'assistant' | 'system'
  content: string
  actions?: ParsedAction[]
  isStreaming?: boolean
}

interface ParsedAction {
  type:    'GENERATE_SEGMENT' | 'DRAFT_MESSAGE' | 'CREATE_AND_SEND'
  payload: Record<string, unknown>
  result?: string
  loading?: boolean
}

interface CampaignBuilderState {
  segmentId?:       string
  segmentName?:     string
  segmentCount?:    number
  channel?:         string
  messageTemplate?: string
  campaignName?:    string
}

// ── Starter prompts ──────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  "Find customers who haven't ordered in 45 days and send them a win-back offer with 15% discount",
  "Message my VIP customers about our new festive collection",
  "Single-purchase customers need a nudge — give them a second order incentive",
  "Send a thank-you message to everyone who ordered this month",
]

// ── Parse action tags from AI response ───────────────────────────────────────

function parseActions(text: string): { clean: string; actions: ParsedAction[] } {
  const actions: ParsedAction[] = []
  const clean = text.replace(/<action>([\s\S]*?)<\/action>/g, (_, json) => {
    try {
      actions.push({ ...JSON.parse(json), loading: false })
    } catch { /* ignore */ }
    return ''
  }).trim()
  return { clean, actions }
}

function cleanStreamingContent(text: string): string {
  // 1. Remove fully formed <action>...</action> blocks
  let clean = text.replace(/<action>([\s\S]*?)<\/action>/g, '')
  // 2. Hide partially formed <action... at the end of the stream
  const lastActionIndex = clean.lastIndexOf('<action')
  if (lastActionIndex !== -1) {
    clean = clean.slice(0, lastActionIndex)
  }
  return clean.trim()
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-3 py-1.5 rounded-full">
          ✓ {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('flex gap-3 mb-4', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}

      <div className={clsx('max-w-[85%] space-y-2', isUser ? 'items-end' : 'items-start')}>
        {/* Text bubble */}
        <div className={clsx(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'bg-primary text-white rounded-tr-sm'
            : 'bg-white border border-border text-text-primary rounded-tl-sm shadow-card'
        )}>
          {msg.content || (msg.isStreaming ? <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span> : null)}
        </div>

        {/* Action results */}
        {msg.actions?.map((a, i) => (
          <div key={i} className="bg-primary-light border border-primary/20 rounded-xl p-3 text-xs">
            {a.loading ? (
              <div className="flex items-center gap-2 text-primary">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Executing: {a.type.replace(/_/g, ' ').toLowerCase()}…</span>
              </div>
            ) : a.result ? (
              <div className="text-primary font-medium">✓ {a.result}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Campaign Builder Panel ────────────────────────────────────────────────────

function CampaignBuilderPanel({
  state, onSend, onSetChannel
}: { state: CampaignBuilderState; onSend: () => void; onSetChannel: (ch: string) => void }) {
  const isEmpty = !state.segmentId && !state.messageTemplate

  return (
    <div className="w-96 bg-white border-l border-border flex flex-col h-full">
      <div className="p-5 border-b border-border">
        <h2 className="font-bold text-text-primary flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          Campaign Builder
        </h2>
        <p className="text-xs text-text-muted mt-0.5">Assembles as you chat</p>
      </div>

      <div className="flex-1 p-5 space-y-4 overflow-y-auto">
        {isEmpty ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-text-muted text-sm">Describe your campaign in the chat to get started</p>
          </div>
        ) : (
          <>
            {/* Segment */}
            {state.segmentName && (
              <div className="animate-slide-up">
                <label className="label text-xs">Audience Segment</label>
                <div className="bg-surface border border-border rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm text-text-primary">{state.segmentName}</span>
                  </div>
                  {state.segmentCount !== undefined && (
                    <p className="text-xs text-text-muted">
                      <span className="font-bold text-primary">{state.segmentCount.toLocaleString()}</span> customers match
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Channel */}
            {state.channel && (
              <div className="animate-slide-up">
                <label className="label text-xs">Channel</label>
                <div className="flex gap-2">
                  {['whatsapp', 'sms', 'email', 'rcs'].map((ch) => (
                    <button key={ch} onClick={() => onSetChannel(ch)} className={clsx(
                      'flex-1 py-2 px-3 rounded-lg border text-xs font-medium text-center transition-colors cursor-pointer',
                      state.channel === ch
                        ? 'bg-primary text-white border-primary'
                        : 'border-border text-text-muted hover:bg-surface hover:text-text-primary'
                    )}>
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message */}
            {state.messageTemplate && (
              <div className="animate-slide-up">
                <label className="label text-xs">Message Draft</label>
                <div className="bg-surface border border-border rounded-xl p-3 text-xs text-text-primary font-mono whitespace-pre-wrap">
                  {state.messageTemplate}
                </div>
              </div>
            )}

            {/* Send button */}
            {state.segmentId && state.messageTemplate && (
              <button
                className="btn-primary w-full mt-2 animate-slide-up"
                onClick={onSend}
              >
                <Send className="w-4 h-4" />
                Send to {state.segmentCount?.toLocaleString() ?? '?'} customers
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Chat Page ─────────────────────────────────────────────────────────────

export default function Chat() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const sessionId = params.get('session') || undefined

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [builder, setBuilder]   = useState<CampaignBuilderState>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef  = useRef<AbortController | null>(null)

  const { data: sessions } = useQuery({
    queryKey: ['aiSessions'],
    queryFn: () => api.ai.sessions(),
  })

  const { data: sessionData } = useQuery({
    queryKey: ['chatSession', sessionId],
    queryFn: async () => {
      if (!sessionId) return null
      return await api.ai.getSession(sessionId)
    },
    enabled: !!sessionId,
  })

  useEffect(() => {
    if (sessionData) {
      const parsedMessages = sessionData.messages.map((m: any) => {
        if (m.role === 'assistant' && m.content.includes('<action>')) {
          const { clean, actions } = parseActions(m.content)
          return {
            ...m,
            content: clean,
            actions: actions.length ? actions.map(a => ({ ...a, result: '✓ Processed' })) : m.actions
          }
        }
        return m
      })
      setMessages(parsedMessages)
      setBuilder(sessionData.context || {})
    } else if (!sessionId) {
      setMessages([])
      setBuilder({})
    }
  }, [sessionData, sessionId])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Execute backend actions parsed from AI response ─────────────────────────
  const executeAction = useCallback(async (action: ParsedAction, msgIndex: number, actionIndex: number) => {
    const setLoading = (loading: boolean) => {
      setMessages((prev) => prev.map((m, mi) => mi !== msgIndex ? m : {
        ...m,
        actions: m.actions?.map((a, ai) => ai !== actionIndex ? a : { ...a, loading }),
      }))
    }

    const setResult = (result: string) => {
      setMessages((prev) => prev.map((m, mi) => mi !== msgIndex ? m : {
        ...m,
        actions: m.actions?.map((a, ai) => ai !== actionIndex ? a : { ...a, result, loading: false }),
      }))
    }

    setLoading(true)

    try {
      if (action.type === 'GENERATE_SEGMENT') {
        const prompt = action.payload.prompt as string
        const result = await api.segments.aiGenerate(prompt)
        // Save segment
        const seg = await api.segments.create({ name: result.name, description: result.description, rules: result.rules as SegmentRules })
        setBuilder((b) => ({ ...b, segmentId: seg.id, segmentName: seg.name, segmentCount: result.count, channel: 'whatsapp' }))
        setResult(`Created segment "${seg.name}" — ${result.count.toLocaleString()} customers match`)

        // Inject result into context so AI knows the segment was created
        setMessages((prev) => [...prev, {
          role: 'system',
          content: `Segment "${seg.name}" created with ${result.count.toLocaleString()} matching customers (id: ${seg.id})`,
        }])
      }

      else if (action.type === 'DRAFT_MESSAGE') {
        const brief   = action.payload.brief   as string
        const channel = action.payload.channel as string ?? 'whatsapp'
        const result  = await api.ai.draft(brief, channel)
        const text    = typeof result.message === 'string' ? result.message : JSON.stringify(result.message)
        setBuilder((b) => ({ ...b, messageTemplate: text, channel }))
        setResult(`Message drafted for ${channel}`)
      }

      else if (action.type === 'CREATE_AND_SEND') {
        const { segmentId, messageTemplate, channel, campaignName } = action.payload as {
          segmentId: string; messageTemplate: string; channel: string; campaignName: string
        }
        const c = await api.campaigns.create({
          name: campaignName ?? builder.campaignName ?? 'AI Campaign',
          segmentId: segmentId ?? builder.segmentId,
          channel:   channel   ?? builder.channel ?? 'whatsapp',
          messageTemplate: messageTemplate ?? builder.messageTemplate ?? '',
          status: 'draft',
        })
        const sent = await api.campaigns.send(c.id)
        setResult(`Campaign launched! ${sent.jobCount.toLocaleString()} messages queued 🚀`)
        qc.invalidateQueries({ queryKey: ['campaigns'] })
        toast.success(`Campaign sent to ${sent.jobCount.toLocaleString()} customers!`)
      }
    } catch (err) {
      setResult(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [builder, qc])

  // ── Send message & stream response ──────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return
    setInput('')

    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])

    const assistantMsg: ChatMessage = { role: 'assistant', content: '', isStreaming: true }
    let assistantIdx: number

    setMessages((prev) => {
      assistantIdx = prev.length
      return [...prev, assistantMsg]
    })

    setIsStreaming(true)
    abortRef.current = new AbortController()

    let fullContent = ''

    try {
      const historyForApi = [...messages, userMsg]
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }))

      const res = await api.ai.chatStream(historyForApi, builder, sessionId)
      if (!res.ok) throw new Error('Stream failed')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.sessionId && !sessionId) {
              setParams({ session: data.sessionId }, { replace: true })
            }
            if (data.delta) {
              fullContent += data.delta
              const displayContent = cleanStreamingContent(fullContent)
              setMessages((prev) => prev.map((m, i) =>
                i === assistantIdx! ? { ...m, content: displayContent } : m
              ))
            }
            if (data.done) break
          } catch { /* skip invalid JSON */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        fullContent += '\n\n_Sorry, something went wrong. Please try again._'
      }
    } finally {
      // Parse actions from the full response
      const { clean, actions } = parseActions(fullContent)

      setMessages((prev) => prev.map((m, i) =>
        i === assistantIdx!
          ? { ...m, content: clean, isStreaming: false, actions: actions.length ? actions : undefined }
          : m
      ))

      setIsStreaming(false)

      // Execute actions
      if (actions.length > 0) {
        const currentMsgIdx = assistantIdx!
        for (let ai = 0; ai < actions.length; ai++) {
          await executeAction(actions[ai], currentMsgIdx, ai)
        }
      }
    }
  }, [messages, isStreaming, builder, executeAction])

  function handleCampaignSend() {
    if (!builder.segmentId || !builder.messageTemplate) return
    sendMessage(`Yes, go ahead and send the campaign to ${builder.segmentCount?.toLocaleString() ?? 'the'} customers`)
  }

  function newChat() {
    if (abortRef.current) abortRef.current.abort()
    setMessages([])
    setBuilder({})
    setInput('')
    setParams({}, { replace: true })
    qc.invalidateQueries({ queryKey: ['aiSessions'] })
  }

  return (
    <div className="flex h-full">
      {/* ── History Sidebar ────────────────────────────────────────────── */}
      <div className="w-60 bg-surface/30 border-r border-border flex flex-col h-full">
        <div className="p-4 border-b border-border flex items-center gap-2 bg-white/50">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-text-primary text-sm">Previous Chats</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions?.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setParams({ session: s.id }, { replace: true })
              }}
              className={clsx(
                'w-full text-left px-3 py-2.5 text-xs rounded-lg transition-colors truncate',
                sessionId === s.id
                  ? 'bg-primary text-white font-medium shadow-sm'
                  : 'text-text-primary hover:bg-black/5'
              )}
            >
              Chat from {new Date(s.createdAt).toLocaleDateString()}
            </button>
          ))}
          {sessions?.length === 0 && (
            <p className="text-xs text-text-muted text-center py-8">No history yet</p>
          )}
        </div>
      </div>

      {/* ── Chat area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-text-primary">AI Campaign Assistant</h1>
              <p className="text-xs text-text-muted">Describe what you want — I'll handle the rest</p>
            </div>
          </div>
          <button onClick={newChat} className="btn-ghost text-xs">
            <RotateCcw className="w-3.5 h-3.5" /> New Chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Empty state with starter prompts */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full animate-fade-in">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-2xl flex items-center justify-center mb-5 shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-2">How can I help you today?</h2>
              <p className="text-text-muted text-sm mb-8 text-center max-w-md">
                Describe your campaign idea in plain English — I'll find the right customers, draft the message, and send it for you.
              </p>
              <div className="grid grid-cols-1 gap-3 w-full max-w-lg">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-left p-4 rounded-xl border-2 border-border bg-white hover:border-primary hover:bg-primary-light transition-all duration-150 group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-primary text-lg mt-0.5 flex-shrink-0">✨</span>
                      <p className="text-sm text-text-primary group-hover:text-primary transition-colors leading-snug">
                        {prompt}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-white">
          <div className="flex gap-3">
            <textarea
              className="input flex-1 resize-none min-h-[52px] max-h-40 py-3.5"
              placeholder="Describe your campaign idea… (Ctrl+Enter to send)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  sendMessage(input)
                }
              }}
              disabled={isStreaming}
            />
            <button
              className="btn-primary px-5 self-end"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </button>
          </div>
          <p className="text-xs text-text-muted mt-2 text-center">
            AI can make mistakes. Review campaigns before sending to large audiences.
          </p>
        </div>
      </div>

      {/* ── Campaign Builder Panel ─────────────────────────── */}
      <CampaignBuilderPanel state={builder} onSend={handleCampaignSend} onSetChannel={(ch) => setBuilder((b) => ({ ...b, channel: ch }))} />
    </div>
  )
}
