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
| **One-tap logging** | Preset sizes plus custom amounts, with undo. Notification action buttons log a glass without opening the app. |
| **Real reminders** | Web Push sent by a server-side scheduler — not an in-page timer that dies when you close the tab. |
| **Smart pacing** | Nudges only inside your waking hours, only when you are behind pace, and never once the goal is met. |
| **Streaks & levels** | XP for every glass, streaks that only survive if yesterday's goal was met, 11 badges, and levels with titles. |
| **Buddies** | Share a code to follow someone's progress, send them a nudge, and get told when they hit their goal. |

## Stack

- **Next.js 16** (App Router, React 19, TypeScript) — pages render server-side with data already loaded
- **PostgreSQL** via `pg` with plain SQL — no ORM
- **Web Push** (`web-push` + VAPID) for notifications
- **Magic-link auth** — no passwords stored, sessions are HMAC-signed cookies
- **Vercel** for hosting, **GitHub Actions** as the free reminder scheduler

No client-side state library, no CSS framework. The whole UI is ~1,200 lines.

---

## Deploy it

### 1. Database

Create a Postgres database (Neon, Supabase and Vercel Postgres all have free tiers), then:

```bash
export DATABASE_URL="postgresql://..."
npm run db:migrate
```

### 2. Generate keys

```bash
npm run vapid                                                      # push keys
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"   # CRON_SECRET
```

### 3. Environment variables

Copy `.env.example` and fill it in. On Vercel these go in **Project → Settings → Environment Variables**.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `AUTH_SECRET` | yes | Signs session cookies (32+ random chars) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | yes | Push public key — safe to expose |
| `VAPID_PRIVATE_KEY` | yes | Push private key — **keep secret** |
| `VAPID_SUBJECT` | yes | `mailto:` address for push services |
| `CRON_SECRET` | yes | Shared secret the scheduler must present |
| `APP_URL` | no | Public URL, used to build sign-in links |
| `RESEND_API_KEY` | no | Sends sign-in emails. Without it, links are printed to the server log |
| `EMAIL_FROM` | no | Sender for sign-in emails |

Changing `VAPID_PRIVATE_KEY` later invalidates every existing push subscription.

### 4. Deploy

Push to GitHub and import the repo into Vercel. No build configuration needed.

### 5. Wire up the scheduler

Reminders only go out when something calls `/api/cron/reminders` every so often.

**Free path (recommended):** the included GitHub Actions workflow runs every 15 minutes.
Add two repository secrets under **Settings → Secrets and variables → Actions**:

- `APP_URL` — e.g. `https://your-app.vercel.app`
- `CRON_SECRET` — the same value as in your Vercel environment

**Vercel Cron:** `vercel.json` already declares a 15-minute schedule, but Vercel's Hobby
plan only runs cron jobs once a day. On a Pro plan it works as declared and you can delete
`.github/workflows/reminders.yml`.

You can always trigger a sweep by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/reminders
```

It returns how many users were considered, nudged and skipped.

---

## Run it locally

```bash
npm install
cp .env.example .env.local      # fill in DATABASE_URL, AUTH_SECRET, VAPID keys, CRON_SECRET
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
db/schema.sql             Database schema
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
