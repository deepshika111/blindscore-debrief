# BlindScore — DeepSpace Build Exercise

Live: https://blindscore.app.space (app `app_01M43KY3P9N9NWN50EWAXA5R91`). Demo: local screen recordings in `demo/`, not a narrated tour of the live site.

## 1. Problem and user

In hiring debriefs, whoever speaks first anchors everyone else. BlindScore is an evaluation room for interview panels at small teams: each interviewer scores privately, every score appears on every screen at the same moment, and an AI debrief turns disagreements into discussion questions.

## 2. How the three DeepSpace integrations do real work

- Auth: every action trusts only the verified JWT subject (`ctx.userId`). Panel membership comes from a one-time invite link, checked on the server.
- Records + RBAC + server actions: scores live in `scorecards` and `reveals`. Scorecards are `read: 'own'` for member and admin, so the Durable Object does not send them to anyone else. Later collections (invites, contacts, decisions, an audit log) are server-written too. Clients have `create: false`. `src/actions/index.ts` owns the writes. `uniqueOn` blocks a second scorecard for the same interviewer.
- AI (`createDeepSpaceAI` + `generateText`): `generateDebrief` runs on the server after reveal, with no `authToken`, so the call bills the app owner. The model id is `claude-sonnet-5`. No API key is in the repo.

## 3. Key decisions and tradeoffs

- Blindness is enforced by the schema, not by hiding fields in the UI. `tests/collab.spec.ts` reads raw WebSocket frames. On the run below, the outsider’s frames did not contain the sealed phrase, and the hiring manager’s frames did.
- Reveal is one `reveals` row (`recordId === candidateId`) plus a separate status update. Those are two writes. Concurrent last submits upsert the same id.
- One stored debrief is shared by the panel. `computeStats` does the arithmetic; the model is told not to recommend hire or no-hire, and its JSON is parsed with zod. If that call throws, the same row is rewritten with `status: 'failed'` and the stats are kept.
- The hiring manager can force reveal as soon as one scorecard is in. Other panel members cannot, until the manager clicks “Allow force reveal to panel members”. Allowing it does not reveal the room.
- Overall yes/no comes from recommendations. Each metric is a circle: the center is the number of submitted scorecards, and the ring is the largest group that shared one score against everyone else.
- Cut from the first version: resumes and multi-org. Email, a calendar file, role rubrics, a decision log, and export came later. Each is a server action or a file built from data the action already returned.

## 4. How I directed AI coding tools

Cursor, with the DeepSpace skill and the v2 blueprint as the source of truth. Standing rules: no client writes, scores only in `scorecards` and `reveals`, identity only from `ctx.userId`.

Where the blueprint overrode an earlier design: the first pass used `userBound` on `interviewerId`, a per-card reveal collection, and a background job for the debrief. v2 replaces that with author-only scorecards, one `reveals` row, and `generateText` in the action.

## 5. Verification

Checked on 4 Oct 2026 against a local `deepspace` dev server. Playwright used a free port because 5173 was already taken. Chromium had to be installed first (`npx playwright install chromium`); before that, the two HTTP tests passed and the five browser tests could not launch.

- `npx tsc --noEmit` passed after these edits.
- Playwright, one run, `DEEPSPACE_PORT=5202`: 7 passed, 1 skipped.
  - `tests/api.spec.ts`: `/api/auth/ok` succeeded. `createCandidate`, `joinPanel`, `submitScorecard`, `forceReveal`, `allowForceReveal`, `generateDebrief`, `roomShell`, and `deleteCandidate` each returned 401 with no bearer token. `/home` mounted `app-navigation`.
  - `tests/collab.spec.ts`: two browsers stayed signed in as different accounts. The three-account test created `__test-<timestamp>__`, joined a second account, sealed a scorecard whose strengths contained `SENTINEL-BOB-<timestamp>`, opened the room URL as a third account, and read WebSocket frames. The outsider saw “Room not found” and never received the phrase. After force reveal, the hiring manager saw “Needs a clearer rollout plan.” and the phrase was present in the hiring manager’s frames only.
  - `tests/demo.spec.ts` is skipped unless `PLAYWRIGHT_DEMO=1`.
- An earlier pass of the outsider test failed because `getByLabel('Candidate')` matched both the dialog and the text field. The spec now fills the textbox by its exact accessible name. The suite above includes that fix.
- Model-failure path, live call: for one local run, `generateDebrief` called `generateText` with model id `claude-sonnet-5-missing`. The gateway rejected it. The page showed “AI summary unavailable”. A records frame for that debrief had `status: "failed"` and `stats` for `technical`, `systemDesign`, and `communication`. The model id in source was then put back to `claude-sonnet-5`. The one-off spec was not kept, because a normal run uses the real model and must not expect failure. This was not a mock.
- While doing that, a failed debrief was immediately calling `generateDebrief` again. The room now leaves `failed` alone until Retry.
- Demo recordings, from `PLAYWRIGHT_DEMO=1` on `http://localhost:5201` (about 21s, 18s, and the interviewer clip):
  - `demo/hiring-manager.webm` — open a room, allow force reveal, submit, force reveal, overall Yes and the three metric circles.
  - `demo/interviewer.webm` — join from the invite as “Interviewer”.
  - `demo/outsider.webm` — the same room URL ends on “Room not found”.
- No API key was added. `.dev.vars`, `.wrangler`, and `.deepspace` are gitignored.

## Invites, before and after

The first invite was one shared link. The hiring manager approved or denied each person who opened it. The current invite is one token per person. The server stores a hash. A second account that opens a claimed, revoked, or expired link gets 403. The shared link still exists only when the manager turns on “Allow open link.”

The Activation page still counts invite opened, claimed, joined, first scorecard, reveal, and debrief viewed. This experiment has not been run. There are no conversion numbers yet.

The write-up of the build is [Build a blind-voting app with DeepSpace in a day](docs/build-a-blind-voting-app.md).

## Known limitations

- A scorecard that arrives after the reveal row exists is deleted with its submission and returns 409.
- Sign-in does not provide a verified email, so a token is not locked to an address. Whoever holds that person's link can claim the seat until it is used.
- All rooms share one app scope. At a larger scale, each candidate would be its own RecordScope.
- `roomShell` and `forceReveal` return the room the page has to draw (name, role, cards, missing people, panel names). The records socket often never delivers `query_result` in Safari against the local certificate, so the screen cannot wait on it. That is more than ids and flags.
