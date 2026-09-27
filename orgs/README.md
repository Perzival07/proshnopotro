# Organisations

One folder per organisation that runs its own Proshnopotro portal. The folder
holds settings only; the portal code lives once, in `../portal`.

```
orgs/
  classes-by-koustav/
    org.json   name, logo text, tagline, contact numbers, colours,
               feature switches, student limit, price per student
    logo.png
    public/    copied into portal/public at build time
      favicon.ico
      icons/icon-192.png, icon-512.png          installed-app icons
      icons/maskable-192.png, maskable-512.png  (maskable: logo inside the
                                                 middle 80%, full-bleed background)
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

## Colours

All seven are required, as `#RRGGBB`: `navy` (headings, primary buttons,
browser theme colour), `blue` (links, focus rings, accents), `tint` (light
backgrounds), `page` (page background), `ink` (body text), `border`, and
`onDark` (a light accent that reads on navy: sidebar icons, the logo on dark
bars, spinners on dark buttons). Status colours (green, amber, grey) and
error red are the same for every organisation.

Not wired up yet: `limits.maxStudents` and `billing` are recorded here but
the portal does not act on them.

## Adding an organisation

1. Copy `classes-by-koustav/` to `orgs/<slug>/`, edit `org.json` (its
   `slug` must match the folder name) and replace the icons in `public/`.
2. Create its Supabase database and Cloudinary account; run
   `npx prisma db push` from `portal/` against the new database.
3. Create a Vercel project from this repo: Root Directory `portal`, with
   "Include files outside the Root Directory in the Build Step" on, and its own
   environment variables (`ORG=<slug>`, `DATABASE_URL`, `DIRECT_URL`,
   `AUTH_SECRET`, `AUTH_URL`, `ADMIN_EMAILS`, `AUTH_GOOGLE_ID/SECRET`,
   `CLOUDINARY_*`).
4. Add `https://<its domain>/api/auth/callback/google` as an authorised
   redirect URI on the shared Google OAuth client.
