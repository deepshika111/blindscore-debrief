# BlindScore

[![CI](https://github.com/deepshika111/blindscore/actions/workflows/ci.yml/badge.svg)](https://github.com/deepshika111/blindscore/actions/workflows/ci.yml)

Interviewers score a candidate without seeing each other. The room opens when the panel is full, or when the hiring manager force-reveals.

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

## Limits

- Names 60 characters, roles 80, strengths and concerns 1,000.
- New join requests: 10 per minute per person, counted in the record Durable Object.
- New rooms: 20 per hour per person.
- Debrief generation: 5 attempts for the life of a room, and at most 3 of those per hour. Only the hiring manager can press Retry. A finished debrief does not call the model again.
- One sample room per user. It does not call the model.

## Still open

- The two reveal writes are not one database transaction. A crash between them is repaired on the next `roomShell`.
- Rate limits are per isolate of one Durable Object. A burst that arrives as two requests can still interleave only at the action boundary; the counter itself is one request.
- Outbound email sends only when `RESEND_API_KEY` and `RESEND_FROM` are Worker secrets. Each message contains one person's link. The calendar file, when a debrief time is set, uses the room URL.
