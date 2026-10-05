import { useState } from 'react'
import { callAction, explainActionError } from '@/lib/action'
import { Button, Input, Label, Modal, useToast } from './ui'

export function NewCandidateDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (candidateId: string) => void
}) {
  const { error: toastError } = useToast()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [size, setSize] = useState(3)
  const [saving, setSaving] = useState(false)

  async function create() {
    setSaving(true)
    try {
      const data = await callAction<{ candidateId: string; inviteCode: string }>('createCandidate', {
        name,
        role,
        expectedPanelSize: size,
      })
      sessionStorage.setItem(
        `blindscore-draft:${data.candidateId}`,
        JSON.stringify({
          name: name.trim(),
          role: role.trim(),
          expectedPanelSize: size,
          inviteCode: data.inviteCode,
        }),
      )
      setName('')
      setRole('')
      onCreated(data.candidateId)
    } catch (error) {
      toastError('Room not opened', explainActionError(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>New candidate</Modal.Title>
        <Modal.Description>
          You score too. Share the invite link with the rest of the panel. Size includes you.
        </Modal.Description>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <Label htmlFor="candidate-name">Candidate</Label>
            <Input id="candidate-name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="Rin Patel" />
          </label>
          <label className="block space-y-1.5">
            <Label htmlFor="candidate-role">Role</Label>
            <Input id="candidate-role" value={role} maxLength={80} onChange={(event) => setRole(event.target.value)} placeholder="Backend engineer" />
          </label>
          <label className="block space-y-1.5">
            <Label htmlFor="panel-size">Panel size</Label>
            <Input
              id="panel-size"
              type="number"
              min={2}
              max={6}
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            />
          </label>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          onClick={() => void create()}
          disabled={saving || !name.trim() || !role.trim()}
          loading={saving}
        >
          Open room
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
