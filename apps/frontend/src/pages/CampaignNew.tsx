import { useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Loader2, ChevronRight, ChevronLeft, Send, Save } from 'lucide-react'
import { api } from '../lib/api'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp',   icon: '💬', limit: 300,  desc: 'Conversational, high open rate' },
  { id: 'sms',      label: 'SMS',        icon: '📱', limit: 160,  desc: 'Universal reach, no app needed' },
  { id: 'email',    label: 'Email',      icon: '✉️',  limit: 1500, desc: 'Rich content, detailed updates' },
  { id: 'rcs',      label: 'RCS',        icon: '🔵', limit: 300,  desc: 'Rich messaging for Android' },
]

const MERGE_TAGS = ['{{firstName}}', '{{city}}', '{{totalSpend}}', '{{orderCount}}']

const STEPS = ['Name & Channel', 'Audience', 'Message', 'Preview & Send']

export default function CampaignNew() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [step, setStep]     = useState(0)
  const [name, setName]     = useState('')
  const [channel, setChannel] = useState('whatsapp')
  const [segmentId, setSegmentId] = useState(params.get('segmentId') ?? '')
  const [message, setMessage] = useState('')
  const [aiModal, setAiModal]   = useState(false)
  const [aiBrief, setAiBrief]   = useState('')

  const { data: segments } = useQuery({ queryKey: ['segments'], queryFn: api.segments.list })
  const selectedSeg = segments?.find((s) => s.id === segmentId)
  const channelInfo  = CHANNELS.find((c) => c.id === channel)!

  const aiDraftMutation = useMutation({
    mutationFn: () => api.ai.draft(aiBrief, channel),
    onSuccess: (data) => {
      const text = typeof data.message === 'string' ? data.message : JSON.stringify(data.message)
      setMessage(text)
      setAiModal(false)
      toast.success('Message drafted!')
    },
  })

  const createMutation = useMutation({
    mutationFn: (send: boolean) =>
      api.campaigns.create({
        name,
        channel,
        segmentId: segmentId || undefined,
        messageTemplate: message,
        status: 'draft',
      }).then(async (c) => {
        if (send) await api.campaigns.send(c.id)
        return c
      }),
    onSuccess: (c, send) => {
      toast.success(send ? 'Campaign launched! 🚀' : 'Saved as draft')
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      navigate(`/campaigns/${c.id}`)
    },
  })

  function insertMergeTag(tag: string) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const newVal = message.slice(0, start) + tag + message.slice(end)
    setMessage(newVal)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + tag.length, start + tag.length) }, 0)
  }

  const personalise = (tpl: string) => {
    if (!selectedSeg) return tpl
    return tpl
      .replace(/\{\{firstName\}\}/g, 'Rahul')
      .replace(/\{\{city\}\}/g,      selectedSeg ? 'Mumbai' : 'your city')
      .replace(/\{\{totalSpend\}\}/g, '₹12,450')
      .replace(/\{\{orderCount\}\}/g, '7')
  }

  function canNext() {
    if (step === 0) return name.trim().length > 0
    if (step === 1) return true
    if (step === 2) return message.trim().length > 0
    return true
  }

  return (
    <div className="p-6 max-w-2xl animate-fade-in">
      <h1 className="text-2xl font-bold text-text-primary mb-2">New Campaign</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                i < step  ? 'bg-primary text-white' :
                i === step ? 'bg-primary text-white ring-4 ring-primary/20' :
                             'bg-gray-100 text-text-muted'
              )}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={clsx('text-xs font-medium hidden sm:block', i === step ? 'text-primary' : 'text-text-muted')}>
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className={clsx('w-8 h-0.5 mx-2', i < step ? 'bg-primary' : 'bg-gray-200')} />}
          </div>
        ))}
      </div>

      {/* ── Step 0: Name + Channel ── */}
      {step === 0 && (
        <div className="card space-y-5 animate-slide-up">
          <div>
            <label className="label">Campaign Name</label>
            <input className="input" placeholder="e.g. Monsoon Madness Sale" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Channel</label>
            <div className="grid grid-cols-2 gap-3">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setChannel(ch.id)}
                  className={clsx(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    channel === ch.id
                      ? 'border-primary bg-primary-light'
                      : 'border-border bg-white hover:border-primary/30'
                  )}
                >
                  <div className="text-2xl mb-2">{ch.icon}</div>
                  <div className="font-semibold text-sm text-text-primary">{ch.label}</div>
                  <div className="text-xs text-text-muted mt-0.5">{ch.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 1: Audience ── */}
      {step === 1 && (
        <div className="card space-y-4 animate-slide-up">
          <div>
            <label className="label">Choose Audience Segment</label>
            <select className="input" value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              <option value="">— All Customers —</option>
              {segments?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.count.toLocaleString()} customers)
                </option>
              ))}
            </select>
          </div>
          {selectedSeg && (
            <div className="bg-primary-light rounded-xl p-4 animate-slide-up">
              <p className="text-sm font-semibold text-primary mb-1">{selectedSeg.name}</p>
              <p className="text-xs text-text-muted mb-2">{selectedSeg.description}</p>
              <p className="text-lg font-bold text-primary">{selectedSeg.count.toLocaleString()} <span className="text-sm font-normal text-text-muted">customers will receive this campaign</span></p>
            </div>
          )}
          {!segmentId && (
            <p className="text-sm text-text-muted bg-surface rounded-xl p-4">
              📣 No segment selected — campaign will be sent to <strong>all customers</strong>
            </p>
          )}
        </div>
      )}

      {/* ── Step 2: Message ── */}
      {step === 2 && (
        <div className="card space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <label className="label mb-0">Message</label>
            <button
              type="button"
              className="btn-primary py-1.5 text-xs"
              onClick={() => setAiModal(true)}
            >
              <Sparkles className="w-3.5 h-3.5" /> Draft with AI ✨
            </button>
          </div>

          <div className="relative">
            <textarea
              ref={textareaRef}
              className="input min-h-[140px] resize-none font-mono text-sm"
              placeholder={`Write your ${channel} message here…`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className={clsx(
              'absolute bottom-3 right-3 text-xs font-medium tabular-nums',
              message.length > channelInfo.limit ? 'text-red-500' : 'text-text-muted'
            )}>
              {message.length}/{channelInfo.limit}
            </div>
          </div>

          <div>
            <p className="text-xs text-text-muted mb-2 font-medium">Insert personalisation tag:</p>
            <div className="flex gap-2 flex-wrap">
              {MERGE_TAGS.map((t) => (
                <button key={t} type="button" onClick={() => insertMergeTag(t)}
                  className="font-mono text-xs bg-primary-light text-primary px-2.5 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-colors">
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === 3 && (
        <div className="card space-y-5 animate-slide-up">
          <div>
            <p className="text-sm font-semibold text-text-primary mb-1">Message Preview</p>
            <p className="text-xs text-text-muted mb-3">Personalised for sample customer: Rahul · Mumbai · 7 orders</p>
            <div className="bg-gray-50 border border-border rounded-xl p-4 font-mono text-sm text-text-primary whitespace-pre-wrap">
              {personalise(message)}
            </div>
          </div>

          <div className="bg-surface rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">Campaign</span><span className="font-medium">{name}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Channel</span><span className="font-medium">{channelInfo.icon} {channel}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Audience</span><span className="font-medium">{selectedSeg?.name ?? 'All Customers'}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Recipients</span><span className="font-bold text-primary">{(selectedSeg?.count ?? 0).toLocaleString()}</span></div>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => createMutation.mutate(false)} disabled={createMutation.isPending}>
              <Save className="w-4 h-4" /> Save Draft
            </button>
            <button className="btn-primary flex-1" onClick={() => createMutation.mutate(true)} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Now
            </button>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between mt-5">
        {step > 0 ? (
          <button className="btn-secondary" onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        ) : <div />}
        {step < STEPS.length - 1 && (
          <button className="btn-primary" onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* AI Draft Modal */}
      {aiModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setAiModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-text-primary mb-4">✨ Draft with AI</h3>
            <textarea
              className="input min-h-[100px] resize-none mb-4"
              placeholder="Describe the message you want, e.g. 'A win-back offer with 15% discount for customers who haven't ordered in 2 months'"
              value={aiBrief}
              onChange={(e) => setAiBrief(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setAiModal(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={() => aiDraftMutation.mutate()} disabled={!aiBrief.trim() || aiDraftMutation.isPending}>
                {aiDraftMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}