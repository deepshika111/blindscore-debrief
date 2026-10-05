import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { callAction, explainActionError } from '@/lib/action'

const LABELS: Record<string, string> = {
  room_created: 'Room created',
  invite_created: 'Invite created',
  invite_opened: 'Invite opened',
  invite_claimed: 'Invite claimed',
  panel_joined: 'Joined',
  scorecard_submitted: 'Scorecard submitted',
  room_revealed: 'Revealed',
  debrief_viewed: 'Debrief viewed',
}

interface Step {
  step: string
  count: number
  toNext: number
}

export default function FunnelPage() {
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [demoFirst, setDemoFirst] = useState(0)
  const [capped, setCapped] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void callAction<{ steps: Step[]; demoFirst: number; capped: boolean }>('funnelReport', {})
      .then((data) => {
        if (cancelled) return
        setSteps(data.steps)
        setDemoFirst(data.demoFirst)
        setCapped(data.capped)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(explainActionError(caught))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <title>Activation | BlindScore</title>
      <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        Dashboard
      </Link>
      <h1 className="font-display mt-4 text-4xl font-semibold tracking-tight">Activation</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Each count is rooms that reached that step. The percentage is how many of those rooms reached the next step. Sample rooms are not in these rows. The demo line is people who opened the sample and later created a real room.
      </p>
      {error ? <p className="mt-8 text-sm text-muted-foreground">{error === 'You are not allowed to do that.' ? 'Activation numbers are visible to the app owner.' : error}</p> : null}
      {!steps && !error ? <p className="mt-8 text-sm text-muted-foreground">Loading the funnel…</p> : null}
      {steps ? (
        <>
          <table className="mt-8 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 font-medium">Step</th>
                <th className="py-2 font-medium">Rooms</th>
                <th className="py-2 font-medium">Reached the next step</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step) => (
                <tr key={step.step} className="border-b border-border">
                  <td className="py-3">{LABELS[step.step] ?? step.step}</td>
                  <td className="py-3 tabular-nums">{step.count}</td>
                  <td className="py-3 tabular-nums">{step.step === 'debrief_viewed' ? '—' : `${step.toNext}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-sm text-muted-foreground">People who opened the sample first, then created a room: {demoFirst}.</p>
        </>
      ) : null}
      {capped ? <p className="mt-4 text-xs text-muted-foreground">Showing the latest 500 events.</p> : null}
    </div>
  )
}
