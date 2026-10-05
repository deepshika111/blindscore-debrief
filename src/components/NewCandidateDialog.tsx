import { useState } from 'react'
import { useQuery } from 'deepspace'
import { callAction, explainActionError } from '@/lib/action'
import { RUBRICS, type Rubric } from '@/lib/rubrics'
import { Button, Input, Label, Modal, useToast } from './ui'

interface ContactRow {
  ownerId: string
  label: string
  email: string
  lastUsedAt: string
}

interface InviteRow {
  candidateId: string
  label: string
  email: string
  createdAt: string
}

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
  const { records: contacts } = useQuery<ContactRow>('contacts')
  const { records: invites } = useQuery<InviteRow>('invites')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [rows, setRows] = useState<Array<{ label: string; email: string }>>([{ label: '', email: '' }])
  const [focus, setFocus] = useState(0)
  const [template, setTemplate] = useState<Rubric['id']>('swe')
  const [openLink, setOpenLink] = useState(false)
  const [saving, setSaving] = useState(false)
  const ready = rows.some((row) => row.label.trim()) || openLink
  const typed = rows[focus]?.label.trim().toLowerCase() ?? ''
  const suggestions = typed
    ? contacts.filter((contact) => {
        const label = contact.data.label.toLowerCase()
        const email = (contact.data.email ?? '').toLowerCase()
        return label.includes(typed) || email.includes(typed)
      }).slice(0, 5)
    : []

  function samePanel() {
    const groups = new Map<string, { at: string; people: Array<{ label: string; email: string }> }>()
    for (const invite of invites) {
      const id = invite.data.candidateId
      const at = invite.data.createdAt
      const group = groups.get(id) ?? { at, people: [] }
      if (at > group.at) group.at = at
      group.people.push({ label: invite.data.label, email: invite.data.email ?? '' })
      groups.set(id, group)
    }
    const latest = [...groups.values()].sort((a, b) => (a.at < b.at ? 1 : -1))[0]
    if (!latest) return
    setRows(latest.people.slice(0, 5))
  }

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
        rubric: template,
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
      setTemplate('swe')
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
            {invites.length > 0 ? (
              <Button type="button" variant="outline" data-testid="same-panel" onClick={samePanel}>
                Same panel as last time
              </Button>
            ) : null}
            {rows.map((row, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <Label htmlFor={`panelist-${index}`}>Panelist {index + 1}</Label>
                  <Input
                    id={`panelist-${index}`}
                    value={row.label}
                    maxLength={60}
                    onFocus={() => setFocus(index)}
                    onChange={(event) => {
                      setFocus(index)
                      setRow(index, { label: event.target.value })
                    }}
                    placeholder="Name"
                  />
                  {focus === index && suggestions.length > 0 ? (
                    <ul className="rounded-lg border border-border bg-card">
                      {suggestions.map((contact) => (
                        <li key={contact.recordId}>
                          <button
                            type="button"
                            data-testid="contact-suggestion"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => setRow(index, { label: contact.data.label, email: contact.data.email ?? '' })}
                          >
                            {contact.data.label}{contact.data.email ? ` · ${contact.data.email}` : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
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
          <label className="block space-y-1.5">
            <Label htmlFor="candidate-template">Template</Label>
            <select
              id="candidate-template"
              value={template}
              onChange={(event) => setTemplate(event.target.value as Rubric['id'])}
              className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
            >
              {(Object.keys(RUBRICS) as Rubric['id'][]).map((id) => (
                <option key={id} value={id}>{RUBRICS[id].label}</option>
              ))}
            </select>
          </label>
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
