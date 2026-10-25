# DrinkMoreWater 💧

A hydration tracker that actually reminds you — real push notifications sent from a
server on a schedule, so they arrive when the app is closed and the phone is locked.
Installable as a PWA on iPhone and Android.

Built for one person who kept forgetting to drink water. Open to anyone who does.

---

## What it does

| | |
|---|---|
| **Personal goal** | 35 ml per kg of body weight, adjusted for activity level and hot climates, or set your own target. |
| **One-tap logging** | Preset sizes plus custom amounts, with undo. On Android the notification carries a *Log 250 ml* button; iOS ignores custom notification actions, so there a tap opens the app instead. |
| **Real reminders** | Web Push sent by a server-side scheduler — not an in-page timer that dies when you close the tab. |
| **Smart pacing** | Nudges only inside your waking hours, only when you are behind pace, and never once the goal is met. |
| **Streaks & levels** | XP for every glass, streaks that only survive if yesterday's goal was met, 11 badges, and levels with titles. |
| **Buddies** | Share a rotatable code to follow someone's progress, send them a nudge, and get told when they hit their goal. Remove a follower at any time and they cannot add you again. |

## Stack

- **Next.js 16** (App Router, React 19, TypeScript) — pages render server-side with data already loaded
- **PostgreSQL** via `pg` with plain SQL — no ORM
- **Web Push** (`web-push` + VAPID) for notifications
- **Magic-link auth** — no passwords stored, sessions are HMAC-signed cookies
- **Vercel** for hosting, **GitHub Actions** as the free reminder scheduler

No client-side state library, no CSS framework. The whole UI is ~1,200 lines.

---

## Deploy it

Two supported paths. **Railway for everything is the recommended one** — this app is
really a scheduled job with a UI attached, and a long-running container suits that far
better than serverless: the database pool is reused instead of churning per invocation,
the scheduler is native, and Postgres stays on the private network.

### Option A — Railway (recommended, ~$5/month)

1. **Create the project.** New Project → Deploy from GitHub → this repo. Add a
   **Postgres** database to the same project.
2. **Link the Postgres service** to the app service so `DATABASE_URL` is injected, or
   copy its connection string.
3. **Generate and install the secrets** from a checkout on your own machine:

   ```bash
   npm install
   railway link                      # choose the APP service, not Postgres
   npm run setup -- --railway
   ```

   This mints `AUTH_SECRET`, `CRON_SECRET` and the VAPID key pair locally, writes them to
   a `0600` `.env.local`, and pushes them into Railway. It prints the project, environment
   and service it is about to write to and waits for confirmation, so secrets cannot land
   on the wrong service. Values go in over stdin rather than as command arguments, which
   keeps them out of your shell history and out of the process list; only the last
   variable triggers a redeploy.
4. **Run the migration:** `npm run db:migrate` (with `DATABASE_URL` set).
5. **Add the scheduler.** New service in the same project → set it to run on a cron
   schedule of `*/15 * * * *` with:

   ```bash
   curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/reminders"
   ```

   Give that service the same `CRON_SECRET` and `APP_URL` variables.
6. Set `APP_URL` to the public domain Railway gives you, and redeploy.

### Option B — Vercel + Neon (free)

1. Create a Neon database and copy the **pooled** connection string (the one with
   `-pooler` in the host). The unpooled one will exhaust connections under serverless.
2. Import the repo into Vercel.
3. From a local checkout: `vercel link`, then `npm run setup -- --vercel`.
4. `npm run db:migrate`.
5. **Set up the scheduler.** The included GitHub Actions workflow runs every 15 minutes.
   Add `APP_URL` and `CRON_SECRET` as repository secrets under
   **Settings → Secrets and variables → Actions**.

   ⚠️ **Read this one.** GitHub disables scheduled workflows in a public repository after
   **60 days without repository activity**. If you stop committing, reminders stop, and
   nothing tells you. Either commit something every couple of months, or use an external
   scheduler instead (below). This is the single most likely way this app fails quietly.

`vercel.json` deliberately declares **no** cron: running two schedulers against the same
endpoint was itself a duplicate-push risk, and Vercel's Hobby plan restricts cron
frequency anyway.

### Watch the scheduler — do this on either path

`/api/health` is public, carries no user data, and returns **503** once the reminder sweep
has gone quiet for two hours:

```json
{ "ok": true, "database": "up", "scheduler": "ok", "lastSweepAgeMinutes": 7 }
```

Point a free monitor (UptimeRobot, cron-job.org, Better Stack) at it. That is what turns a
dead scheduler into an email instead of a girlfriend who quietly stopped getting reminders.
The app also warns on its own main screen when no reminder has fired for a day.

### Environment variables

`npm run setup` generates everything except the two you supply.

| Variable | Supplied by | Purpose |
|---|---|---|
| `DATABASE_URL` | you | Postgres connection string |
| `AUTH_SECRET` | generated | Signs session cookies |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | generated | Push public key — safe to expose |
| `VAPID_PRIVATE_KEY` | generated | Push private key — **secret** |
| `VAPID_SUBJECT` | prompted | `mailto:` contact for push services |
| `CRON_SECRET` | generated | Bearer token the scheduler must present |
| `APP_URL` | prompted | Public URL, used to build sign-in links |
| `RESEND_API_KEY` | optional | Sends sign-in emails; without it they go to the server log |
| `EMAIL_FROM` | optional | Sender address for sign-in emails |
| `DATABASE_SSL_NO_VERIFY` | optional | Only for a provider with a self-signed cert. Disables certificate verification — avoid |

Rotating `VAPID_PRIVATE_KEY` unsubscribes every device. Rotating `AUTH_SECRET` signs
everyone out. `npm run setup` keeps existing values unless you pass `--rotate`.

## Run it locally

```bash
npm install
npm run setup        # generates every secret, prompts for DATABASE_URL
npm run db:migrate
npm run dev
```

Without `RESEND_API_KEY`, the sign-in link is printed to the terminal and shown on the
login page — no email account needed.

Push notifications need HTTPS, so they will not work on `http://localhost` in most
browsers. Everything else does.

---

## Installing on a phone

**Android / Chrome** — open the site and accept the install prompt, or use ⋮ → *Add to Home screen*.

**iPhone / Safari** — this one matters: iOS only allows push notifications for apps
installed to the Home Screen. Open the site in Safari, tap **Share → Add to Home Screen**,
then open it **from the Home Screen icon** and turn on reminders there. Requires iOS 16.4+.
The app detects this and says so rather than silently failing.

---

## How the reminder logic works

Each time the scheduler runs, every user with at least one registered device is checked:

1. **Asleep?** Local time outside their wake–sleep window → skip. Reminders never wake anyone.
2. **Too soon?** Less than their chosen interval since the last nudge → skip.
3. **Done?** Already at or past today's goal → skip.
4. **Ahead of pace?** With smart pacing on, someone ahead of where they should be → skip.
5. Otherwise, send a varied, friendly nudge with a *Log 250 ml* action button.

All day boundaries and clock times are computed in each user's own IANA timezone, so a
glass at 1am counts for the right day wherever they are. Subscriptions that a browser has
discarded (HTTP 404/410) are pruned automatically.

## Project layout

```
src/
├── app/
│   ├── api/              REST endpoints (intake, stats, settings, push, buddy, cron)
│   ├── app/              Today — the main tracker
│   ├── progress/         History chart, streaks, badges
│   ├── buddies/          Buddy codes, following, nudges
│   ├── settings/         Goal, reminders, profile
│   ├── onboarding/       First-run goal setup
│   └── login/            Magic-link sign-in
├── components/           Ring, Nav, Toast, Confetti
└── lib/
    ├── db.ts             Pooled Postgres access
    ├── session.ts        HMAC-signed session cookies
    ├── auth.ts           Magic-link tokens, rate limiting
    ├── intake.ts         Logging a drink and its reward side effects
    ├── snapshot.ts       The client-facing view of a user
    ├── rewards.ts        Streaks and badge awarding
    ├── progression.ts    Badge catalogue and level maths (pure)
    ├── goal.ts           Goal calculation and pacing
    ├── push.ts           Web Push delivery
    └── time.ts           Timezone-aware day and clock handling
    └── buddies.ts        Buddy lists, followers and blocking
db/schema.sql             Database schema (additive, safe to re-run)
scripts/setup-env.mjs     Generates secrets and installs them in your host
```

---

## A note on safety

This is a habit tracker, not medical advice. The recommended goal is a general rule of
thumb, and the app caps a single entry at 3 litres and warns when a day's total runs far
past the goal — drinking far more water than you need is not better for you, and in
extreme cases is genuinely dangerous.

If you have a heart, kidney or liver condition, or a doctor has given you a fluid target,
follow theirs rather than this app's.

## Licence

MIT
