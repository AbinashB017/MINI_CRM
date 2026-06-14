import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Sparkles, Loader2, Save } from 'lucide-react'
import { api } from '../lib/api'
import type { SegmentRules } from '../lib/api'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

const FIELDS = [
  { id: 'totalSpend', label: 'Total Spend', type: 'number' },
  { id: 'orderCount', label: 'Total Orders', type: 'number' },
  { id: 'city',       label: 'City',        type: 'string' },
  { id: 'tags',       label: 'Tags',        type: 'array'  },
]

const OPERATORS: Record<string, { id: string; label: string }[]> = {
  number: [
    { id: 'gt',  label: 'Greater than' },
    { id: 'lt',  label: 'Less than' },
    { id: 'gte', label: 'Greater or equal' },
    { id: 'lte', label: 'Less or equal' },
    { id: 'eq',  label: 'Equals' },
  ],
  string: [
    { id: 'eq',       label: 'Equals' },
    { id: 'contains', label: 'Contains' },
    { id: 'in',       label: 'Is one of' },
  ],
  array: [
    { id: 'has',    label: 'Has tag' },
    { id: 'hasAny', label: 'Has any of' },
  ],
}

export default function SegmentNew() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  // ── State ───────────────────────────────────────────────────────────────────
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [operator, setOperator]       = useState<'AND' | 'OR'>('AND')
  const [conditions, setConditions]   = useState<SegmentRules['conditions']>([
    { field: 'totalSpend', operator: 'gt', value: 1000 },
  ])

  // AI State
  const [aiMode, setAiMode]           = useState(false)
  const [aiPrompt, setAiPrompt]       = useState('')
  const [aiResult, setAiResult]       = useState<{ name: string; description: string; rules: SegmentRules; count: number } | null>(null)

  const aiMutation = useMutation({
    mutationFn: api.segments.aiGenerate,
    onSuccess: (data) => {
      setAiResult(data)
      setName(data.name)
      setDescription(data.description)
      setOperator(data.rules.operator)
      setConditions(data.rules.conditions)
    },
  })

  const saveMutation = useMutation({
    mutationFn: api.segments.create,
    onSuccess: () => {
      toast.success('Segment created!')
      qc.invalidateQueries({ queryKey: ['segments'] })
      navigate(`/segments`)
    },
  })

  // ── Actions ─────────────────────────────────────────────────────────────────
  const addCondition = () => {
    setConditions([...conditions, { field: 'totalSpend', operator: 'gt', value: 0 }])
  }
  const removeCondition = (idx: number) => {
    setConditions(conditions.filter((_, i) => i !== idx))
  }
  const updateCondition = (idx: number, field: string, value: any) => {
    const newConds = [...conditions]
    newConds[idx] = { ...newConds[idx], [field]: value }
    if (field === 'field') {
      const type = FIELDS.find((f) => f.id === value)?.type || 'string'
      newConds[idx].operator = OPERATORS[type][0].id
      newConds[idx].value = type === 'number' ? 0 : ''
    }
    setConditions(newConds)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Create Segment</h1>
          <p className="text-text-muted mt-1">Define an audience using rules or let AI build it for you.</p>
        </div>
        <button
          className={clsx('btn-secondary transition-colors', aiMode && 'bg-primary-light text-primary border-primary/30')}
          onClick={() => setAiMode(!aiMode)}
        >
          <Sparkles className="w-4 h-4" />
          {aiMode ? 'Switch to Manual Builder' : 'Build with AI'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {aiMode ? (
            <div className="card space-y-4 animate-slide-up bg-gradient-to-br from-white to-primary-light/30 border-primary/20">
              <div className="flex items-center gap-2 text-primary font-semibold mb-2">
                <Sparkles className="w-5 h-5" /> Describe your audience
              </div>
              <textarea
                className="input min-h-[120px] resize-none text-lg leading-relaxed placeholder:text-gray-300 border-primary/20 focus:border-primary/50 focus:ring-primary/20"
                placeholder="e.g. Find customers in Mumbai who have spent over ₹5000 and have the 'VIP' tag..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                autoFocus
              />
              <button
                className="btn-primary w-full py-3"
                disabled={!aiPrompt.trim() || aiMutation.isPending}
                onClick={() => aiMutation.mutate(aiPrompt)}
              >
                {aiMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                Generate Segment
              </button>

              {aiResult && (
                <div className="mt-6 p-4 bg-white rounded-xl border border-primary/20 animate-fade-in">
                  <div className="text-sm font-semibold text-text-primary mb-1">AI Suggestion</div>
                  <div className="text-xs text-text-muted mb-4">The AI translated your prompt into these rules. You can tweak them below.</div>
                  <div className="flex gap-4">
                    <div className="flex-1 bg-surface p-3 rounded-lg border border-border">
                      <div className="text-xs text-text-muted">Segment Name</div>
                      <div className="font-semibold">{aiResult.name}</div>
                    </div>
                    <div className="flex-1 bg-surface p-3 rounded-lg border border-border">
                      <div className="text-xs text-text-muted">Matching Customers</div>
                      <div className="font-bold text-primary text-lg">{aiResult.count}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card space-y-5 animate-slide-up">
              <div>
                <label className="label">Segment Name</label>
                <input
                  className="input"
                  placeholder="e.g. High-Value Mumbai Shoppers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Description <span className="text-text-muted font-normal">(Optional)</span></label>
                <input
                  className="input"
                  placeholder="What is this segment used for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Rule Builder */}
          <div className="card animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <label className="label mb-0">Rules</label>
              <select className="input py-1 px-2 text-xs w-auto min-h-0 h-8" value={operator} onChange={(e) => setOperator(e.target.value as 'AND' | 'OR')}>
                <option value="AND">Match ALL rules (AND)</option>
                <option value="OR">Match ANY rule (OR)</option>
              </select>
            </div>

            <div className="space-y-3 mb-4">
              {conditions.map((cond, idx) => {
                const fieldType = FIELDS.find((f) => f.id === cond.field)?.type || 'string'
                return (
                  <div key={idx} className="flex gap-2 items-start animate-fade-in">
                    <select className="input flex-1" value={cond.field} onChange={(e) => updateCondition(idx, 'field', e.target.value)}>
                      {FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>

                    <select className="input flex-1" value={cond.operator} onChange={(e) => updateCondition(idx, 'operator', e.target.value)}>
                      {OPERATORS[fieldType].map((op) => <option key={op.id} value={op.id}>{op.label}</option>)}
                    </select>

                    <input
                      type={fieldType === 'number' ? 'number' : 'text'}
                      className="input flex-1"
                      placeholder="Value"
                      value={cond.value as string}
                      onChange={(e) => updateCondition(idx, 'value', fieldType === 'number' ? Number(e.target.value) : e.target.value)}
                    />

                    <button
                      className="p-2.5 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
                      onClick={() => removeCondition(idx)}
                      disabled={conditions.length === 1}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )
              })}
            </div>

            <button className="btn-secondary text-sm py-1.5" onClick={addCondition}>
              <Plus className="w-4 h-4" /> Add Rule
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card sticky top-6">
            <h3 className="font-bold text-text-primary mb-4">Summary</h3>
            <div className="space-y-4 mb-6">
              <div>
                <div className="text-xs text-text-muted mb-1">Name</div>
                <div className="font-medium">{name || <span className="text-gray-300 italic">Not set</span>}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted mb-1">Rules</div>
                <div className="font-medium">{conditions.length} condition{conditions.length !== 1 ? 's' : ''}</div>
              </div>
              {aiResult && (
                <div>
                  <div className="text-xs text-text-muted mb-1">Matching Customers</div>
                  <div className="font-bold text-primary text-xl">{aiResult.count.toLocaleString()}</div>
                </div>
              )}
            </div>

            <button
              className="btn-primary w-full"
              disabled={!name.trim() || conditions.length === 0 || saveMutation.isPending}
              onClick={() => {
                const parsedConditions = conditions.map(c => ({
                  ...c,
                  value: ['in', 'hasAny'].includes(c.operator) && typeof c.value === 'string'
                    ? c.value.split(',').map(s => s.trim()).filter(Boolean)
                    : c.value
                }))
                saveMutation.mutate({ name, description, rules: { operator, conditions: parsedConditions }, aiPrompt })
              }}
            >
              {saveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Save Segment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}