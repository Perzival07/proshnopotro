# Organisations

One folder per organisation that runs its own Proshnopotro portal. The folder
holds settings only; the portal code lives once, in `../portal`.

```
orgs/
  classes-by-koustav/
    .env.local DIRECT_URL of its database, for db:push:all (git-ignored,
               never committed)
    org.json   name, logo text, tagline, contact numbers, colours,
               feature switches, student limit, price per student
    logo.png
    public/    copied into portal/public at build time
      favicon.ico
      icons/icon-192.png, icon-512.png          installed-app icons
      icons/maskable-192.png, maskable-512.png  (maskable: logo inside the
                                                 middle 80%, full-bleed background)
      icons/apple-icon.png                      180x180, iPhone/iPad home screen
```

A portal deployment picks its organisation with the `ORG` environment variable
(the folder name). Without `ORG` it serves `classes-by-koustav`.

`portal/org-loader.mjs` reads `org.json` at build time and copies the
folder's `public/` into `portal/public`, plus an offline page in the
organisation's colours. Those copies are git-ignored: edit them here, never in
`portal/public`. The build stops if an icon or colour is missing. Only the branding and
feature switches reach the app (`portal/lib/org.ts`); `limits` and `billing`
never go into a browser bundle. Changes to `org.json` take effect on the next
build or dev-server restart.

## Feature switches

`features` overrides every test (`portal/lib/org-features.ts`). A switch that
is off hides its option from the test form and turns it off in the exam; one
that is on leaves each test as its tutor set it. Test settings are never
rewritten, so turning a switch back on restores each test's own choice.

| Switch              | When off                                                              |
|---------------------|-----------------------------------------------------------------------|
| `proctoring`        | No tab/full-screen guard, copy or screenshot block, watermark or camera |
| `cameraProctoring`  | Proctored tests keep the tab guard but skip the camera and face scan   |
| `calculator`        | No on-screen calculator                                               |
| `secondLanguage`    | Translations are hidden and cannot be added (they are kept)           |
| `answerSheetUpload` | Built-in question papers skip the photo upload after the paper. Google Doc, PDF and Form papers still collect photos, since that is how they are answered. Subjective questions tell students to write on paper, so avoid them when this is off |

## Privacy notice and terms

Each portal has `/privacy` and `/terms`, issued in the organisation's name
(it is responsible for its students' data under India's DPDP Act). They
read `legal` in `org.json`: `entityName` (legal name), `address`, `city`
(for the courts clause) and `grievanceOfficer` (`name`, `email`). Anything
missing shows as a highlighted gap. Both pages carry a "draft" banner until
`effectiveDate` (`YYYY-MM-DD`) is set: set it only after a lawyer has
reviewed them and the organisation collects parents' consent for students
under 18.

## Colours

All seven are required, as `#RRGGBB`: `navy` (headings, primary buttons,
browser theme colour), `blue` (links, focus rings, accents), `tint` (light
backgrounds), `page` (page background), `ink` (body text), `border`, and
`onDark` (a light accent that reads on navy: sidebar icons, the logo on dark
bars, spinners on dark buttons). Status colours (green, amber, grey) and
error red are the same for every organisation.

`limits.maxStudents` and `billing` here are not used by the portal. The
price, student limit and payments that count live in the master app
(`master/`, `/admin`), per organisation.

## Adding an organisation

1. Copy `classes-by-koustav/` to `orgs/<slug>/`, edit `org.json` (its
   `slug` must match the folder name) and replace the icons in `public/`.
2. Create its Supabase database and Cloudinary account. Put the database's
   direct address in `orgs/<slug>/.env.local` as `DIRECT_URL=...` (git
   ignores it), then run `npm run db:push:all -- --apply --only <slug>` from
   `portal/` to create its tables.
3. Create a Vercel project from this repo: Root Directory `portal`, with
   "Include files outside the Root Directory in the Build Step" on, and its own
   environment variables (`ORG=<slug>`, `DATABASE_URL`, `DIRECT_URL`,
   `AUTH_SECRET`, `AUTH_URL`, `ADMIN_EMAILS`, `AUTH_GOOGLE_ID/SECRET`,
   `CLOUDINARY_*`).
4. Add `https://<its domain>/api/auth/callback/google` as an authorised
   redirect URI on the shared Google OAuth client.
5. Add it in the master's `/admin`, put the `MASTER_URL` and
   `MASTER_SYNC_SECRET` shown there into the portal's Vercel project,
   redeploy, and press "Sync now".

## Changing the database schema

Every organisation has its own database, so a change to
`portal/prisma/schema.prisma` has to reach each of them. From `portal/`:

```
npm run db:push:all                  # show each database's changes as SQL
npm run db:push:all -- --apply       # make them
```

`--only a,b` limits it to some organisations. A change that would drop a
column or table with data in it is refused until you add
`--accept-data-loss` (with `--apply`); read the SQL first. The script reads
each database's address from `orgs/<slug>/.env.local` (`DIRECT_URL`, not the
pooled `DATABASE_URL`) and skips organisations without one. Run it before
deploying the portal change, so no organisation's new code meets an old
database.
