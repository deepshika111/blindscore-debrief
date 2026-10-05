import { useEffect, useState } from 'react'
import { callAction, explainActionError } from '@/lib/action'
import { calibrationSentence, type Calibration } from '@/lib/calibration'

export default function CalibrationPage() {
  const [report, setReport] = useState<Calibration | null>(null)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    let cancelled = false
    void callAction<Calibration>('myCalibration', {})
      .then((next) => {
        if (!cancelled) setReport(next)
      })
      .catch((error: unknown) => {
        if (!cancelled) setProblem(explainActionError(error))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight">My calibration</h1>
      {problem ? <p className="mt-4 text-sm text-destructive">{problem}</p> : null}
      <p className="mt-3 text-sm text-muted-foreground">
        These are your scores compared with the rest of each panel. Nobody else sees this page.
      </p>
      {report && !report.ready ? (
        <p className="mt-8 text-sm" data-testid="calibration-status">Score three revealed rooms to see your calibration.</p>
      ) : null}
      {report?.ready ? (
        <ul className="mt-8 space-y-5" data-testid="calibration-status">
          {report.lines.map((line) => (
            <li key={line.key}>
              <p className="text-sm">{calibrationSentence(line.label, line.delta)}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, Math.max(8, Math.abs(line.delta) * 24))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
