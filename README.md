# BlindScore

Interviewers score a candidate without seeing each other. The room opens when the panel is full, or when the hiring manager force-reveals.

## Security model

- Clients never write BlindScore collections. Every write is a server action in `src/actions/index.ts`.
- The caller is `userId` from the verified session. An id in the request body is never treated as the caller.
- Not on the panel, or no such room, returns 404. A panel member using a hiring-manager action returns 403.
- `deleteCandidate` is hiring-manager only. A panel member can `leaveRoom` only before reveal and only if they have not submitted.
- Joining adds the person to a pending list. They cannot read the room or submit until the hiring manager approves them. `rotateInvite` kills the old link. `removeMember` works before reveal and only if that person has not submitted.
- Sign-in does not give the action a verified email, so invites are not locked to an address.
- Before reveal, `roomShell` returns names, who submitted, flags, and the caller's own card. Other scores and notes are not included. After reveal, the snapshot is returned only to panel members.
- A scorecard submitted after a reveals row exists gets 409 and is not stored.
- `records.create` updates an existing id. The reveal row carries an immutable seal, so a second writer reads the first snapshot and does not replace it. Setting the candidate status is a second write. If that write is missed, `roomShell` repairs it from the reveals row.

## Limits

- Names 60 characters, roles 80, strengths and concerns 1,000.
- New join requests: 10 per minute per person, counted in the record Durable Object.
- New rooms: 20 per hour per person.
- Debrief generation: 3 per room per hour, and 3 attempts total. Only the hiring manager can press Retry.
- One sample room per user. It does not call the model.

## Still open

- The two reveal writes are not one database transaction. A crash between them is repaired on the next `roomShell`.
- Rate limits are per isolate of one Durable Object. A burst that arrives as two requests can still interleave only at the action boundary; the counter itself is one request.
- There is no outbound email. The hiring manager copies the invite link. A provider such as Resend would need a Worker secret and a verified domain.
