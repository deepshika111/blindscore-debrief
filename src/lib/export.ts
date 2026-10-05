export interface DebriefExport {
  candidate: string
  role: string
  rubric: string
  metrics: Array<{ label: string; scores: string }>
  discussFirst: string[]
  divergences?: Array<{ label: string; note: string }>
  questions?: string[]
  decision?: { label: string; reason: string } | null
}

export function plainDebrief(report: DebriefExport): string {
  const lines = [
    `${report.candidate} — ${report.role}`,
    `Rubric: ${report.rubric}`,
    '',
    'Scores',
    ...report.metrics.map((metric) => `${metric.label}: ${metric.scores}`),
    '',
    'Discuss first',
    ...(report.discussFirst.length > 0 ? report.discussFirst.map((label) => `- ${label}`) : ['- None']),
  ]
  if (report.divergences && report.divergences.length > 0) {
    lines.push('', 'Divergences')
    for (const item of report.divergences) lines.push(`- ${item.label}: ${item.note}`)
  }
  if (report.questions && report.questions.length > 0) {
    lines.push('', 'Questions')
    for (const question of report.questions) lines.push(`- ${question}`)
  }
  if (report.decision) {
    lines.push('', 'Decision', `${report.decision.label}: ${report.decision.reason}`)
  }
  return `${lines.join('\n')}\n`
}

export function markdownDebrief(report: DebriefExport): string {
  const lines = [
    `# ${report.candidate} — ${report.role}`,
    '',
    `**Rubric:** ${report.rubric}`,
    '',
    '## Scores',
    ...report.metrics.map((metric) => `- **${metric.label}:** ${metric.scores}`),
    '',
    '## Discuss first',
    ...(report.discussFirst.length > 0 ? report.discussFirst.map((label) => `- ${label}`) : ['- None']),
  ]
  if (report.divergences && report.divergences.length > 0) {
    lines.push('', '## Divergences')
    for (const item of report.divergences) lines.push(`- **${item.label}:** ${item.note}`)
  }
  if (report.questions && report.questions.length > 0) {
    lines.push('', '## Questions')
    for (const question of report.questions) lines.push(`- ${question}`)
  }
  if (report.decision) {
    lines.push('', '## Decision', `**${report.decision.label}:** ${report.decision.reason}`)
  }
  return `${lines.join('\n')}\n`
}
