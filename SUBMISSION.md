# BlindScore — DeepSpace Build Exercise

Live: not deployed in this pass. Repo: local checkout. Demo: not recorded.

## 1. Problem and user

In hiring debriefs, whoever speaks first anchors everyone else. BlindScore is an evaluation room for interview panels at small teams: each interviewer scores privately, every score appears on every screen at the same moment, and an AI debrief turns disagreements into discussion questions.

## 2. How the three DeepSpace integrations do real work

- Auth: every action trusts only the verified JWT subject (`ctx.userId`). Panel membership comes from a one-time invite link, checked on the server.
- Records + RBAC + server actions: five collections in `src/schemas/blindscore.ts`. Scorecards are `read: 'own'` for member and admin, so the Durable Object does not send them to anyone else. Clients have `create: false` on all five; `src/actions/index.ts` owns the writes. `uniqueOn` blocks a second scorecard for the same interviewer.
- AI (`createDeepSpaceAI` + `generateText`): `generateDebrief` runs on the server after reveal, with no `authToken`, so the call bills the app owner. No API key is in the repo.

## 3. Key decisions and tradeoffs

- Blindness is enforced by the schema, not by hiding fields in the UI. `tests/collab.spec.ts` reads raw WebSocket frames and fails if `SENTINEL-BOB` arrives for an outsider. That spec was not executed here (no signed-in test accounts in this environment).
- Reveal is one `reveals` row (`recordId === candidateId`) plus a separate status update. Those are two writes. Concurrent last submits upsert the same id.
- One stored debrief is shared by the panel. `computeStats` does the arithmetic; the model is told not to recommend hire or no-hire, and its JSON is parsed with zod.
- Cut: email invites, calendar, resumes, custom rubrics, multi-org.

## 4. How I directed AI coding tools

Cursor, with the DeepSpace skill and the v2 blueprint as the source of truth. Standing rules: no client writes, scores only in `scorecards` and `reveals`, identity only from `ctx.userId`.

Where the blueprint overrode an earlier design: the first pass used `userBound` on `interviewerId`, a per-card reveal collection, and a background job that streamed the debrief. v2 replaces that with author-only scorecards, one `reveals` row, and `generateText` in the action.

## 5. Verification

- `npx tsc --noEmit` passed.
- `npx eslint src tests/api.spec.ts tests/collab.spec.ts` passed.
- `npx vitest run` passed: 3 files, 4 tests (schema lint, divergence math, and the scaffold prerender test). The scaffold config refuses `__APP_ID__`, so this run pointed `CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH` at a temporary copy with a stand-in id. It was not `npx deepspace test run unit`.
- Playwright was not run. `tests/api.spec.ts` expects 401 on every action with no bearer token. `tests/collab.spec.ts` listens for WebSocket frames and skips unless three usable test accounts exist.
- The UI was not exercised in a browser. This checkout is not logged in, and `DEEPSPACE_APP_ID` is still `__APP_ID__`, so the app was not started or deployed.
- The model-failure path was not exercised against a live model.
- No API key was added. `.dev.vars`, `.wrangler`, and `.deepspace` are gitignored. A `git log -p` secret scan was not treated as a result, because the git root is the home directory.

## Known limitations

- A submission racing a force reveal can be stored but excluded from the reveal snapshot. It stays on the author-only scorecard.
- The invite link is a bearer secret. Anyone holding it can join until the panel is full.
- All rooms share one app scope. At a larger scale, each candidate would be its own RecordScope.
