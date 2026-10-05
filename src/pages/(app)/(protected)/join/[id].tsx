import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuthUser } from 'deepspace'
import { callAction, explainActionError } from '@/lib/action'
import { Button, Input, useToast } from '@/components/ui'

export default function JoinPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const code = params.get('code') ?? ''
  const { user } = useAuthUser()
  const { error: toastError } = useToast()
  const [displayName, setDisplayName] = useState('')
  const [seeded, setSeeded] = useState(false)
  const [joining, setJoining] = useState(false)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (seeded) return
    const full = user?.fullName?.trim()
    if (!full) return
    setDisplayName(full)
    setSeeded(true)
  }, [seeded, user])

  async function join() {
    setJoining(true)
    setClosed(false)
    try {
      await callAction('joinPanel', { candidateId: id, inviteCode: code, displayName: displayName.trim() })
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
      <label className="mt-8 block text-xs text-muted-foreground" htmlFor="panel-name">
        Name on the panel
      </label>
      <Input
        id="panel-name"
        className="mt-2"
        value={displayName}
        maxLength={120}
        onChange={(event) => setDisplayName(event.target.value)}
        placeholder="Your name"
      />
      {closed ? (
        <p className="mt-4 text-sm text-destructive">
          This room is already revealed, and this account is not on the panel, so the name cannot be changed from here.
        </p>
      ) : (
        <Button
          className="mt-4"
          data-testid="join-panel"
          onClick={() => void join()}
          disabled={joining || !code || displayName.trim().length === 0}
          loading={joining}
        >
          Join panel
        </Button>
      )}
      {!code ? <p className="mt-3 text-sm text-destructive">This invite link is missing its code. Copy the whole link, including the part after ?code=.</p> : null}
    </div>
  )
}
