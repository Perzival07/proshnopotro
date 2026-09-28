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
  Each organisation also has contact details (person, email, phone,
  address) and a People page (`/admin/orgs/<slug>/people`): the super admin
  adds, removes and changes the role of its students, tutors and owners,
  carried out in the portal over a signed request (`lib/portal-people.ts`).
  Only the super admin makes owners; owners add their own students and tutors
  in the portal's admin panel, which is the same for every organisation.
  `/admin/people` finds anyone across all organisations by email,
  `/admin/activity` records what each super admin did (`lib/activity.ts`),
  and `/admin/settings` holds extra super admins (beside
  `SUPER_ADMIN_EMAILS`), the default price and the payment instructions
  shown on owners' Billing pages.
- `/hub`: anyone signs in with Google and sees every organisation their email
  belongs to, as a student, tutor or owner, then goes to that portal to sign
  in. With exactly one organisation they go straight there. The public
  pages are set up for search engines (`app/robots.ts`, `app/sitemap.ts`,
  `SITE_URL`), so a search for Proshnopotro finds this site; each portal
  keeps its private pages out of search and links here from its footer.

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

- Master -> portal `GET /api/master/roster`: the portal's people -- student
  emails (every `STUDENT` account, billed) and its owners and tutors with
  their role (shown in the hub, not billed). Run by "Sync now" and nightly by the Vercel cron
  in `vercel.json` (`/api/cron/sync`, 03:00 IST, needs `CRON_SECRET`).
- Master -> portal `POST /api/master/people`: add a student, tutor or
  owner, remove someone (with their tests, results and answer photos), or
  change their role (`portal/lib/master-people.ts`, `portal/lib/people.ts`).
  Owners in the portal's `ADMIN_EMAILS` can only be changed there.
- Portal build -> master `GET /api/portal/<slug>/branding`: the branding and
  logo, in the shape of an `orgs/<slug>/org.json`; 404 until some is saved
  here, and the portal then uses its `orgs/` folder.
- Portal -> master `GET /api/portal/<slug>/status`: suspended or not, and the
  owner's billing page. The portal caches the answer for five minutes, so a
  suspension or payment shows there within five minutes. If the master cannot
  be reached the portal stays open.

The master stores only email addresses, which organisation each belongs to
and as what (student, tutor or owner).

## Deploying

A separate Vercel project from the same repo: Root Directory `master`, its
own Postgres database, and the variables in `.env.example`. Add
`<master address>/api/auth/callback/google` to the shared Google OAuth
client. Its Ignored Build Step can be `git diff --quiet HEAD^ HEAD -- .` so
portal changes do not redeploy it.
