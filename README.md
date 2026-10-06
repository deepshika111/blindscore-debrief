# BlindScore

**Live:** https://blindscore.app.space

BlindScore helps an interview panel score a candidate fairly.

In a normal hiring debrief, the first person to speak sets the tone, and everyone else drifts toward their opinion. BlindScore stops that. Each interviewer scores on their own, nobody can see anyone else's score, and then all the scores appear on every screen at the same moment.

How it was built, step by step: [Build a blind-voting app with DeepSpace in a day](docs/build-a-blind-voting-app.md).

## How it works

1. **The hiring manager opens a room** for a candidate and says how many people are on the panel.
2. **Each interviewer gets their own invite link.** The manager can email it (it opens your own mail app), copy it, or share it from a phone. A link works for one person only. If someone forwards it after it has been used, the next person is turned away.
3. **Everyone scores in private.** The scorecard has three areas: Technical, System design, and Communication. Each is scored 1 to 4, with a short description for every score, plus an overall recommendation (strong no, lean no, lean yes, strong yes) and written strengths and concerns. The revealed room sums these up as an overall Yes or No.
4. **The scores are revealed** when the last person submits. The hiring manager can also reveal early, and can let other panelists do it too.
5. **An AI debrief** reads the notes and points out where the panel disagreed, with questions worth discussing. It does not say whether to hire. The numbers come from the app's own math, not the AI.
6. **The hiring manager records a decision:** Hire, No hire, or Hold, with a reason. Once saved, it can't be changed.

## What else is in it

- **Sample room.** A ready-made, already-revealed room so you can see the result without inviting anyone.
- **Due date and nudges.** The manager can set when scores are due and nudge someone who hasn't submitted, at most once every six hours per person.
- **Debrief meeting.** Set a time and download a calendar file ("Add to calendar") that works with Apple Calendar or Google Calendar.
- **Saved people.** People you invite often are remembered, so the next room fills in faster. You can remove them in Settings.
- **Copy debrief.** Copies the revealed results and the decision as plain text, to paste into notes or a hiring tool.
- **Activity.** The hiring manager can see who was invited, who joined, and when the room was revealed.
- **My calibration.** After at least 3 revealed rooms, you can see whether you tend to score higher or lower than the rest of your panels. Only you can see your own numbers.
- **Clean-up.** Rooms and scores are deleted after 90 days, and sample rooms after 7 days.

## How the scores stay private

This is the core of the app, so it is enforced on the server, not just hidden on screen.

- **Your browser cannot write data directly.** Every change, like submitting a score or revealing a room, goes through a server action that checks who you are and what you are allowed to do.
- **Who you are comes from your sign-in,** never from what the browser sends.
- **Before the reveal, a score is sent only to the person who wrote it.** Not to other panelists, not to the hiring manager, not even to the app owner. The tests check this by reading the raw data the server sends to each browser.
- **Someone who is not on the panel** just sees "Room not found."
- **Invite links are stored as a fingerprint (a hash), not the link itself,** and expire after a week.
- **The pages send strict browser security headers** (a Content Security Policy). They only allow scripts, styles, and fonts from this site, block the page from being embedded in other sites, and only let forms submit to this site.

## What it is built with

| Part | What it does |
| --- | --- |
| [DeepSpace](https://www.npmjs.com/package/deepspace) | Sign-in, the real-time database, permissions, server actions, AI access, and hosting |
| Cloudflare Workers and Durable Objects | Where the server code and the data run |
| React 19, Vite, TypeScript | The web app |
| Tailwind CSS | Styling |
| Claude (`claude-sonnet-5`), through DeepSpace | Writes the debrief. No API key is stored in this repo |
| Fontsource | The Outfit and Fraunces fonts, served from this site instead of Google |
| Zod | Checks every input on the server |
| Vitest and Playwright | Unit tests, and browser tests that sign in as several people at once |

## Where things are

- `src/actions/index.ts`: every server action (create room, join, submit, reveal, debrief, decision, and so on)
- `src/schemas/blindscore.ts`: the data collections and who may read them
- `src/pages/`: the screens (dashboard, room, join, settings, calibration)
- `src/lib/`: small helpers, each with its own tests (stats, invites, calendar, calibration, clean-up)
- `worker.ts`: the server entry point, security headers, and the daily clean-up job
- `public/_headers`: security headers for the pages
- `tests/`: the browser tests

## Run it yourself

1. `npx deepspace auth login`
2. `npm install`
3. `npm run dev`, then open http://localhost:5173 in Chrome. Safari needs `npm run dev:safari` and https://localhost:5173, because Safari drops the sign-in cookie on plain http.

To check everything:

```sh
npx tsc --noEmit        # type check
npm run test:unit       # unit tests
npm test                # DeepSpace smoke and API tests
cd tests && DEEPSPACE_PORT=5290 npx playwright test   # all browser tests
```

The Playwright tests start their own server, so pick a free port that isn't 5173. They run one at a time because they share the same test accounts.

To deploy: commit your changes, then run `npx deepspace deploy`.

This repo is also usable as a starting point for your own app. The release is the local tag `v0.1.0`.

## Limits

- Names up to 60 characters, roles 80, strengths and concerns 1,000.
- Up to 20 new rooms per hour per person, and 10 join attempts per minute.
- The AI debrief can be tried 5 times per room, at most 3 times an hour. Only the hiring manager can retry it. A finished debrief is never regenerated.
- One sample room per person. It doesn't use the AI.

## Known gaps

- **Invites go out through your own mail app.** Each invite uses its own mailto: link. Sending from the app is not built; it would need a verified sending domain.
- **Invite links are not tied to an email address,** because sign-in doesn't give the app a verified email. Whoever holds a person's unused link can claim that seat.
- **A reveal is two separate saves:** the scores, then the room's status. If something fails between them, the room repairs itself the next time it is opened.
- **No profile pictures.** The menu shows your initial instead, because the security policy only allows images from this site.
