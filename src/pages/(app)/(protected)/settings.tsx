/**
 * Example gated page. Reached at /settings — no auth logic lives here
 * because (protected)/_layout.tsx already wraps the subtree in <AuthGate>.
 */

import { useState } from 'react'
import { signOut, useQuery, useUser } from 'deepspace'
import { callAction, explainActionError } from '@/lib/action'
import { Button, useToast } from '@/components/ui'

interface ContactRow {
  label: string
  email: string
}

export default function SettingsPage() {
  const { user } = useUser()
  const { records } = useQuery<ContactRow>('contacts')
  const { error: toastError } = useToast()
  const [busy, setBusy] = useState('')

  async function remove(contactId: string) {
    setBusy(contactId)
    try {
      await callAction('removeContact', { contactId })
    } catch (error) {
      toastError('Could not remove', explainActionError(error))
    } finally {
      setBusy('')
    }
  }

  return (
    // No background on page wrappers — pages render into whatever the app's
    // (app)/_layout provides (a plain background, or a raised panel), so they
    // stay transparent and inherit it.
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="mb-12 text-4xl font-bold tracking-tight">Settings</h1>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Your account</h2>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="text-foreground">{user?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-foreground">{user?.email ?? '—'}</dd>
            </div>
          </dl>

          <Button variant="secondary" className="mt-6" onClick={() => signOut()}>
            Sign out
          </Button>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Saved people</h2>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">People you invite are saved here for the next room.</p>
          ) : (
            <ul className="space-y-2">
              {records.map((contact) => (
                <li key={contact.recordId} data-testid="saved-person" className="flex items-center justify-between gap-3 text-sm">
                  <span>{contact.data.label}{contact.data.email ? ` · ${contact.data.email}` : ''}</span>
                  <Button type="button" variant="outline" disabled={busy === contact.recordId} onClick={() => void remove(contact.recordId)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
