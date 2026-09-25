# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Proshnopotro: a test-taking / tutoring portal (npm package name `test-taker`). Next.js 15 App Router, React 18, Prisma (Postgres/Supabase), Auth.js v5 beta, Tailwind + Radix UI, Cloudinary for answer-sheet photos. Deployed on Vercel (region `bom1`).

## Commands

- `npm run dev` / `npm run build` / `npm start` / `npm run lint`
- `npm test` (vitest, one run); `npm run test:watch`
- Single test: `npx vitest run lib/score.test.ts` (add `-t "name"` to filter)
- `npx prisma db push` / `npx prisma studio`; `prisma generate` runs on `postinstall`. Seed: `npx tsx prisma/seed.ts`
- Env in `.env.local`: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, `ADMIN_EMAILS` (comma list), `AUTH_GOOGLE_ID/SECRET`, `CLOUDINARY_*`.

## Working rules for this repo

- The user's dev server shares `.next`: never run `next build` in the project dir. Build/serve from a scratchpad copy.
- Finished work is committed and pushed straight to `main`. Leave the untracked `screenshots/`, `scripts/capture-*.mjs`, `.claude/` and the deck PDF alone.

## Architecture

- **Tests only cover `lib/`** (`vitest.config.ts` includes `lib/**/*.test.ts`, alias `@` = repo root, `TZ=UTC` forced). Business logic is deliberately kept in pure-ish `lib/*.ts` modules (scoring, marking, scheduling, timers, permissions, import parsing) so it is testable; `app/` is mostly pages plus server actions. Dates must be rendered with an explicit `timeZone` (prod is UTC, users are IST).
- **Routes** (`app/`): student side is `(home)`, `test/[assignmentId]`, `progress`, `doubts`, `notes`, `report`, `onboarding`, `login`. Staff side is `app/admin/*` (assign, bank, classrooms, doubts, mark/marking, notes, results, roster, series, students, syllabus, team, tests). Each feature folder typically has `page.tsx`, a `*Client.tsx`, and an `actions.ts` of server actions. `app/api` holds only auth, health and dashboard-signature.
- **Auth** (`auth.ts`, `auth.config.ts`): JWT sessions, Google provider, plus a dev-only email "Quick Login" Credentials provider (disabled in production unless `ENABLE_DEV_LOGIN=true`; it mints ADMIN accounts, never enable on the live site). Emails in `ADMIN_EMAILS` are auto-promoted to ADMIN at sign-in. The JWT copies the DB profile only at sign-in/explicit update, so it can be stale.
- **Authorization must go through `getVerifiedSession()` in `lib/auth-utils.ts`**, which re-reads the DB, not the JWT. Roles: STUDENT, TUTOR, ADMIN. `lib/permissions.ts` defines the tutor scope: tutors only mark answer sheets and answer doubts for students in classrooms they are assigned to; everything else is owner-only by default. Related guards: `lib/admin-guards.ts` tests, `lib/note-access.ts`.
- **Data model** (`prisma/schema.prisma`): `Test` (sections, passages, questions; formats/kinds/result-release enums) is assigned to students as `Assignment` (status ASSIGNED/SUBMITTED, due/start times) which yields `QuestionResponse`s, `AnswerImage`s and a `Result`. Also `Classroom`/`ClassroomMember`/`ClassroomTutor`, `Doubt`/`DoubtMessage`, `Note` + files/targets, `TestSeries`, `Chapter`.
- **Attempt lifecycle**: no background jobs. Timed attempts that expire while the student is away are closed lazily by `lib/close-expired.ts` (called from student-facing pages), which grades via `lib/grade-attempt.ts`. Reopening an attempt deletes its Cloudinary photos (`lib/photo-cleanup.ts`, `lib/cloudinary*.ts`).
- **Content pipeline**: questions come from CSV/DOCX import (`lib/question-import.ts`, `csv.ts`, `docx.ts`), rich text with KaTeX (`lib/rich-text.ts`); tutor annotations on answer photos in `lib/annotations.ts`; proctoring in `lib/proctoring.ts`, `proctor-camera.ts`, `fullscreen.ts`.
- Notifications via WhatsApp links (`lib/whatsapp.ts`); PWA support (`app/manifest.ts`, `lib/pwa-platform.ts`).
