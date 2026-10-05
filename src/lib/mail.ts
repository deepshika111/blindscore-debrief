export interface InviteMail {
  subject: string
  text: string
  attachment?: { filename: string; content: string }
}

export function safeOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 200) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password || url.search || url.hash) return null
  if (url.pathname !== '/' && url.pathname !== '') return null
  return url.origin
}

/** One person, one link. The calendar file uses the room URL, never the token. */
export function inviteMail(input: {
  candidate: string
  role: string
  link: string
  ics?: string
}): InviteMail {
  const mail: InviteMail = {
    subject: `Score ${input.candidate} for ${input.role}`,
    text: `Your link is only for you. Open it to score ${input.candidate} for ${input.role}:\n${input.link}\n`,
  }
  if (input.ics) mail.attachment = { filename: 'debrief.ics', content: input.ics }
  return mail
}
