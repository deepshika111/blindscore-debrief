import { useState } from 'react'
import { callAction, explainActionError } from '@/lib/action'
import { Button, Input, Label, Modal, useToast } from './ui'

interface IssuedInvite {
  id: string
  label: string
  email: string
  token: string
}

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
  const [rows, setRows] = useState<Array<{ label: string; email: string }>>([{ label: '', email: '' }])
  const [openLink, setOpenLink] = useState(false)
  const [saving, setSaving] = useState(false)
  const ready = rows.some((row) => row.label.trim()) || openLink

  function setRow(index: number, patch: Partial<{ label: string; email: string }>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  async function create() {
    setSaving(true)
    try {
      const panelists = rows
        .filter((row) => row.label.trim())
        .map((row) => ({ label: row.label.trim(), email: row.email.trim() }))
      const data = await callAction<{ candidateId: string; inviteCode: string; invites: IssuedInvite[] }>('createCandidate', {
        name,
        role,
        panelists,
        allowOpenLink: openLink,
      })
      const links = data.invites.map((invite) => ({
        id: invite.id,
        label: invite.label,
        email: invite.email,
        url: `${window.location.origin}/join/${data.candidateId}?t=${invite.token}`,
      }))
      sessionStorage.setItem(`blindscore-links:${data.candidateId}`, JSON.stringify(links))
      sessionStorage.setItem(
        `blindscore-draft:${data.candidateId}`,
        JSON.stringify({
          name: name.trim(),
          role: role.trim(),
          expectedPanelSize: panelists.length + 1,
          inviteCode: data.inviteCode,
        }),
      )
      setName('')
      setRole('')
      setRows([{ label: '', email: '' }])
      setOpenLink(false)
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
          You score too. Each other person gets their own link. The panel size is you plus the people listed here.
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
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <Label htmlFor={`panelist-${index}`}>Panelist {index + 1}</Label>
                  <Input id={`panelist-${index}`} value={row.label} maxLength={60} onChange={(event) => setRow(index, { label: event.target.value })} placeholder="Name" />
                </label>
                <label className="block space-y-1.5">
                  <Label htmlFor={`panelist-email-${index}`}>Email</Label>
                  <Input id={`panelist-email-${index}`} value={row.email} maxLength={200} onChange={(event) => setRow(index, { email: event.target.value })} placeholder="Optional" />
                </label>
              </div>
            ))}
            {rows.length < 5 ? (
              <Button type="button" variant="outline" onClick={() => setRows((current) => [...current, { label: '', email: '' }])}>
                Add panelist
              </Button>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={openLink}
              onChange={(event) => setOpenLink(event.target.checked)}
            />
            Allow open link
          </label>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={() => void create()} disabled={saving || !name.trim() || !role.trim() || !ready} loading={saving}>
          Open room
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
