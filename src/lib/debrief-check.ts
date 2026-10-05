import { z } from 'zod'

const Debrief = z.object({
  consensus: z.array(z.string()).max(4),
  divergences: z.array(z.object({ dim: z.string(), note: z.string() })).max(4),
  questions: z.array(z.string()).min(2).max(3),
})

const HIRE_LANGUAGE = [/should hire/i, /do not hire/i, /recommend hiring/i, /no-hire/i, /strong hire/i]

export type DebriefBody = z.infer<typeof Debrief>

function stripFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return (fenced?.[1] ?? trimmed).trim()
}

/** A model reply is kept only when it is the expected JSON and does not recommend a hire decision. */
export function acceptDebrief(text: string): DebriefBody | null {
  try {
    const parsed = Debrief.safeParse(JSON.parse(stripFences(text)))
    if (!parsed.success) return null
    const blob = JSON.stringify(parsed.data)
    if (HIRE_LANGUAGE.some((pattern) => pattern.test(blob))) return null
    return parsed.data
  } catch {
    return null
  }
}
