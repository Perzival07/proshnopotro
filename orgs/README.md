# Organisations

One folder per organisation that runs its own Proshnopotro portal. The folder
holds settings only; the portal code lives once, in `../portal`.

```
orgs/
  classes-by-koustav/
    org.json   name, logo text, tagline, contact numbers, colours,
               feature switches, student limit, price per student
    logo.png
```

A portal deployment picks its organisation with the `ORG` environment variable
(the folder name). Without `ORG` it serves `classes-by-koustav`.

`portal/org-loader.mjs` reads `org.json` at build time. Only the branding and
feature switches reach the app (`portal/lib/org.ts`); `limits` and `billing`
never go into a browser bundle. Changes to `org.json` take effect on the next
build or dev-server restart.

Not wired up yet: `features`, `limits.maxStudents` and `billing` are recorded
here but the portal does not act on them. The installed-app icons
(`portal/public/icons`) and a few colours hard-coded in individual modals and
`portal/app/globals.css` are still shared by every organisation.

## Adding an organisation

1. Copy `classes-by-koustav/` to `orgs/<slug>/` and edit `org.json` (its
   `slug` must match the folder name).
2. Create its Supabase database and Cloudinary account; run
   `npx prisma db push` from `portal/` against the new database.
3. Create a Vercel project from this repo: Root Directory `portal`, with
   "Include files outside the Root Directory in the Build Step" on, and its own
   environment variables (`ORG=<slug>`, `DATABASE_URL`, `DIRECT_URL`,
   `AUTH_SECRET`, `AUTH_URL`, `ADMIN_EMAILS`, `AUTH_GOOGLE_ID/SECRET`,
   `CLOUDINARY_*`).
4. Add `https://<its domain>/api/auth/callback/google` as an authorised
   redirect URI on the shared Google OAuth client.
