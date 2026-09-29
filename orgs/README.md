# Organisations

Every organisation runs its own copy of the portal (`../portal`, the code is
written once), as its own Vercel project in the same Vercel account, with its
own database.

**Branding lives in the master app.** On an organisation's page in the
master's `/admin`, the Branding section sets its logo image, logo text,
short name, tagline, phone and WhatsApp numbers, colours, feature switches
and legal details. Saving it rebuilds that portal through its Vercel deploy
hook (about three minutes). The portal fetches it while building
(`portal/org-loader.mjs`), makes its app icons and favicon from the logo,
and falls back to this folder if the master cannot be reached.

A folder here is optional. It is the fallback, and what a portal uses when
it is not connected to a master or nothing is saved there. An organisation
without a folder needs the master to build. To move a folder's branding
into the master once: `npm run org:import-branding -- <slug>` in `master/`.

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

1. Create its Supabase database (a new project) and copy its two addresses:
   pooled (port 6543) and direct (5432). Optionally its own Cloudinary
   account; otherwise `SHARED_CLOUDINARY_URL` is used.
2. From `master/`, with `.env.local` loaded (`set -a; source .env.local;
   set +a`) and `VERCEL_TOKEN`, `GITHUB_REPO` and `MASTER_PUBLIC_URL` filled in:

   ```
   npm run add-org -- --slug new-org --name "New Org Academy" --phone 9000000002 \
     --admins owner@neworg.in --database-url "<pooled>" --direct-url "<direct>" \
     [--cloudinary-url cloudinary://...] [--domain neworg.proshnopotro.in] [--price 40]
   ```

   Add `--dry-run` first to check everything without changing anything. It
   creates the tables, registers the organisation in the master, creates its
   Vercel project (Root Directory `portal`, files outside it included, every
   variable set), adds the domain, starts the first deploy and writes
   `orgs/new-org/.env.local` for `db:push:all`.
3. The two steps it prints, which no API can do: add
   `https://<its domain>/api/auth/callback/google` to the shared Google OAuth
   client, and create a Deploy Hook (Vercel project -> Settings -> Git,
   branch `main`) and paste it into the organisation's page in the master.
4. Set its logo, colours and details in the master's Branding section.

No `orgs/<slug>/` folder is needed: its branding lives in the master.

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

## The demo organisation

`orgs/demo` is a portal for trying Proshnopotro: every feature on, no logo,
no contact details. Its Vercel project is an ordinary portal with `ORG=demo`
and its own Supabase database; the master's home page shows "Access demo"
while an organisation with the slug `demo` is active there, and it is left
out of billing totals and the "joined us" list.

Only people added on its People page in the master can sign in; anyone else
sees "Request access", which emails `proshnopotro.by.koustav@gmail.com`. A
student or tutor added there is put in the sample class, and a student gets
the sample paper. "Reset demo data" on its page in the master deletes every
test, attempt, photo, class, note and doubt and writes the sample content
again (`portal/lib/demo.ts`, `lib/demo-reset.ts`); people stay.
