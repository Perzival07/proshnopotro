# Proshnopotro master app

One Next.js app with three parts. It shares no code or database with
`../portal`; the two talk over signed HTTP requests.

- `/`: the public Proshnopotro website (content in `lib/site.ts`).
- `/admin`: the super admin's workspace. Organisations (add, edit, suspend,
  reactivate), each one's enrolled-student count, price and amount per month,
  payments received, paid-up-to date and billing status (paid / due /
  overdue, `lib/billing.ts`), and a printable monthly statement. Payments are
  made outside the app; this only records them.
  Each organisation's Branding (logo image, logo text, colours, phone,
  feature switches, legal details; `lib/branding.ts`) is edited here too.
  Saving it calls the portal's Vercel deploy hook, so the portal rebuilds
  with it in about three minutes.
- `/hub`: a student signs in with Google and sees every organisation that
  has enrolled their email, then goes to that portal to sign in. With exactly
  one organisation they go straight there.

## Commands

- `npm run dev` (port 3001, beside the portal on 3000)
- `npm test` (vitest, `lib/**/*.test.ts`)
- `npx prisma db push` against the master's own database
- `npm run org:import-branding -- <slug>`: copy `../orgs/<slug>/org.json`
  into the master's branding for that organisation, once

Environment: see `.env.example`. `SUPER_ADMIN_EMAILS` decides who can open
`/admin`, checked on every request. Locally, an email-only "quick login"
appears on `/login`; it is off in production unless `ENABLE_DEV_LOGIN=true`,
which must never be set on the live site.

## How the master and a portal talk

Each organisation has a sync secret, made when it is added and shown on its
page. The portal holds it as `MASTER_SYNC_SECRET` next to `MASTER_URL`.
Requests either way are signed with it (`lib/signature.ts`, copied in
`portal/lib/master-signature.ts`) and expire after five minutes.

- Master -> portal `GET /api/master/roster`: the portal's student emails
  (every `STUDENT` account). Run by "Sync now" and nightly by the Vercel cron
  in `vercel.json` (`/api/cron/sync`, 03:00 IST, needs `CRON_SECRET`).
- Portal build -> master `GET /api/portal/<slug>/branding`: the branding and
  logo, in the shape of an `orgs/<slug>/org.json`; 404 until some is saved
  here, and the portal then uses its `orgs/` folder.
- Portal -> master `GET /api/portal/<slug>/status`: suspended or not, and the
  owner's billing page. The portal caches the answer for five minutes, so a
  suspension or payment shows there within five minutes. If the master cannot
  be reached the portal stays open.

The master stores only student emails and which organisation enrolled them.

## Deploying

A separate Vercel project from the same repo: Root Directory `master`, its
own Postgres database, and the variables in `.env.example`. Add
`<master address>/api/auth/callback/google` to the shared Google OAuth
client. Its Ignored Build Step can be `git diff --quiet HEAD^ HEAD -- .` so
portal changes do not redeploy it.
