/**
 * Background-job handler — invoked by AppJobRoom (worker.ts) for every
 * job picked up from the queue. Dispatch on `job.type`.
 *
 * BlindScore's debrief is a server action (`generateDebrief`), not a job:
 * one stored result is shared by the panel.
 */

import type { Job, JobContext } from 'deepspace/worker'

export async function runJob(job: Job, _ctx: JobContext, _env: unknown): Promise<void> {
  throw new Error(`Unknown job type: ${job.type}`)
}
