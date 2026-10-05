import { RUBRICS, type Metric } from '@/lib/rubrics'
import { metricSplit, panelVote } from '@/lib/stats'
import { REC_LABEL, type RevealCard } from '@/types'

export function RevealGrid({
  cards,
  missing,
  panelNames,
  reason,
  metrics = RUBRICS.swe.metrics,
}: {
  cards: RevealCard[]
  missing: string[]
  panelNames: Record<string, string>
  reason: 'auto' | 'forced'
  metrics?: readonly Metric[]
}) {
  const vote = panelVote(cards)

  return (
    <div className="space-y-4">
      {reason === 'forced' ? (
        <p className="text-sm text-muted-foreground">Force-revealed by HM</p>
      ) : null}

      {cards.length > 0 ? (
        <section className="grid gap-6 rounded-2xl border border-border bg-card/70 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-6">
          <AgreementChart yes={vote.yes} no={vote.no} />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Overall</p>
            <p className="font-display mt-1 text-5xl font-semibold tracking-tight">{vote.verdict}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              {vote.yes} agreed yes. {vote.no} disagreed.
            </p>
          </div>
        </section>
      ) : null}

      {cards.length > 0 ? (
        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Each metric</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {metrics.map((metric) => (
              <MetricChart key={metric.key} label={metric.label} scores={cards.map((card) => card.scores[metric.key] ?? 0)} />
            ))}
          </div>
        </section>
      ) : null}

      {cards.length > 0 ? (
        <section>
          <h2 className="font-display text-2xl font-semibold tracking-tight">What changed the read</h2>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
            {cards.map((card) => {
              const note = valuableNote(card)
              return (
                <li key={card.interviewerId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <div>
                    <p className="font-medium">{card.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="text-foreground">{note.label}. </span>
                      {note.text}
                    </p>
                  </div>
                  <p className="text-sm">{REC_LABEL[card.recommendation]}</p>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {missing.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Not submitted: {missing.map((id) => panelNames[id] || 'Interviewer').join(', ')}
        </p>
      ) : null}

      {cards.length === 0 && missing.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scorecards were in.</p>
      ) : null}
    </div>
  )
}

function AgreementChart({ yes, no, caption = 'votes' }: { yes: number; no: number; caption?: string }) {
  const total = Math.max(yes + no, 1)
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const yesArc = (yes / total) * circumference
  const noArc = (no / total) * circumference

  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full" role="img" aria-label={`${yes} agreed, ${no} disagreed`}>
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="12" className="stroke-secondary" />
        {yes > 0 ? (
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="12"
            strokeDasharray={`${yesArc} ${circumference - yesArc}`}
            className="stroke-primary"
            transform="rotate(-90 60 60)"
          />
        ) : null}
        {no > 0 ? (
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="12"
            strokeDasharray={`${noArc} ${circumference - noArc}`}
            strokeDashoffset={-yesArc}
            className="stroke-destructive"
            transform="rotate(-90 60 60)"
          />
        ) : null}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold leading-none">{yes + no}</span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{caption}</span>
      </div>
    </div>
  )
}

function MetricChart({ label, scores }: { label: string; scores: number[] }) {
  const split = metricSplit(scores)
  return (
    <figure className="flex flex-col items-center rounded-2xl border border-border px-5 py-6 text-center">
      <figcaption className="font-display text-xl font-semibold">{label}</figcaption>
      <div className="mt-4">
        <AgreementChart yes={split.agreed} no={split.disagreed} caption="total" />
      </div>
      <p className="mt-4 text-sm">Agreed {split.agreedPercent}%</p>
      <p className="text-sm text-muted-foreground">Disagreed {split.disagreedPercent}%</p>
    </figure>
  )
}

function valuableNote(card: RevealCard): { label: string; text: string } {
  const yes = card.recommendation === 'lean_yes' || card.recommendation === 'strong_yes'
  const concern = card.concerns.trim()
  const strength = card.strengths.trim()
  if (yes && concern) return { label: 'Concern', text: concern }
  if (!yes && strength) return { label: 'Strength', text: strength }
  if (concern) return { label: 'Concern', text: concern }
  return { label: 'Strength', text: strength || 'None written' }
}
