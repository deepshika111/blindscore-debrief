# BlindScore

[![CI](https://github.com/deepshika111/blindscore/actions/workflows/ci.yml/badge.svg)](https://github.com/deepshika111/blindscore/actions/workflows/ci.yml)

Interviewers score a candidate without seeing each other. The room opens when the panel is full, or when the hiring manager force-reveals.

How it is built: [Build a blind-voting app with DeepSpace in a day](docs/build-a-blind-voting-app.md).

## Use this template

This checkout is a working DeepSpace app. The template release is the local tag `v0.1.0`. To run it:

1. `npx deepspace auth login`
2. `npm install`
3. `npm run dev` for Chrome on http://localhost. Safari needs `npm run dev:safari`, then https://localhost:5173, because Safari drops the sign-in cookie on plain http.
4. `npx tsc --noEmit` and `npm run test:unit`
5. From `tests/`, `DEEPSPACE_PORT=<a free port>` `npx playwright test`. Port 5173 is the dev server. The Playwright config starts its own Vite on `DEEPSPACE_PORT`.

`generateDebrief` is the only model call. A daily cron deletes rooms past the retention window. There is no job queue and no assistant route. Invites are sent with each person's own mailto: link. Sending from the app is not built; it would need a verified sending domain.

## Security model

- Clients never write BlindScore collections. Every write is a server action in `src/actions/index.ts`.
- The caller is `userId` from the verified session. An id in the request body is never treated as the caller.
- Not on the panel, or no such room, returns 404. A panel member using a hiring-manager action returns 403.
- `deleteCandidate` is hiring-manager only. A panel member can `leaveRoom` only before reveal and only if they have not submitted.
- Each panelist gets one link. The server stores a hash of the token, not the token. A second account that opens a claimed, revoked, or expired link gets 403. The same person can open their own link again. An open link that needs approval is off unless the manager turns it on. Pending people still cannot read or submit. `removeMember` works before reveal and only if that person has not submitted.
- Sign-in does not give the action a verified email, so invites are not locked to an address.
- Before reveal, `roomShell` returns names, who submitted, flags, and the caller's own card. Other scores and notes are not included. After reveal, the snapshot is returned only to panel members.
- A scorecard submitted after a reveals row exists gets 409 and is not stored. If a reveal lands after the card write, the action deletes that card and its submission so a stored card cannot sit outside the snapshot.
- `records.create` updates an existing id. The reveal row carries an immutable seal, so a second writer reads the first snapshot and does not replace it. Setting the candidate status is a second write. If that write is missed, `roomShell` sets status to `revealed` before it returns.
- Rooms and scores are deleted automatically after 90 days. A sample room is deleted after 7 days. Saved people are kept.
- Calibration is your own average against the rest of each panel. The hiring manager and the app owner do not see anyone else's numbers.

## Limits

- Names 60 characters, roles 80, strengths and concerns 1,000.
- New join requests: 10 per minute per person, counted in the record Durable Object.
- New rooms: 20 per hour per person.
- Debrief generation: 5 attempts for the life of a room, and at most 3 of those per hour. Only the hiring manager can press Retry. A finished debrief does not call the model again.
- One sample room per user. It does not call the model.

## Still open

- The two reveal writes are not one database transaction. A crash between them is repaired on the next `roomShell`.
- Rate limits are per isolate of one Durable Object. A burst that arrives as two requests can still interleave only at the action boundary; the counter itself is one request.
- Invites are sent with each person's own mailto: link. Sending from the app is not built; it would need a verified sending domain. The calendar file, when a debrief time is set, uses the room URL.
