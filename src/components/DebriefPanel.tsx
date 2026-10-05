import { DIM_LABEL, type Dim } from '@/lib/stats'
import type { DebriefData } from '@/types'
import { Button } from './ui'

export function DebriefPanel({
  debrief,
  cardCount,
  busy,
  onGenerate,
}: {
  debrief: DebriefData | null
  cardCount: number
  busy: boolean
  onGenerate: () => void
}) {
  const status = debrief?.status

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-5 sm:p-6">
      <h2 className="font-display text-2xl font-semibold tracking-tight">Debrief</h2>

      {!debrief ? (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">The score grid is complete. The written debrief has not been generated.</p>
          <Button className="mt-3" onClick={onGenerate} disabled={busy} loading={busy}>
            Generate debrief
          </Button>
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
          <Button variant="outline" onClick={onGenerate} disabled={busy} loading={busy}>
            Retry
          </Button>
        </div>
      ) : null}

      {status === 'ready' && debrief ? (
        <div className="mt-4 space-y-5">
          <Block title="Consensus" items={debrief.summary?.consensus ?? []} />
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

function Block({ title, items }: { title: string; items: string[] }) {
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
