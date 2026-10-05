import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, useMutations, useQuery } from 'deepspace'
import { NewCandidateDialog } from '@/components/NewCandidateDialog'
import { Badge, Button, ConfirmModal, EmptyState, useToast } from '@/components/ui'
import { callAction, explainActionError } from '@/lib/action'
import type { CandidateData, SubmissionData } from '@/types'

export default function DashboardPage() {
  const { userId } = useAuth()
  const { records, status, error } = useQuery<CandidateData>('candidates', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const { records: submissions } = useQuery<SubmissionData>('submissions')
  const { ready } = useMutations('candidates')
  const { error: toastError } = useToast()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<{ id: string; name: string; mode: 'delete' | 'leave' } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [hidden, setHidden] = useState<string[]>([])
  const navigate = useNavigate()
  const visible = records.filter((record) => !hidden.includes(record.recordId))

  async function removeCandidate() {
    if (!pending) return
    setDeleting(true)
    try {
      if (pending.mode === 'delete') {
        await callAction('deleteCandidate', { candidateId: pending.id })
      } else {
        await callAction('leaveRoom', { candidateId: pending.id })
      }
      sessionStorage.removeItem(`blindscore-draft:${pending.id}`)
      setHidden((current) => [...current, pending.id])
      setPending(null)
    } catch (caught) {
      toastError(pending.mode === 'delete' ? 'Could not delete' : 'Could not leave', explainActionError(caught))
    } finally {
      setDeleting(false)
    }
  }

  async function openSample() {
    setSeeding(true)
    try {
      const data = await callAction<{ candidateId: string }>('createDemoRoom', {})
      navigate(`/c/${data.candidateId}`)
    } catch (caught) {
      toastError('Could not open the sample', explainActionError(caught))
      setSeeding(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <title>Rooms | BlindScore</title>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-primary">Blind panel</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            You are on the panel. Share the invite link. Scorecards stay hidden until the room reveals them together.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" data-testid="sample-debrief" onClick={() => void openSample()} loading={seeding}>
            Try a sample debrief
          </Button>
          <Button data-testid="new-candidate" onClick={() => setOpen(true)}>
            New candidate
          </Button>
        </div>
      </div>

      {status === 'loading' ? (
        <div className="mt-10">
          <div className="h-32 animate-pulse rounded-2xl bg-card" />
          <p className="mt-3 text-sm text-muted-foreground">
            {ready ? 'Loading rooms…' : 'Connecting to the room. If this stays here, reload the page.'}
          </p>
        </div>
      ) : null}
      {status === 'error' ? <p className="mt-10 text-sm text-destructive">{error || 'Could not load rooms.'}</p> : null}
      {status === 'ready' && visible.length === 0 ? (
        <EmptyState
          className="mt-8 rounded-2xl border border-dashed border-border"
          title="No rooms yet"
          description="Open a room, set the panel size, and send the invite link."
          action={{ label: 'New candidate', onClick: () => setOpen(true) }}
        />
      ) : null}
      {status === 'ready' && visible.length > 0 ? (
        <ul className="mt-8 grid gap-3">
          {visible.map((record) => {
            const submitted = submissions.filter((row) => row.data.candidateId === record.recordId).length
            const revealed = record.data.status === 'revealed'
            const isManager = record.data.hiringManagerId === userId
            const mine = submissions.some((row) => row.data.candidateId === record.recordId && row.data.interviewerId === userId)
            const canLeave = !isManager && !revealed && !mine
            return (
              <li key={record.recordId} className="relative">
                <Link
                  to={`/c/${record.recordId}`}
                  className="block rounded-2xl border border-border bg-card px-5 py-4 pr-14 transition-colors hover:border-primary/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl font-semibold tracking-tight">{record.data.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{record.data.role}</p>
                    </div>
                    <div className="flex gap-2">
                      {record.data.isDemo === true || record.data.isDemo === 1 ? <Badge variant="outline">Sample</Badge> : null}
                      <Badge variant={revealed ? 'success' : 'warning'}>{revealed ? 'Revealed' : 'Scoring'}</Badge>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {submitted} / {record.data.expectedPanelSize} submitted
                  </p>
                </Link>
                {isManager ? (
                  <button
                    type="button"
                    aria-label={`Delete ${record.data.name}`}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-muted-foreground hover:bg-secondary hover:text-foreground"
                    onClick={() => setPending({ id: record.recordId, name: record.data.name, mode: 'delete' })}
                  >
                    ×
                  </button>
                ) : null}
                {canLeave ? (
                  <button
                    type="button"
                    className="absolute right-3 top-3 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                    onClick={() => setPending({ id: record.recordId, name: record.data.name, mode: 'leave' })}
                  >
                    Leave
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      <ConfirmModal
        open={pending !== null}
        onClose={() => {
          if (!deleting) setPending(null)
        }}
        onConfirm={() => void removeCandidate()}
        title={pending?.mode === 'leave' ? `Leave ${pending.name}?` : `Delete ${pending?.name ?? 'this candidate'}?`}
        description={
          pending?.mode === 'leave'
            ? 'This takes you off the panel. You have not submitted, so no sealed scorecard is removed.'
            : 'This removes the candidate and every scorecard in the room.'
        }
        confirmText={pending?.mode === 'leave' ? 'Leave' : 'Delete'}
        variant="destructive"
        loading={deleting}
      />

      <p className="mt-8 text-sm text-muted-foreground">
        <Link to="/admin/funnel" className="text-primary hover:underline">
          Activation
        </Link>
      </p>

      <NewCandidateDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(candidateId) => {
          setOpen(false)
          navigate(`/c/${candidateId}`)
        }}
      />
    </div>
  )
}
