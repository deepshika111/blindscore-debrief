export const DIMS = ['technical', 'systemDesign', 'communication'] as const

export type Dim = (typeof DIMS)[number]

export interface StatCard {
  name: string
  scores: Record<string, number>
}

export interface DimStat {
  dim: string
  mean: number
  spread: number
  level: 'none' | 'moderate' | 'high'
}

/** Pure. The model is never asked to do this arithmetic. */
export function computeStats(cards: StatCard[]): DimStat[] {
  return DIMS.map((dim) => {
    const vals = cards.map((card) => card.scores[dim] ?? 0)
    const spread = cards.length === 0 ? 0 : Math.max(...vals) - Math.min(...vals)
    const mean = cards.length === 0 ? 0 : vals.reduce((sum, value) => sum + value, 0) / vals.length
    const level = spread >= 2 ? 'high' : spread === 1 ? 'moderate' : 'none'
    return { dim, mean: Math.round(mean * 10) / 10, spread, level }
  })
}

/** Metrics whose scores differ by 2 or more, widest split first. */
export function discussFirst(
  cards: Array<{ scores: Record<string, number> | { technical: number; systemDesign: number; communication: number } }>,
): Dim[] {
  return DIMS.map((dim) => {
    const vals = cards.map((card) => (card.scores as Record<string, number>)[dim] ?? 0)
    const spread = vals.length === 0 ? 0 : Math.max(...vals) - Math.min(...vals)
    return { dim, spread }
  })
    .filter((row) => row.spread >= 2)
    .sort((a, b) => b.spread - a.spread || DIMS.indexOf(a.dim) - DIMS.indexOf(b.dim))
    .map((row) => row.dim)
}

export const DIM_LABEL: Record<Dim, string> = {
  technical: 'Technical',
  systemDesign: 'System design',
  communication: 'Communication',
}

export interface PanelVote {
  verdict: 'Yes' | 'No' | 'Split'
  yes: number
  no: number
  yesPercent: number
  noPercent: number
}

/** One overall yes or no from the recommendations the panel actually submitted. */
export function panelVote(cards: Array<{ recommendation: string }>): PanelVote {
  const yes = cards.filter((card) => card.recommendation === 'lean_yes' || card.recommendation === 'strong_yes').length
  const no = cards.filter((card) => card.recommendation === 'lean_no' || card.recommendation === 'strong_no').length
  const total = yes + no
  const yesPercent = total === 0 ? 0 : Math.round((yes / total) * 100)
  const noPercent = total === 0 ? 0 : 100 - yesPercent
  const verdict = yes > no ? 'Yes' : no > yes ? 'No' : 'Split'
  return { verdict, yes, no, yesPercent, noPercent }
}

export interface MetricSplit {
  total: number
  agreed: number
  disagreed: number
  agreedPercent: number
  disagreedPercent: number
}

/** Largest group sharing one score counts as agreed. Everyone else disagreed. */
export function metricSplit(scores: number[]): MetricSplit {
  const total = scores.length
  if (total === 0) return { total: 0, agreed: 0, disagreed: 0, agreedPercent: 0, disagreedPercent: 0 }
  const counts = new Map<number, number>()
  for (const score of scores) counts.set(score, (counts.get(score) ?? 0) + 1)
  const agreed = Math.max(...counts.values())
  const disagreed = total - agreed
  const agreedPercent = Math.round((agreed / total) * 100)
  return { total, agreed, disagreed, agreedPercent, disagreedPercent: 100 - agreedPercent }
}
