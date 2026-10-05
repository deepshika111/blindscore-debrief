import { useState } from 'react'
import { callAction, explainActionError } from '@/lib/action'
import { RECS, REC_LABEL, SCORE_WORD, type Recommendation } from '@/types'
import { Button, ConfirmModal, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, useToast } from './ui'

const FIELDS = [
  { id: 'technical', label: 'Technical' },
  { id: 'systemDesign', label: 'System design' },
  { id: 'communication', label: 'Communication' },
] as const

const SCALE = [1, 2, 3, 4] as const

type FieldId = (typeof FIELDS)[number]['id'] | 'recommendation' | 'strengths' | 'concerns'

export function ScorecardForm({ candidateId, onSubmitted }: { candidateId: string; onSubmitted?: () => void }) {
  const { error: toastError } = useToast()
  const [scores, setScores] = useState<Partial<Record<(typeof FIELDS)[number]['id'], number>>>({})
  const [recommendation, setRecommendation] = useState<Recommendation | ''>('')
  const [strengths, setStrengths] = useState('')
  const [concerns, setConcerns] = useState('')
  const [missing, setMissing] = useState<FieldId[]>([])
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  function gaps(): Array<{ id: FieldId; label: string }> {
    const items: Array<{ id: FieldId; label: string }> = []
    for (const field of FIELDS) {
      if (scores[field.id] == null) items.push({ id: field.id, label: field.label })
    }
    if (!recommendation) items.push({ id: 'recommendation', label: 'Recommendation' })
    if (!strengths.trim()) items.push({ id: 'strengths', label: 'Strengths' })
    if (!concerns.trim()) items.push({ id: 'concerns', label: 'Concerns' })
    return items
  }

  function clearMissing(id: FieldId) {
    setMissing((current) => (current.includes(id) ? current.filter((item) => item !== id) : current))
  }

  async function submit() {
    setSaving(true)
    try {
      await callAction('submitScorecard', { candidateId, scores, recommendation, strengths, concerns })
      setConfirm(false)
      onSubmitted?.()
    } catch (error) {
      toastError('Scorecard not submitted', explainActionError(error))
      setConfirm(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        const items = gaps()
        if (items.length > 0) {
          setMissing(items.map((item) => item.id))
          const sentence = items.length === 1 ? `Fill in ${items[0].label}.` : `Fill in ${items.map((item) => item.label).join(', ')}.`
          toastError('Fill the missing item', sentence)
          return
        }
        if (strengths.length > 2000 || concerns.length > 2000) {
          toastError('Scorecard not submitted', 'Strengths and concerns must be 2,000 characters or fewer.')
          return
        }
        setMissing([])
        setConfirm(true)
      }}
    >
      {FIELDS.map((field) => (
        <fieldset key={field.id} className="space-y-2">
          <legend className="text-sm font-medium">{field.label}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SCALE.map((value) => {
              const selected = scores[field.id] === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setScores((current) => ({ ...current, [field.id]: value }))
                    clearMissing(field.id)
                  }}
                  className={`rounded-xl border px-3 py-3 text-left ${
                    selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'
                  }`}
                >
                  <span className="font-display block text-2xl leading-none">{value}</span>
                  <span className={`mt-1 block text-xs ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    {SCORE_WORD[value]}
                  </span>
                </button>
              )
            })}
          </div>
          {missing.includes(field.id) ? <p className="text-sm text-destructive" role="alert">Fill in {field.label}.</p> : null}
        </fieldset>
      ))}

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Recommendation</span>
        <Select
          value={recommendation}
          onValueChange={(value) => {
            setRecommendation(value as Recommendation)
            clearMissing('recommendation')
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {RECS.map((rec) => (
              <SelectItem key={rec} value={rec}>{REC_LABEL[rec]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {missing.includes('recommendation') ? <p className="text-sm text-destructive" role="alert">Fill in Recommendation.</p> : null}
      </label>

      <Note
        label="Strengths"
        value={strengths}
        missing={missing.includes('strengths')}
        onChange={(value) => {
          setStrengths(value)
          if (value.trim()) clearMissing('strengths')
        }}
      />
      <Note
        label="Concerns"
        value={concerns}
        missing={missing.includes('concerns')}
        onChange={(value) => {
          setConcerns(value)
          if (value.trim()) clearMissing('concerns')
        }}
      />

      <Button type="submit" data-testid="seal-scorecard" disabled={saving} loading={saving}>
        Submit scorecard
      </Button>

      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => void submit()}
        title="Submit this scorecard?"
        description="Scorecards are final and stay hidden until reveal."
        confirmText="Submit"
        variant="default"
        loading={saving}
      />
    </form>
  )
}

function Note({
  label,
  value,
  missing,
  onChange,
}: {
  label: string
  value: string
  missing: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-sm font-medium">
        {label}
        <span className="font-normal text-muted-foreground">{value.length} / 1000</span>
      </span>
      <Textarea
        value={value}
        maxLength={1000}
        rows={4}
        aria-invalid={missing}
        onChange={(event) => onChange(event.target.value)}
      />
      {missing ? <p className="text-sm text-destructive" role="alert">Fill in {label}.</p> : null}
    </label>
  )
}
