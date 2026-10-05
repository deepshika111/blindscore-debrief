import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { DebriefPanel } from '@/components/DebriefPanel'
import { RevealGrid } from '@/components/RevealGrid'
import { ScorecardForm } from '@/components/ScorecardForm'
import { Badge, Button, ConfirmModal, useToast } from '@/components/ui'
import { callAction, explainActionError } from '@/lib/action'
import { debriefIcs } from '@/lib/calendar'
import { dueLabel, nudgeText } from '@/lib/due'
import { RUBRICS, type Rubric } from '@/lib/rubrics'
import { inviteMessage, mailtoHref } from '@/lib/invites'
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
  const [askedReveal, setAskedReveal] = useState(false)
  const [debriefBusy, setDebriefBusy] = useState(false)
  const [memberBusy, setMemberBusy] = useState('')
  const [shell, setShell] = useState<RoomShell | null>(null)
  const [savedLinks, setSavedLinks] = useState<SavedLink[]>([])
  const [emailed, setEmailed] = useState<string[]>([])
  const [canShare, setCanShare] = useState(false)
  const [meetingAt, setMeetingAt] = useState('')
  const [meetingMinutes, setMeetingMinutes] = useState('30')
  const [meetingBusy, setMeetingBusy] = useState(false)
  const [dueAt, setDueAt] = useState('')
  const [reminder, setReminder] = useState('')
  const [decisionChoice, setDecisionChoice] = useState<'hire' | 'no_hire' | 'hold'>('hold')
  const [decisionReason, setDecisionReason] = useState('')
  const [decisionBusy, setDecisionBusy] = useState(false)
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

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`blindscore-links:${candidateId}`)
      setSavedLinks(raw ? (JSON.parse(raw) as SavedLink[]) : [])
      const sent = sessionStorage.getItem(`blindscore-emailed:${candidateId}`)
      setEmailed(sent ? (JSON.parse(sent) as string[]) : [])
    } catch {
      setSavedLinks([])
      setEmailed([])
    }
    setCanShare(typeof navigator.share === 'function')
  }, [candidateId])

  const candidate = records.find((record) => record.recordId === candidateId) ?? null
  const reveal = reveals.find((record) => record.recordId === candidateId) ?? null
  const debrief = debriefs.find((record) => record.recordId === candidateId)?.data ?? null
  const revealed = Boolean(reveal) || candidate?.data.status === 'revealed' || shell?.status === 'revealed'
  const own = ownCards.find((card) => card.data.interviewerId === userId) ?? null
  const revealId = reveal?.recordId ?? ''
  const debriefState = debrief?.status ?? ''
  const isManagerEarly = candidate?.data.hiringManagerId === userId || shell?.isManager === true

  useEffect(() => {
    if (!isManagerEarly) return
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
  }, [isManagerEarly, revealed, revealId, debriefState, candidateId, shell?.status])

  useEffect(() => {
    if (debriefState !== 'ready') return
    void callAction('markDebriefViewed', { candidateId }).catch(() => undefined)
  }, [debriefState, candidateId])

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
  const inviteCode = shell?.inviteCode || data.inviteCode
  const invite =
    typeof window === 'undefined' ? '' : `${window.location.origin}/join/${candidateId}?code=${inviteCode}`

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invite)
      success('Invite copied')
    } catch {
      toastError('Could not copy', 'Select the link and copy it manually.')
    }
  }

  function markEmailed(inviteId: string) {
    setEmailed((current) => {
      if (current.includes(inviteId)) return current
      const next = [...current, inviteId]
      sessionStorage.setItem(`blindscore-emailed:${candidateId}`, JSON.stringify(next))
      return next
    })
  }

  function emailNext() {
    const next = (shell?.invites ?? []).find((row) => {
      if (emailed.includes(row.id) || row.status === 'revoked') return false
      return savedLinks.some((saved) => saved.id === row.id)
    })
    const link = savedLinks.find((saved) => saved.id === next?.id)
    if (!next || !link) {
      toastError('Nothing left to email', 'Every saved link is already marked sent.')
      return
    }
    markEmailed(next.id)
    window.location.href = mailtoHref(link.email, room.name, room.role, link.url)
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      success('Invite copied')
    } catch {
      toastError('Could not copy', 'Select the link and copy it manually.')
    }
  }

  async function shareLink(url: string) {
    const message = inviteMessage(room.name, room.role, url)
    try {
      await navigator.share({ title: message.subject, text: message.body, url })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      toastError('Could not share', 'Copy the link instead.')
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

  async function askForceReveal() {
    setRevealing(true)
    try {
      await callAction('requestForceReveal', { candidateId })
      setAskedReveal(true)
      success('Request sent', 'The hiring manager will see your name.')
    } catch (error) {
      toastError('Could not request force reveal', explainActionError(error))
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

  async function refreshShell() {
    const next = await callAction<RoomShell>('roomShell', { candidateId })
    shellTicket.current += 1
    setShell(next)
  }

  async function approve(person: { userId: string; name: string }) {
    setMemberBusy(person.userId)
    try {
      await callAction('approveJoin', { candidateId, userId: person.userId })
      await refreshShell()
      success(`${person.name} is on the panel`)
    } catch (error) {
      toastError('Could not approve', explainActionError(error))
    } finally {
      setMemberBusy('')
    }
  }

  async function deny(person: { userId: string }) {
    setMemberBusy(person.userId)
    try {
      await callAction('denyJoin', { candidateId, userId: person.userId })
      await refreshShell()
    } catch (error) {
      toastError('Could not deny', explainActionError(error))
    } finally {
      setMemberBusy('')
    }
  }

  async function revoke(inviteId: string) {
    setMemberBusy(inviteId)
    try {
      await callAction('revokeInvite', { candidateId, inviteId })
      await refreshShell()
      success('Invite revoked')
    } catch (error) {
      toastError('Could not revoke', explainActionError(error))
    } finally {
      setMemberBusy('')
    }
  }

  async function resend(inviteId: string) {
    setMemberBusy(inviteId)
    try {
      const next = await callAction<{ id: string; label: string; email: string; token: string }>('resendInvite', { candidateId, inviteId })
      const url = `${window.location.origin}/join/${candidateId}?t=${next.token}`
      setSavedLinks((current) => {
        const links = [...current.filter((row) => row.id !== next.id), { id: next.id, label: next.label, email: next.email, url }]
        sessionStorage.setItem(`blindscore-links:${candidateId}`, JSON.stringify(links))
        return links
      })
      setEmailed((current) => {
        const next = current.filter((id) => id !== inviteId)
        sessionStorage.setItem(`blindscore-emailed:${candidateId}`, JSON.stringify(next))
        return next
      })
      success('New link ready', 'The old one no longer works.')
    } catch (error) {
      toastError('Could not replace the link', explainActionError(error))
    } finally {
      setMemberBusy('')
    }
  }

  async function saveDecision() {
    setDecisionBusy(true)
    try {
      await callAction('recordDecision', { candidateId, decision: decisionChoice, reason: decisionReason })
      await refreshShell()
      success('Decision saved')
    } catch (error) {
      toastError('Could not save the decision', explainActionError(error))
    } finally {
      setDecisionBusy(false)
    }
  }

  async function saveDue() {
    const when = new Date(dueAt)
    if (Number.isNaN(when.getTime())) {
      toastError('Could not save the due date', 'Enter a date.')
      return
    }
    setMeetingBusy(true)
    try {
      await callAction('setDue', { candidateId, dueAt: when.toISOString() })
      await refreshShell()
      success('Due date saved')
    } catch (error) {
      toastError('Could not save the due date', explainActionError(error))
    } finally {
      setMeetingBusy(false)
    }
  }

  async function sendEmail(inviteId: string, url: string) {
    const token = new URL(url).searchParams.get('t') ?? ''
    setMemberBusy(inviteId)
    try {
      await callAction('sendInvites', {
        candidateId,
        origin: window.location.origin,
        invites: [{ id: inviteId, token }],
      })
      success('Email sent')
    } catch (error) {
      toastError('Could not send', explainActionError(error))
    } finally {
      setMemberBusy('')
    }
  }

  async function nudge(inviteId: string) {
    setMemberBusy(inviteId)
    try {
      const result = await callAction<{ email: string; label: string }>('nudge', { candidateId, inviteId })
      const text = nudgeText(room.name, room.role, `${window.location.origin}/c/${candidateId}`)
      setReminder(text)
      if (result.email) {
        const href = `mailto:${encodeURIComponent(result.email)}?subject=${encodeURIComponent(`Scores due: ${room.name}`)}&body=${encodeURIComponent(text)}`
        window.location.href = href
        return
      }
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        // The reminder field stays on the page when the clipboard is blocked.
      }
      success('Reminder copied')
    } catch (error) {
      toastError('Could not nudge', explainActionError(error))
    } finally {
      setMemberBusy('')
    }
  }

  async function saveMeeting() {
    const when = new Date(meetingAt)
    if (Number.isNaN(when.getTime())) {
      toastError('Could not save the meeting', 'Enter a date and a duration between 15 and 180 minutes.')
      return
    }
    setMeetingBusy(true)
    try {
      await callAction('setMeeting', { candidateId, meetingAt: when.toISOString(), meetingMinutes: Number(meetingMinutes) })
      await refreshShell()
      success('Debrief time saved')
    } catch (error) {
      toastError('Could not save the meeting', explainActionError(error))
    } finally {
      setMeetingBusy(false)
    }
  }

  function downloadCalendar(at: string, minutes: number, sequence: number) {
    const roomUrl = `${window.location.origin}/c/${candidateId}`
    const file = debriefIcs({
      candidateId,
      candidate: room.name,
      role: room.role,
      meetingAt: at,
      meetingMinutes: minutes,
      sequence,
      roomUrl,
    })
    const blob = new Blob([file], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `debrief-${candidateId}.ics`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function rotateInvite() {
    setMemberBusy('rotate')
    try {
      const next = await callAction<{ inviteCode: string }>('rotateInvite', { candidateId })
      shellTicket.current += 1
      setShell((current) => (current ? { ...current, inviteCode: next.inviteCode } : current))
      success('Invite link replaced', 'The old link no longer works.')
    } catch (error) {
      toastError('Could not replace the link', explainActionError(error))
    } finally {
      setMemberBusy('')
    }
  }

  async function removeMember(person: { userId: string; name: string }) {
    setMemberBusy(person.userId)
    try {
      await callAction('removeMember', { candidateId, userId: person.userId })
      await refreshShell()
      success(`${person.name} was removed`)
    } catch (error) {
      toastError('Could not remove', explainActionError(error))
    } finally {
      setMemberBusy('')
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
          <div className="w-full max-w-md space-y-3">
            <input id="invite-link" data-testid="invite-link" readOnly value={savedLinks[0]?.url ?? ''} className="sr-only" />
            {(shell?.invites ?? []).some((row) => savedLinks.some((saved) => saved.id === row.id)) ? (
              <Button type="button" variant="outline" data-testid="email-next" onClick={emailNext}>
                Email next
              </Button>
            ) : null}
            <ul className="space-y-2">
              {(shell?.invites ?? []).map((row) => {
                const link = savedLinks.find((saved) => saved.id === row.id)
                const message = link ? inviteMessage(room.name, room.role, link.url) : null
                return (
                  <li key={row.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                    <p className="font-medium">{row.label}</p>
                    <p className="text-muted-foreground">{inviteStatus(row)}{emailed.includes(row.id) ? ' · Emailed' : ''}</p>
                    {link ? <p className="mt-1 break-all text-xs text-muted-foreground">{link.url}</p> : null}
                    {link && message ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a
                          data-testid="invite-email"
                          className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs"
                          href={mailtoHref(link.email, room.name, room.role, link.url)}
                          onClick={() => markEmailed(row.id)}
                        >
                          Email
                        </a>
                        <Button type="button" variant="outline" onClick={() => void copyLink(link.url)}>
                          Copy
                        </Button>
                        {link.email ? (
                          <Button type="button" variant="outline" disabled={memberBusy === row.id} onClick={() => void sendEmail(row.id, link.url)}>
                            Send
                          </Button>
                        ) : null}
                        {canShare ? (
                          <Button type="button" variant="outline" onClick={() => void shareLink(link.url)}>
                            Share
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    {!revealed ? (
                      <div className="mt-2 flex gap-2">
                        <Button type="button" variant="outline" disabled={memberBusy === row.id} onClick={() => void resend(row.id)}>
                          New link
                        </Button>
                        <Button type="button" variant="outline" disabled={memberBusy === row.id} onClick={() => void revoke(row.id)}>
                          Revoke
                        </Button>
                        {row.status !== 'revoked' ? (
                          <Button type="button" variant="outline" disabled={memberBusy === row.id} onClick={() => void nudge(row.id)}>
                            Nudge
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            {reminder ? (
              <label className="block space-y-1 text-xs text-muted-foreground">
                Reminder
                <input data-testid="nudge-text" readOnly value={reminder} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-xs text-foreground" />
              </label>
            ) : null}
            {shell?.allowOpenLink ? (
              <div className="space-y-2">
                <label className="block text-xs text-muted-foreground" htmlFor="open-invite-link">Open link</label>
                <div className="flex gap-2">
                  <input id="open-invite-link" data-testid="open-invite-link" readOnly value={invite} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-xs" />
                  <Button type="button" variant="outline" onClick={() => void copyInvite()}>Copy</Button>
                  <Button type="button" variant="outline" disabled={memberBusy === 'rotate'} onClick={() => void rotateInvite()}>New invite link</Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      {shell?.dueAt ? (
        <p className="mt-4 text-sm text-muted-foreground" data-testid="due-label">{dueLabel(shell.dueAt, Date.now())}</p>
      ) : null}

      {isManager && !revealed ? (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="block space-y-1 text-xs text-muted-foreground">
            Scores due
            <input
              data-testid="due-at"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className="block h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            />
          </label>
          <Button type="button" disabled={meetingBusy} onClick={() => void saveDue()}>Save due date</Button>
        </div>
      ) : null}

      {shell?.meetingAt || (isManager && !revealed) ? (
        <section className="mt-6 rounded-xl border border-border px-4 py-3">
          <h2 className="text-sm font-medium">Debrief meeting</h2>
          {isManager && !revealed ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="block space-y-1 text-xs text-muted-foreground">
                When
                <input
                  data-testid="meeting-at"
                  type="datetime-local"
                  value={meetingAt}
                  onChange={(event) => setMeetingAt(event.target.value)}
                  className="block h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
                />
              </label>
              <label className="block space-y-1 text-xs text-muted-foreground">
                Minutes
                <input
                  data-testid="meeting-minutes"
                  type="number"
                  min={15}
                  max={180}
                  value={meetingMinutes}
                  onChange={(event) => setMeetingMinutes(event.target.value)}
                  className="block h-10 w-24 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
                />
              </label>
              <Button type="button" disabled={meetingBusy} onClick={() => void saveMeeting()}>Save time</Button>
            </div>
          ) : null}
          {shell?.meetingAt ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <p className="text-muted-foreground">{new Date(shell.meetingAt).toLocaleString()} · {shell.meetingMinutes} min</p>
              <Button
                type="button"
                variant="outline"
                data-testid="add-calendar"
                onClick={() => downloadCalendar(shell.meetingAt ?? '', shell.meetingMinutes ?? 30, shell.meetingSequence ?? 0)}
              >
                Add to calendar
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {isManager && (shell?.pending?.length ?? 0) > 0 ? (
        <ul className="mt-6 space-y-2">
          {shell?.pending?.map((person) => (
            <li key={person.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
              <p className="text-sm">{person.name} wants to join</p>
              <div className="flex gap-2">
                <Button disabled={memberBusy === person.userId} onClick={() => void approve(person)}>
                  Approve {person.name}
                </Button>
                <Button variant="outline" disabled={memberBusy === person.userId} onClick={() => void deny(person)}>
                  Deny
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {isManager && !revealed && (shell?.roster?.length ?? 0) > 0 ? (
        <ul className="mt-4 space-y-2">
          {shell?.roster?.map((person) => (
            <li key={person.userId} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>{person.name}{person.submitted ? ' · submitted' : ''}</span>
              <Button variant="outline" disabled={memberBusy === person.userId} onClick={() => void removeMember(person)}>
                Remove {person.name}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {revealed && shell?.decision ? (
        <section data-testid="decision" className="mt-6 rounded-2xl border border-border bg-card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Decision</p>
          <p className="font-display mt-1 text-3xl font-semibold">{decisionLabel(shell.decision.decision)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{shell.decision.reason}</p>
        </section>
      ) : null}

      {revealed && isManager && !shell?.decision ? (
        <section className="mt-6 rounded-2xl border border-border px-5 py-4">
          <h2 className="text-sm font-medium">Decision</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['hire', 'no_hire', 'hold'] as const).map((choice) => (
              <Button key={choice} type="button" variant={decisionChoice === choice ? 'default' : 'outline'} onClick={() => setDecisionChoice(choice)}>
                {decisionLabel(choice)}
              </Button>
            ))}
          </div>
          <label className="mt-3 block space-y-1 text-xs text-muted-foreground">
            Reason
            <textarea
              value={decisionReason}
              maxLength={280}
              onChange={(event) => setDecisionReason(event.target.value)}
              className="block min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            />
          </label>
          <Button className="mt-3" type="button" disabled={decisionBusy} onClick={() => void saveDecision()}>Save decision</Button>
        </section>
      ) : null}

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
            metrics={shell?.rubric?.metrics ?? RUBRICS.swe.metrics}
          />
          <DebriefPanel
            debrief={debrief}
            cards={shownCards}
            cardCount={shownCards.length}
            busy={debriefBusy}
            canRetry={isManager}
            rubric={shell?.rubric ?? RUBRICS.swe}
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
              metrics={shell?.rubric?.metrics ?? RUBRICS.swe.metrics}
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
          {!isManager && !shell?.forceRevealAllowed ? (
            <Button variant="outline" disabled={revealing} onClick={() => void askForceReveal()}>
              Request force reveal
            </Button>
          ) : (
            <Button
              variant="outline"
              data-testid="force-reveal"
              disabled={revealing}
              onClick={() => void prepareReveal()}
            >
              Force reveal
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            {isManager
              ? requestLine(shell?.revealRequestNames ?? [])
                ?? (shell?.forceRevealAllowed
                  ? 'The panel can force reveal.'
                  : 'Interviewers cannot force reveal until you allow it.')
              : askedReveal
                ? 'You asked the hiring manager to allow force reveal.'
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

interface SavedLink {
  id: string
  label: string
  email: string
  url: string
}

function decisionLabel(value: string): string {
  if (value === 'hire') return 'Hire'
  if (value === 'no_hire') return 'No hire'
  return 'Hold'
}

function inviteStatus(row: { status: string; name: string }): string {
  if (row.status === 'revoked') return 'Revoked'
  if (row.status === 'claimed') return `Joined as ${row.name || 'panelist'}`
  return 'Not opened'
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
  revealRequestNames?: string[]
  submitted: number
  mine: boolean
  submittedNames?: string[]
  pending?: Array<{ userId: string; name: string }>
  roster?: Array<{ userId: string; name: string; submitted: boolean }>
  allowOpenLink?: boolean
  meetingAt?: string
  meetingMinutes?: number
  meetingSequence?: number
  rubric?: Rubric
  dueAt?: string
  decision?: { decision: string; reason: string } | null
  invites?: Array<{ id: string; label: string; email: string; status: string; name: string }>
  cards?: RevealCard[]
  missing?: string[]
  reason?: 'auto' | 'forced'
  panelNames?: Record<string, string>
}

function requestLine(names: string[]): string | null {
  const asked = names.filter((name) => name.trim().length > 0)
  if (asked.length === 0) return null
  if (asked.length === 1) return `${asked[0]} is requesting force reveal.`
  return `${asked.join(', ')} are requesting force reveal.`
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
