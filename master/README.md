# Proshnopotro site (master app)

The public Proshnopotro website: what the product does, pricing, FAQ and a
"Find your portal" list linking to each organisation's portal. It shares no
code or data with `../portal`.

Later this app also becomes the super admin's workspace (organisation list,
billing tracker, the student hub); see Part 2 of the features plan.

- `npm run dev` (port 3001, so it can run beside the portal on 3000)
- Content that changes (contact email, the organisation list) lives in
  `lib/site.ts`.

## Deploying

A separate Vercel project from the same repo: Root Directory `master`, no
environment variables. Its Ignored Build Step can be `git diff --quiet HEAD^
HEAD -- .` so portal changes do not redeploy it.
