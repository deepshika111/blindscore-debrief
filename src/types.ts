export const RECS = ['strong_no', 'lean_no', 'lean_yes', 'strong_yes'] as const

export type Recommendation = (typeof RECS)[number]

export type RoomStatus = 'scoring' | 'revealed'

export type DivergenceLevel = 'none' | 'moderate' | 'high'

export interface DimensionScores {
  technical: number
  systemDesign: number
  communication: number
}

export interface CandidateData {
  name: string
  role: string
  status: RoomStatus
  hiringManagerId: string
  expectedPanelSize: number
  panel: string[]
  panelNames: Record<string, string>
  inviteCode: string
  revealRequests?: string[]
  pendingPanel?: string[]
  pendingNames?: Record<string, string>
  isDemo?: boolean | number
  meetingAt?: string
  meetingMinutes?: number
  meetingSequence?: number
}

export interface ScorecardData {
  candidateId: string
  interviewerId: string
  scores: DimensionScores
  recommendation: Recommendation
  strengths: string
  concerns: string
}

export interface SubmissionData {
  candidateId: string
  interviewerId: string
  panel: string[]
}

export interface RevealCard {
  interviewerId: string
  name: string
  scores: Record<string, number>
  recommendation: Recommendation
  strengths: string
  concerns: string
}

export interface RevealData {
  candidateId: string
  panel: string[]
  cards: RevealCard[]
  missing: string[]
  revealedBy: string
  reason: 'auto' | 'forced'
}

export interface DimStat {
  dim: string
  mean: number
  spread: number
  level: DivergenceLevel
}

export interface DebriefSummary {
  consensus: string[]
  divergences: Array<{ dim: string; note: string }>
  questions: string[]
}

export interface DebriefData {
  candidateId: string
  panel: string[]
  status: 'pending' | 'ready' | 'failed'
  stats: DimStat[]
  summary?: DebriefSummary
  model?: string
  error?: string
  attempts?: number
}

export const REC_LABEL: Record<Recommendation, string> = {
  strong_no: 'Strong no',
  lean_no: 'Lean no',
  lean_yes: 'Lean yes',
  strong_yes: 'Strong yes',
}

export const SCORE_WORD: Record<1 | 2 | 3 | 4, string> = {
  1: 'Strong no',
  2: 'Lean no',
  3: 'Lean yes',
  4: 'Strong yes',
}
