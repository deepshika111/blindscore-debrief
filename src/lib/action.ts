import { getAuthToken } from 'deepspace'

const COPY: Record<string, string> = {
  unauthorized: 'Sign in to continue.',
  bad_name: 'Enter a candidate name, up to 60 characters.',
  bad_role: 'Enter a role, up to 80 characters.',
  bad_size: 'Panel size must be a whole number from 2 to 6.',
  bad_code: 'This invite link is not valid.',
  invite_used: 'This invite was already used or is no longer valid.',
  bad_email: 'Enter a valid email, or leave it blank.',
  panel_full: 'This panel is already full.',
  not_found: 'Room not found.',
  forbidden: 'You are not allowed to do that.',
  already_revealed: 'Room already revealed.',
  leave_blocked: 'You can leave only before the room is revealed, and only if you have not submitted.',
  remove_blocked: 'You can remove a panel member only before the room is revealed, and only if they have not submitted.',
  rate_limited: 'Too many requests. Wait and try again.',
  slow_down: 'Too many attempts. Wait a few minutes and try again.',
  retry_cap: 'This debrief has used its five tries.',
  already_submitted: 'You already submitted a scorecard.',
  bad_scores: 'Score every dimension from 1 to 4.',
  bad_rec: 'Pick a recommendation.',
  bad_notes: 'Strengths and concerns are required, up to 1,000 characters.',
  no_submissions: 'At least one scorecard has to be in before you can reveal.',
  reveal_not_allowed: 'The hiring manager has not allowed force reveal yet.',
  not_revealed: 'Reveal the room before generating a debrief.',
  ai_failed: 'The debrief did not finish. Scores are still available.',
}

export async function callAction<T>(name: string, params: object): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('unauthorized')

  const res = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })
  const body = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: string } | null
  if (res.status === 401) throw new Error('unauthorized')
  if (!body?.success) throw new Error(body?.error ?? `HTTP ${res.status}`)
  return body.data as T
}

export function explainActionError(error: unknown): string {
  const code = error instanceof Error ? error.message : 'request_failed'
  return COPY[code] ?? code
}
