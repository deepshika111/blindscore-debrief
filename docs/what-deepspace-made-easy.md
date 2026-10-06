# What DeepSpace made easy

BlindScore is a hiring room: interviewers score in private, then see the panel at once. DeepSpace covered the parts that usually take a week, and made a few things harder than they look.

## What it saved

Auth. Sign-in, the session cookie, and `ctx.userId` were already there. Actions trust that id and nothing the browser sends as "I am this interviewer." I did not write a user table, a password reset flow, or a second session format.

Per-owner reads. Scorecards are `read: 'own'` on `interviewerId`. A panel member's socket can see that they submitted, and cannot see anyone else's notes. That is the product. The schema enforces it even for the app owner, because admin is given the same read as member on purpose.

Realtime. `useQuery` is how the hiring manager sees "1 / 3 submitted" without a refresh when the socket is healthy. One room, one Durable Object, and the panel list is just a field on the row.

Server actions. Every write goes through `src/actions/index.ts`. The client cannot insert a score. The action checks the caller, then writes with RBAC off. That split is what made the pending-join list and the hiring-manager-only delete possible without a new backend.

## Where it fought back

Safari and the local certificate. The records socket often never delivered `query_result` on the self-signed dev cert, so the room sat on "Opening the room…". `roomShell` is a normal POST that returns the names, the count, and, only after reveal, the snapshot. The socket is still the live path. The POST is what keeps the room usable when the socket does not finish.

Cookies. OAuth wanted to bounce a second account back to `/home`, which dropped the invite. A short-lived cookie holds a `/join/...` path and the auth complete route reads it. The cookie has to be rewritten on the way through the proxy or the browser rejects it.

`records.create` with a known id upserts. Two last scorecards can both try to open the room. The reveal row is keyed on the candidate id and carries an immutable seal, so the second writer gets a conflict, reads the row that won, and stops. The candidate status is only a cache. If a reveals row exists and the status still says scoring, `roomShell` repairs it. Those are still two writes. A crash between them is repaired on the next read. It is not one database transaction.

## What I would tell the DeepSpace team

Document that action tools skip per-record RBAC, next to `getAuthToken`, not only in a comment inside the starter. Ship a create that fails when the id exists, instead of merging. And treat a missing `query_result` as a state the client can show: the socket can be "down" while HTTP still works, and the starter UI does not say so.

## One experiment

Post the same "Try a sample debrief" link in two developer communities on the same day, with different headlines. A: "Score a candidate without seeing the other interviewers." B: "A hiring debrief you can open in five seconds." Send each post to `/?h=a` or `/?h=b`, and log that parameter on the sample open and on the next real room that account creates.

Decision, decided before looking at the numbers. Fifty visits per headline. If one headline's sample-to-own-room rate is at least double the other and at least 10%, use that headline and run it once more. If both are under 5%, stop the posts and change the sample, not the headline. If they are within 20% of each other, the headline is not the lever; stop and change the first screen instead.

The Activation page is the measurement. It counts rooms that reached create, invite opened, joined, first scorecard, reveal, and debrief viewed. Sample rooms are excluded. Ten test users is enough to see which step drops. It is not enough to explain why.
