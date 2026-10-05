import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { DebriefPanel } from '@/components/DebriefPanel'
import { RevealGrid } from '@/components/RevealGrid'
import { ScorecardForm } from '@/components/ScorecardForm'
import { Badge, Button, ConfirmModal, useToast } from '@/components/ui'
import { callAction, explainActionError } from '@/lib/action'
import type { CandidateData, DebriefData, RevealCard, RevealData, ScorecardData, SubmissionData } from '@/types'

export default function CandidateRoomPage() {
  const { id = '' } = useParams()
  return <CandidateRoom candidateId={id} />
}

function CandidateRoom({ candidateId }: { candidateId: string }) {
  const { userId } = useAuth()
  const { records, status } = useQuery<CandidateData>('candidates')
  const { records: submissions } = useQuery<SubmissionData>('submissions', { where: { candidateId } })
  const { records: ownCards } = useQuery<ScorecardData>('scorecards', { where: { candidateId } })
  const { records: reveals } = useQuery<RevealData>('reveals')
  const { records: debriefs } = useQuery<DebriefData>('debriefs')
  const { error: toastError, success } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [debriefBusy, setDebriefBusy] = useState(false)
  const [shell, setShell] = useState<RoomShell | null>(null)
  const [shellReady, setShellReady] = useState(false)
  const shellTicket = useRef(0)

  useEffect(() => {
    let cancelled = false
    let timer = 0
    setShellReady(false)

    async function load() {
      const ticket = ++shellTicket.current
      try {
        const next = await callAction<RoomShell>('roomShell', { candidateId })
        if (!cancelled && ticket === shellTicket.current) setShell(next)
      } catch {
        if (!cancelled && ticket === shellTicket.current) setShell((current) => current)
      } finally {
        if (!cancelled) setShellReady(true)
      }
    }

    void load()
    timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void load()
    }, 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [candidateId])

  const candidate = records.find((record) => record.recordId === candidateId) ?? null
  const reveal = reveals.find((record) => record.recordId === candidateId) ?? null
  const debrief = debriefs.find((record) => record.recordId === candidateId)?.data ?? null
  const revealed = Boolean(reveal) || candidate?.data.status === 'revealed' || shell?.status === 'revealed'
  const own = ownCards.find((card) => card.data.interviewerId === userId) ?? null
  const revealId = reveal?.recordId ?? ''
  const debriefState = debrief?.status ?? ''

  useEffect(() => {
    if (!revealed || debriefState === 'ready' || debriefState === 'pending' || debriefState === 'failed') return
    if (!revealId && shell?.status !== 'revealed') return
    let cancelled = false
    setDebriefBusy(true)
    void callAction('generateDebrief', { candidateId })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setDebriefBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [revealed, revealId, debriefState, candidateId, shell?.status])

  const draft = readDraft(candidateId)
  const data = candidate?.data ?? shellRoom(shell) ?? draftRoom(draft, userId)

  if (!candidateId) {
    return <Missing />
  }
  if (!data && !shellReady) {
    return (
      <div className="mx-auto mt-16 max-w-lg px-6 text-center">
        <div className="h-40 animate-pulse rounded-2xl bg-card" />
        <p className="mt-4 text-sm text-muted-foreground">Opening the room…</p>
      </div>
    )
  }
  if (!data) {
    return <Missing title={status === 'error' ? 'Could not open this room' : undefined} body={status === 'error' ? 'The connection dropped. Reload and try again.' : undefined} />
  }

  const room = data
  const isManager = candidate ? userId === room.hiringManagerId : (shell?.isManager ?? Boolean(draft))
  const submitted = Math.max(submissions.length, shell?.submitted ?? 0)
  const alreadySubmitted = Boolean(own) || Boolean(shell?.mine)
  const invite =
    typeof window === 'undefined' ? '' : `${window.location.origin}/join/${candidateId}?code=${data.inviteCode}`

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invite)
      success('Invite copied')
    } catch {
      toastError('Could not copy', 'Select the link and copy it manually.')
    }
  }

  function showOpened(opened: OpenedRoom) {
    shellTicket.current += 1
    setShell((current) => ({
      name: current?.name ?? room.name,
      role: current?.role ?? room.role,
      status: 'revealed',
      expectedPanelSize: current?.expectedPanelSize ?? room.expectedPanelSize,
      inviteCode: current?.inviteCode ?? room.inviteCode,
      isManager: current?.isManager ?? isManager,
      forceRevealAllowed: current?.forceRevealAllowed,
      submitted: current?.submitted ?? submitted,
      mine: current?.mine ?? alreadySubmitted,
      panelNames: opened.panelNames,
      cards: opened.cards,
      missing: opened.missing,
      reason: opened.reason,
    }))
  }

  async function prepareReveal() {
    setRevealing(true)
    try {
      const next = await callAction<RoomShell>('roomShell', { candidateId })
      shellTicket.current += 1
      setShell(next)
      if (next.status === 'revealed') return
      if (!next.isManager && !next.forceRevealAllowed) {
        toastError('Could not reveal', explainActionError(new Error('reveal_not_allowed')))
        return
      }
      if (next.submitted < 1) {
        toastError('Could not reveal', explainActionError(new Error('no_submissions')))
        return
      }
      setConfirmOpen(true)
    } catch (error) {
      toastError('Could not reveal', explainActionError(error))
    } finally {
      setRevealing(false)
    }
  }

  async function forceReveal() {
    setRevealing(true)
    try {
      const opened = await callAction<OpenedRoom>('forceReveal', { candidateId })
      showOpened(opened)
      setConfirmOpen(false)
    } catch (error) {
      toastError('Could not reveal', explainActionError(error))
    } finally {
      setRevealing(false)
    }
  }

  async function allowForceReveal() {
    setRevealing(true)
    try {
      await callAction('allowForceReveal', { candidateId })
      shellTicket.current += 1
      setShell((current) => (current ? { ...current, forceRevealAllowed: true } : current))
      success('Force reveal allowed')
    } catch (error) {
      toastError('Could not allow force reveal', explainActionError(error))
    } finally {
      setRevealing(false)
    }
  }

  async function generateDebrief() {
    setDebriefBusy(true)
    try {
      await callAction('generateDebrief', { candidateId })
    } catch (error) {
      toastError('Debrief unavailable', explainActionError(error))
    } finally {
      setDebriefBusy(false)
    }
  }

  const cards = asCards(reveal?.data.cards)
  const shownCards = cards.length > 0 ? cards : asCards(shell?.cards)
  const missing = reveal ? asIds(reveal.data.missing) : (shell?.missing ?? [])
  const reason = reveal?.data.reason === 'forced' || shell?.reason === 'forced' ? 'forced' : 'auto'
  const panelNames = { ...(shell?.panelNames ?? {}), ...(data.panelNames ?? {}) }
  const gridReady = Boolean(reveal) || shell?.status === 'revealed'

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <title>{`${data.name} | BlindScore`}</title>
      <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        Dashboard
      </Link>
      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={revealed ? 'success' : 'warning'}>{revealed ? 'Revealed' : 'Scoring'}</Badge>
            {isManager ? <Badge variant="outline">Hiring manager</Badge> : null}
          </div>
          <h1 data-testid="room-title" className="mt-3 font-display text-4xl font-semibold tracking-tight">
            {data.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{data.role}</p>
        </div>
        {isManager ? (
          <div className="w-full max-w-md space-y-2">
            <label className="block text-xs text-muted-foreground" htmlFor="invite-link">
              Invite link
            </label>
            <div className="flex gap-2">
              <input
                id="invite-link"
                data-testid="invite-link"
                readOnly
                value={invite}
                className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-xs"
              />
              <Button type="button" variant="outline" onClick={() => void copyInvite()}>
                Copy
              </Button>
            </div>
            <p className="break-all text-xs text-muted-foreground">{invite}</p>
          </div>
        ) : null}
      </header>

      <p className="mt-6 text-sm text-muted-foreground" data-testid="submission-progress">
        {submitted} / {data.expectedPanelSize} submitted
      </p>

      {revealed && gridReady ? (
        <div className="mt-6 space-y-6">
          <RevealGrid
            cards={shownCards}
            missing={missing}
            panelNames={panelNames}
            reason={reason}
          />
          <DebriefPanel
            debrief={debrief}
            cards={shownCards}
            cardCount={shownCards.length}
            busy={debriefBusy}
            onGenerate={() => void generateDebrief()}
          />
        </div>
      ) : null}

      {revealed && !gridReady ? (
        <p className="mt-6 text-sm text-muted-foreground">Opening the scorecards…</p>
      ) : null}

      {!revealed && alreadySubmitted ? (
        <p className="mt-6 rounded-2xl border border-border bg-card px-5 py-4 text-sm">
          Your scorecard is in. It stays hidden until reveal.
        </p>
      ) : null}

      {!revealed && !alreadySubmitted ? (
        <section className="mt-6 rounded-2xl border border-border bg-card/70 p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Your scorecard</h2>
          <div className="mt-5">
            <ScorecardForm
              candidateId={candidateId}
              onSubmitted={() => setShell((current) => (current ? { ...current, mine: true, submitted: current.submitted + 1 } : current))}
            />
          </div>
        </section>
      ) : null}

      {!revealed ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {isManager && !shell?.forceRevealAllowed ? (
            <Button variant="outline" disabled={revealing} onClick={() => void allowForceReveal()}>
              Allow force reveal to panel members
            </Button>
          ) : null}
          <Button
            variant="outline"
            data-testid="force-reveal"
            disabled={revealing}
            onClick={() => void prepareReveal()}
          >
            Force reveal
          </Button>
          <p className="text-sm text-muted-foreground">
            {isManager
              ? shell?.forceRevealAllowed
                ? 'The panel can force reveal.'
                : 'Interviewers cannot force reveal until you allow it.'
              : shell?.forceRevealAllowed
                ? 'The hiring manager has allowed force reveal.'
                : 'Waiting for the hiring manager to allow force reveal.'}
          </p>
        </div>
      ) : null}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void forceReveal()}
        title="Reveal this room?"
        description="Everyone on the panel will see the scorecards that are in. Missing interviewers stay marked as not submitted."
        confirmText="Reveal"
        variant="default"
        loading={revealing}
      />
    </div>
  )
}

interface OpenedRoom {
  cards: RevealCard[]
  missing: string[]
  reason: 'auto' | 'forced'
  panelNames: Record<string, string>
}

interface RoomShell {
  name: string
  role: string
  status: 'scoring' | 'revealed'
  expectedPanelSize: number
  inviteCode: string
  isManager: boolean
  forceRevealAllowed?: boolean
  submitted: number
  mine: boolean
  cards?: RevealCard[]
  missing?: string[]
  reason?: 'auto' | 'forced'
  panelNames?: Record<string, string>
}

function shellRoom(shell: RoomShell | null): CandidateData | null {
  if (!shell) return null
  return {
    name: shell.name,
    role: shell.role,
    status: shell.status,
    hiringManagerId: shell.isManager ? 'manager' : '',
    expectedPanelSize: shell.expectedPanelSize,
    panel: [],
    panelNames: shell.panelNames ?? {},
    inviteCode: shell.inviteCode,
  }
}

interface RoomDraft {
  name: string
  role: string
  expectedPanelSize: number
  inviteCode: string
}

function readDraft(candidateId: string): RoomDraft | null {
  try {
    const raw = sessionStorage.getItem(`blindscore-draft:${candidateId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RoomDraft>
    if (typeof parsed.name !== 'string' || typeof parsed.expectedPanelSize !== 'number') return null
    return {
      name: parsed.name,
      role: typeof parsed.role === 'string' ? parsed.role : '',
      expectedPanelSize: parsed.expectedPanelSize,
      inviteCode: typeof parsed.inviteCode === 'string' ? parsed.inviteCode : '',
    }
  } catch {
    return null
  }
}

function draftRoom(draft: RoomDraft | null, userId: string | null): CandidateData | null {
  if (!draft || !userId) return null
  return {
    name: draft.name,
    role: draft.role,
    status: 'scoring',
    hiringManagerId: userId,
    expectedPanelSize: draft.expectedPanelSize,
    panel: [userId],
    panelNames: {},
    inviteCode: draft.inviteCode,
  }
}

function Missing({
  title = 'Room not found',
  body = 'This room does not exist, or you are not on the panel.',
}: {
  title?: string
  body?: string
}) {
  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center" data-testid="room-not-found">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
      <Link to="/dashboard" className="mt-6 inline-block text-sm text-primary hover:underline">
        Back to the dashboard
      </Link>
    </div>
  )
}

function asCards(value: unknown): RevealCard[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is RevealCard => {
    if (!entry || typeof entry !== 'object') return false
    const card = entry as Partial<RevealCard>
    return typeof card.interviewerId === 'string' && typeof card.name === 'string' && !!card.scores
  })
}

function asIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}
