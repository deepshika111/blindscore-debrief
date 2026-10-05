import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuthUser } from 'deepspace'
import { callAction, explainActionError } from '@/lib/action'
import { Button, Input, useToast } from '@/components/ui'

export default function JoinPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const token = params.get('t') ?? ''
  const code = params.get('code') ?? ''
  const { user } = useAuthUser()
  const { error: toastError, info } = useToast()
  const [displayName, setDisplayName] = useState('')
  const [seeded, setSeeded] = useState(false)
  const [joining, setJoining] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [closed, setClosed] = useState(false)
  const [invite, setInvite] = useState<{ name: string; role: string } | null>(null)
  const told = useRef('')
  const infoRef = useRef(info)
  infoRef.current = info

  useEffect(() => {
    if (seeded) return
    const full = user?.fullName?.trim()
    if (!full) return
    setDisplayName(full)
    setSeeded(true)
  }, [seeded, user])

  useEffect(() => {
    if (!id || (!token && !code)) return
    const key = `${id}?${token || code}`
    if (told.current === key) return
    told.current = key
    let cancelled = false
    void callAction<{ name: string; role: string }>('inviteNotice', { candidateId: id, inviteCode: code, token })
      .then((data) => {
        if (cancelled) return
        setInvite(data)
        infoRef.current(`${data.name} is ready`, `You're invited to score this ${data.role}.`)
      })
      .catch(() => {
        if (!cancelled) told.current = ''
      })
    return () => {
      cancelled = true
    }
  }, [id, code, token])

  useEffect(() => {
    if (!waiting || !id || (!code && !token)) return
    let cancelled = false
    const tick = () => {
      void callAction<{ joined?: boolean }>('joinPanel', {
        candidateId: id,
        inviteCode: code,
        token,
        displayName: displayName.trim(),
      })
        .then((data) => {
          if (!cancelled && data.joined) window.location.assign(`/c/${id}`)
        })
        .catch(() => undefined)
    }
    const timer = window.setInterval(tick, 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [waiting, id, code, token, displayName])

  async function join() {
    setJoining(true)
    setClosed(false)
    try {
      const data = await callAction<{ joined?: boolean; pending?: boolean }>('joinPanel', {
        candidateId: id,
        inviteCode: code,
        token,
        displayName: displayName.trim(),
      })
      if (data.pending) {
        setWaiting(true)
        setJoining(false)
        return
      }
      const clean = new URL(window.location.href)
      clean.searchParams.delete('t')
      window.history.replaceState({}, '', `${clean.pathname}${clean.search}`)
      // Collaborator-list changes are not a documented rebroadcast.
      // A full load is what puts this interviewer on the room socket.
      window.location.assign(`/c/${id}`)
    } catch (error) {
      const codeName = error instanceof Error ? error.message : ''
      if (codeName === 'already_revealed') {
        setClosed(true)
      } else {
        toastError('Could not join', explainActionError(error))
      }
      setJoining(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center px-6 py-16">
      <title>Join panel | BlindScore</title>
      <p className="text-xs uppercase tracking-[0.18em] text-primary">Invite</p>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight">Join this panel</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Enter the name this room should show for you. Open the same invite again to change it. One scorecard, then it locks.
      </p>
      {invite ? (
        <p className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm" role="status">
          You're invited to score {invite.name} for {invite.role}.
        </p>
      ) : null}
      <label className="mt-8 block text-xs text-muted-foreground" htmlFor="panel-name">
        Name on the panel
      </label>
      <Input
        id="panel-name"
        className="mt-2"
        value={displayName}
        maxLength={60}
        onChange={(event) => setDisplayName(event.target.value)}
        placeholder="Your name"
      />
      {waiting ? (
        <p className="mt-4 text-sm" data-testid="join-waiting" role="status">
          Waiting for the hiring manager to approve you.
        </p>
      ) : null}
      {closed ? (
        <p className="mt-4 text-sm text-destructive">
          This room is already revealed, and this account is not on the panel, so the name cannot be changed from here.
        </p>
      ) : waiting ? null : (
        <Button
          className="mt-4"
          data-testid="join-panel"
          onClick={() => void join()}
          disabled={joining || (!code && !token) || displayName.trim().length === 0}
          loading={joining}
        >
          Join panel
        </Button>
      )}
      {!code && !token ? <p className="mt-3 text-sm text-destructive">This invite link is missing its code. Copy the whole link.</p> : null}
    </div>
  )
}
