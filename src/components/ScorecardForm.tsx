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

export function ScorecardForm({ candidateId, onSubmitted }: { candidateId: string; onSubmitted?: () => void }) {
  const { error: toastError } = useToast()
  const [scores, setScores] = useState<Partial<Record<(typeof FIELDS)[number]['id'], number>>>({})
  const [recommendation, setRecommendation] = useState<Recommendation | ''>('')
  const [strengths, setStrengths] = useState('')
  const [concerns, setConcerns] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  const complete =
    FIELDS.every((field) => scores[field.id] != null) &&
    recommendation !== '' &&
    strengths.trim().length > 0 &&
    concerns.trim().length > 0 &&
    strengths.length <= 2000 &&
    concerns.length <= 2000

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
        if (complete) setConfirm(true)
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
                  onClick={() => setScores((current) => ({ ...current, [field.id]: value }))}
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
        </fieldset>
      ))}

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Recommendation</span>
        <Select value={recommendation} onValueChange={(value) => setRecommendation(value as Recommendation)}>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {RECS.map((rec) => (
              <SelectItem key={rec} value={rec}>{REC_LABEL[rec]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <Note label="Strengths" value={strengths} onChange={setStrengths} />
      <Note label="Concerns" value={concerns} onChange={setConcerns} />

      <Button type="submit" data-testid="seal-scorecard" disabled={!complete || saving}>
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

function Note({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-sm font-medium">
        {label}
        <span className="font-normal text-muted-foreground">{value.length} / 2000</span>
      </span>
      <Textarea value={value} maxLength={2000} rows={4} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
