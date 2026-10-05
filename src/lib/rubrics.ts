export interface Metric {
  key: string
  label: string
  anchors: [string, string, string, string]
}

export interface Rubric {
  id: 'swe' | 'pm' | 'design'
  label: string
  metrics: [Metric, Metric, Metric]
}

const SWE: Rubric = {
  id: 'swe',
  label: 'SWE',
  metrics: [
    {
      key: 'technical',
      label: 'Technical',
      anchors: [
        'Missed the core problem.',
        'Solved a simpler version.',
        'Solid solution with a small gap.',
        'Clear solution and the tradeoffs.',
      ],
    },
    {
      key: 'systemDesign',
      label: 'System design',
      anchors: [
        'No structure for the system.',
        'A sketch that skips failure.',
        'A workable design with one gap.',
        'A design that names limits and failure.',
      ],
    },
    {
      key: 'communication',
      label: 'Communication',
      anchors: [
        'Hard to follow the reasoning.',
        'Needed several prompts to clarify.',
        'Clear, with one muddy spot.',
        'Easy to follow, including the tradeoffs.',
      ],
    },
  ],
}

const PM: Rubric = {
  id: 'pm',
  label: 'PM',
  metrics: [
    {
      key: 'problem',
      label: 'Problem framing',
      anchors: [
        'Jumped to a solution.',
        'Named a problem, not who has it.',
        'A clear problem with a thin success measure.',
        'Problem, user, and success are specific.',
      ],
    },
    {
      key: 'execution',
      label: 'Execution',
      anchors: [
        'No path from idea to ship.',
        'A plan that skips the first milestone.',
        'A sequence with one missing risk.',
        'A sequence, owners, and the main risk.',
      ],
    },
    {
      key: 'stakeholders',
      label: 'Stakeholders',
      anchors: [
        'Talked past the other side.',
        'Heard them, then restated the same plan.',
        'Adjusted once after a pushback.',
        'Used the pushback to change the plan.',
      ],
    },
  ],
}

const DESIGN: Rubric = {
  id: 'design',
  label: 'Design',
  metrics: [
    {
      key: 'craft',
      label: 'Craft',
      anchors: [
        'The screen does not match the task.',
        'Usable, with rough hierarchy.',
        'Clear hierarchy and one weak state.',
        'Hierarchy, states, and the edge case.',
      ],
    },
    {
      key: 'systems',
      label: 'Design systems',
      anchors: [
        'One-off choices with no pattern.',
        'Reused a piece, then broke it.',
        'Fits the system, with one exception.',
        'Extends the system without a special case.',
      ],
    },
    {
      key: 'collaboration',
      label: 'Collaboration',
      anchors: [
        'Defended the first idea.',
        'Noted feedback and kept the design.',
        'Changed one decision from feedback.',
        'Folded feedback into the next version.',
      ],
    },
  ],
}

export const RUBRICS: Record<Rubric['id'], Rubric> = { swe: SWE, pm: PM, design: DESIGN }

export function rubricById(id: unknown): Rubric {
  if (id === 'pm' || id === 'design' || id === 'swe') return RUBRICS[id]
  return SWE
}

export function rubricFromRoom(value: unknown): Rubric {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return SWE
  const raw = value as { id?: unknown; label?: unknown; metrics?: unknown }
  if (!Array.isArray(raw.metrics) || raw.metrics.length !== 3) return SWE
  const metrics: Metric[] = []
  for (const entry of raw.metrics) {
    if (!entry || typeof entry !== 'object') return SWE
    const metric = entry as { key?: unknown; label?: unknown; anchors?: unknown }
    if (typeof metric.key !== 'string' || typeof metric.label !== 'string' || !Array.isArray(metric.anchors) || metric.anchors.length !== 4) return SWE
    if (!metric.anchors.every((line) => typeof line === 'string')) return SWE
    metrics.push({ key: metric.key, label: metric.label, anchors: metric.anchors as Metric['anchors'] })
  }
  const id = raw.id === 'pm' || raw.id === 'design' || raw.id === 'swe' ? raw.id : 'swe'
  return { id, label: typeof raw.label === 'string' ? raw.label : RUBRICS[id].label, metrics: metrics as Rubric['metrics'] }
}

export function metricLabel(rubric: Rubric, key: string): string {
  return rubric.metrics.find((metric) => metric.key === key)?.label ?? key
}
