import { useEffect, useRef } from 'react'
import { useAuth, useQuery } from 'deepspace'
import { useToast } from '@/components/ui'
import { callAction } from '@/lib/action'
import type { CandidateData, SubmissionData } from '@/types'

interface Notice {
  id: string
  candidateId: string
  candidateName: string
  name: string
}

/**
 * Tells the hiring manager when each panel member submits.
 * The first successful read is the baseline, so opening the app does not
 * replay old scorecards. Later arrivals toast "{name} submitted".
 */
export function ManagerNotices() {
  const { userId } = useAuth()
  const { toast } = useToast()
  const { records: candidates, status: candidateStatus } = useQuery<CandidateData>('candidates')
  const { records: submissions, status: submissionStatus } = useQuery<SubmissionData>('submissions')
  const seen = useRef<Set<string> | null>(null)
  const toastRef = useRef(toast)
  toastRef.current = toast

  const take = useRef((notices: Notice[], seed: boolean) => {
    if (seen.current === null) {
      if (!seed) return
      seen.current = new Set(notices.map((notice) => notice.id))
      return
    }
    for (const notice of notices) {
      if (seen.current.has(notice.id)) continue
      seen.current.add(notice.id)
      toastRef.current({
        type: 'info',
        title: `${notice.name} submitted`,
        description: notice.candidateName,
        duration: 12000,
      })
    }
  })

  useEffect(() => {
    if (seen.current === null || !userId) return
    if (candidateStatus !== 'ready' || submissionStatus !== 'ready') return
    take.current(noticesForManager(candidates, submissions, userId), false)
  }, [userId, candidates, submissions, candidateStatus, submissionStatus])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const load = () => {
      void callAction<{ notices: Notice[] }>('submissionNotices', {})
        .then((data) => {
          if (!cancelled) take.current(data.notices, true)
        })
        .catch(() => undefined)
    }
    load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      load()
    }, 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [userId])

  return null
}

function noticesForManager(
  candidates: Array<{ recordId: string; data: CandidateData }>,
  submissions: Array<{ recordId: string; data: SubmissionData }>,
  userId: string,
): Notice[] {
  const managed = new Map(candidates.filter((row) => row.data.hiringManagerId === userId).map((row) => [row.recordId, row]))
  const notices: Notice[] = []
  for (const row of submissions) {
    const candidate = managed.get(row.data.candidateId)
    if (!candidate) continue
    const name = candidate.data.panelNames?.[row.data.interviewerId]
    notices.push({
      id: row.recordId,
      candidateId: row.data.candidateId,
      candidateName: candidate.data.name,
      name: typeof name === 'string' && name.trim() ? name.trim() : 'An interviewer',
    })
  }
  return notices
}
