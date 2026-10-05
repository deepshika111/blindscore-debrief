import { DIM_LABEL, DIMS, discussFirst, type Dim } from '@/lib/stats'
import type { DebriefData, RevealCard } from '@/types'
import { Button } from './ui'

export function DebriefPanel({
  debrief,
  cards,
  cardCount,
  busy,
  canRetry,
  onGenerate,
}: {
  debrief: DebriefData | null
  cards: RevealCard[]
  cardCount: number
  busy: boolean
  canRetry: boolean
  onGenerate: () => void
}) {
  const status = debrief?.status
  const first = discussFirst(cards)
  const attempts = debrief?.attempts ?? 0

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-5 sm:p-6">
      <h2 className="font-display text-2xl font-semibold tracking-tight">Debrief</h2>
      {first.length > 0 ? (
        <div className="mt-4" data-testid="discuss-first">
          <h3 className="text-sm font-medium">Discuss first</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {first.map((dim) => (
              <li key={dim}>{DIM_LABEL[dim]}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!debrief ? (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            {canRetry
              ? 'The score grid is complete. The written debrief has not been generated.'
              : 'The hiring manager can generate the written debrief.'}
          </p>
          {canRetry ? (
            <Button className="mt-3" onClick={onGenerate} disabled={busy} loading={busy}>
              Generate debrief
            </Button>
          ) : null}
        </div>
      ) : null}

      {status === 'pending' ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
          <div className="h-4 w-full animate-pulse rounded bg-secondary" />
          <p className="text-sm text-muted-foreground">Analyzing {cardCount} scorecards…</p>
        </div>
      ) : null}

      {status === 'failed' ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-destructive">AI summary unavailable</p>
          {canRetry && attempts < 5 ? (
            <Button variant="outline" onClick={onGenerate} disabled={busy} loading={busy}>
              Retry
            </Button>
          ) : null}
          {canRetry && attempts >= 5 ? <p className="text-sm text-muted-foreground">Retries are used up.</p> : null}
        </div>
      ) : null}

      {status === 'ready' && debrief ? (
        <div className="mt-4 space-y-5">
          <Scores cards={cards} />
          <Block title="Consensus" items={noteConsensus(debrief.summary?.consensus ?? [])} />
          <div>
            <h3 className="text-sm font-medium">Divergences</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {(debrief.summary?.divergences ?? []).map((item) => (
                <li key={`${item.dim}-${item.note}`}>
                  <span className="text-foreground">{label(item.dim)}. </span>
                  {item.note}
                </li>
              ))}
            </ul>
          </div>
          <Block title="Discussion questions" items={debrief.summary?.questions ?? []} />
        </div>
      ) : null}
    </section>
  )
}

function Scores({ cards }: { cards: RevealCard[] }) {
  if (cards.length === 0) return null
  return (
    <div>
      <h3 className="text-sm font-medium">Scores</h3>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
        {DIMS.map((dim) => (
          <li key={dim} className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
            <span>{DIM_LABEL[dim]}</span>
            <span className="font-display text-xl font-semibold tabular-nums">{scoreText(cards, dim)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function scoreText(cards: RevealCard[], dim: Dim): string {
  const first = cards[0]?.scores[dim]
  if (cards.every((card) => card.scores[dim] === first)) return String(first)
  return cards.map((card) => `${card.name} ${card.scores[dim]}`).join(', ')
}

/** The app prints the numbers. Drop model lines that only restate them. */
function noteConsensus(items: string[]): string[] {
  return items.filter((item) => !/rated\s+[1-4]/i.test(item))
}

function Block({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function label(dim: string): string {
  return dim in DIM_LABEL ? DIM_LABEL[dim as Dim] : dim
}
