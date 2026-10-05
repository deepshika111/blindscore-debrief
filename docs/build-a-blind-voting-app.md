# Build a blind-voting app with DeepSpace in a day

BlindScore is that app. Interviewers score a candidate without seeing each other. The room opens when the panel is full, or when the hiring manager force-reveals. This note is the path from an empty DeepSpace app to that behavior.

## The problem

In a hiring debrief, the first person to say a number anchors the rest of the panel. The product keeps each scorecard private until every score appears at the same moment.

## Sealed scores

Scores live in `scorecards` and in the one `reveals` row. They do not live on the candidate, the submission, or the debrief.

`scorecards` is `read: 'own'` for member and for admin, with `ownerField` set to `interviewerId`. Admin matches member on purpose. The app owner is pinned to admin, so a wider admin read would let the owner open sealed cards. The Durable Object enforces that. Hiding a column in React would not.

Anonymous sockets are denied with an explicit `*` role on every collection. Clients have `create: false`. A browser cannot insert a score.

## Server actions are the only write path

Every write is a function in `src/actions/index.ts`. The action checks the caller, then writes. Action tools skip per-record RBAC, so the check has to live in the action. Wrong role returns 403. A room the caller is not on returns 404, “Room not found.”

## Identity comes from the session

The action context carries `userId` from the verified JWT. An id in the request body only says which room. It is never treated as the caller. Sign-in does not give the action a verified email, so an invite is not locked to an address. Whoever holds that person's token claims the seat.

## Opening the room

`records.create` updates a row when the id already exists. The reveal row uses the candidate id and an immutable `seal`. The first writer sets the seal. A second writer that sends a different seal is rejected, reads the snapshot that won, and stops. Setting `candidates.status` to `revealed` is a second write. If that write is missed, the next `roomShell` repairs the status. Those two writes are not one database transaction.

A scorecard that lands after the reveal row exists is deleted, along with its submission, and the action returns 409.

## One link per person

Each panelist gets a random token. The server stores a SHA-256 hash, not the token. The link is returned once. Claiming it is one SQL update that succeeds only while the invite is still pending and unexpired, so two people cannot both take the same seat. A second account that opens a claimed, revoked, or expired link gets 403. The same person can open their own link again.

The older flow was one shared link plus Approve and Deny. That path still exists only when the manager turns on “Allow open link.” It is off by default.

## What fought back

Safari and the local certificate. The records socket often never delivered `query_result` on the self-signed dev cert, so the room sat on “Opening the room…”. `roomShell` is an ordinary POST that returns the names, the count, and, only after reveal, the snapshot. The socket is still the live path. The POST is what keeps the room usable when the socket does not finish. `npm run dev:safari` serves https so the sign-in cookie sticks in Safari.

Cookies. OAuth wanted to bounce a second account back to `/home`, which dropped the invite. A short-lived `blindscore-next` cookie holds a `/join/...` path, and the auth complete route reads it. The proxy has to rewrite that cookie on the way through, or the browser rejects it.

## The model

`generateDebrief` is the only model call. It uses `createDeepSpaceAI` and `generateText` with model id `claude-sonnet-5`. `computeStats` does the arithmetic. The model writes prose and must not recommend hire or no-hire. A reply that says to hire is stored as failed and counts as one of the five tries. There is no API key in the repo.
