import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Database,
  Eye,
  FileWarning,
  Fingerprint,
  GraduationCap,
  Languages,
  LayoutDashboard,
  Maximize,
  MessageCircleQuestion,
  Palette,
  PenLine,
  ScanFace,
  Smartphone,
  Timer,
  ToggleRight,
  Users,
  Wallet,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Logo } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { ExamMock } from "@/components/ExamMock";
import { demoHref, organisations, site } from "@/lib/site";

const highlights = [
  { icon: LayoutDashboard, text: "NTA-style exam screen" },
  { icon: Database, text: "A separate database per organisation" },
  { icon: Languages, text: "Hindi and second-language papers" },
  { icon: Smartphone, text: "Works on any phone, installs as an app" },
];

const modules = [
  {
    n: "01",
    title: "Set papers",
    body: "Write papers in the portal or bring them in from Word and CSV.",
    points: [
      "Single and multiple correct, integer, decimal, matrix match, subjective",
      "Maths with proper notation, and images in any question",
      "Per-question translations for a second language",
      "A question bank of past papers, tagged by chapter",
    ],
  },
  {
    n: "02",
    title: "Run exams",
    body: "Students sit papers on a screen modelled on NTA's computer-based test.",
    points: [
      "Timers per paper and per section, with automatic submission",
      "Tests that open and close on schedule",
      "On-screen calculator and per-student shuffling",
      "Google Form, Google Doc and PDF papers too",
    ],
  },
  {
    n: "03",
    title: "Stop cheating",
    body: "Proctoring that runs on the student's device and records every strike.",
    points: [
      "Tab and full-screen guard, counted on the server",
      "Camera face check, with phone and second-face detection",
      "Copy, paste and screenshot blocked; name watermarked on the paper",
      "Flags for answers given suspiciously fast or slow",
    ],
  },
  {
    n: "04",
    title: "Mark faster",
    body: "Objective answers mark themselves. Written ones are marked on screen.",
    points: [
      "Negative and partial marking, per test",
      "Annotate answer-sheet photos and return them with feedback",
      "A marking queue for each teacher",
      "Release results instantly, by hand, or after the deadline",
    ],
  },
  {
    n: "05",
    title: "Keep everyone close",
    body: "Everything after the exam, in the same place as the exam.",
    points: [
      "Progress by subject and chapter over time",
      "Doubt threads on any question",
      "Notes and PDFs shared with a classroom",
      "A private progress link for parents",
    ],
  },
];

const pains = [
  { icon: FileWarning, text: "The paper PDF is forwarded before the exam starts." },
  { icon: Copy, text: "A Google Form cannot tell when a student switches tabs." },
  { icon: PenLine, text: "Answer-sheet photos are scattered across chat threads." },
  { icon: BarChart3, text: "Marks sit in a spreadsheet no student or parent ever sees." },
];

const proctoring = [
  { icon: Maximize, title: "Forced full screen", body: "Leaving full screen or the tab is a strike. The second strike submits the paper." },
  { icon: ScanFace, title: "Face check first", body: "A quick face scan must pass before the paper opens, every time." },
  { icon: Camera, title: "Phone and face detection", body: "The camera watches for a phone, a missing face or a second face." },
  { icon: Copy, title: "Nothing to copy", body: "Copying, pasting and printing are off; the paper is covered during screenshots." },
  { icon: Fingerprint, title: "Watermarked paper", body: "Every page carries the student's name, so a leaked photo names its source." },
  { icon: Timer, title: "Timing flags", body: "Answers given far faster or slower than the class are flagged for the tutor." },
];

const people = [
  { icon: GraduationCap, title: "Students", body: "Tests, results, progress, notes and doubts, on phone or computer.", status: "Live" },
  { icon: PenLine, title: "Teachers", body: "Mark answer sheets and answer doubts for their own classrooms.", status: "Live" },
  { icon: Building2, title: "Organisation admins", body: "Tests, classrooms, students, notes, syllabus and the question bank.", status: "Live" },
  { icon: Users, title: "Parents", body: "A private, read-only progress link the student can share or revoke.", status: "Live" },
  { icon: LayoutDashboard, title: "One sign-in, every organisation", body: "Students enrolled with several organisations pick one from a single hub.", status: "Coming soon" },
  { icon: Wallet, title: "Billing page", body: "Each organisation sees its student count, amount due and payment history.", status: "Coming soon" },
];

const yours = [
  { icon: Palette, title: "Your brand", body: "Your name, logo, colours and contact numbers across the portal." },
  { icon: Database, title: "Your data", body: "Your own database and file storage. No other organisation can see it." },
  { icon: ToggleRight, title: "Your rules", body: "Switch proctoring, the camera, the calculator, second language and answer-sheet photos on or off." },
];

const faqs = [
  {
    q: "Do students need to install anything?",
    a: "No. The portal runs in the browser on any phone or computer. Students can also install it as an app from the browser in one tap.",
  },
  {
    q: "Can another organisation see our students or results?",
    a: "No. Every organisation gets its own deployment, its own database and its own file storage. Nothing is shared between them.",
  },
  {
    q: "Which kinds of exam does it handle?",
    a: "JEE and NEET style objective papers marked automatically, board-style written papers answered on paper and photographed, and papers you already have as a Google Form, Google Doc or PDF.",
  },
  {
    q: "Is the camera recording students?",
    a: "No video is saved or sent anywhere. The camera runs on the student's own device to check for a face and a phone, and only the count of flags reaches the tutor.",
  },
  {
    q: "Can papers be in Hindi?",
    a: "Yes. Any paper can carry a second language, question by question, and students switch between the two during the exam.",
  },
  {
    q: "How is it priced, and how do we pay?",
    a: "One price per enrolled student, per month. You pay us directly by bank transfer, UPI or cheque. There is no card checkout inside the app.",
  },
];

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${dark ? "text-brand-300" : "text-brand-600"}`}>
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <>
      <Header />
      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-dot-grid">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -left-40 top-0 h-[520px] w-[520px] rounded-full bg-brand-300/40 blur-3xl" />
            <div className="absolute right-0 top-32 h-[420px] w-[420px] rounded-full bg-accent-400/25 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-[380px] w-[380px] rounded-full bg-sky-500/15 blur-3xl" />
          </div>

          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:py-24">
            <div>
              <div className="animate-fade-up">
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-700 backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
                  {site.tagline}
                </span>
              </div>
              <h1
                className="mt-6 animate-fade-up text-balance text-4xl font-extrabold tracking-tight text-brand-900 sm:text-5xl lg:text-6xl"
                style={{ animationDelay: "80ms" }}
              >
                Every question paper, from <span className="text-gradient">setting</span> to{" "}
                <span className="text-gradient">marking</span>, in one portal.
              </h1>
              <p
                className="mt-6 max-w-xl animate-fade-up text-pretty text-lg leading-relaxed text-slate-600"
                style={{ animationDelay: "160ms" }}
              >
                Proshnopotro gives your tuition centre its own exam portal: papers students sit on a real CBT screen,
                proctoring that holds up, marking on screen, and progress every student and parent can see.
              </p>
              <div className="mt-8 flex animate-fade-up flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
                <a
                  href={demoHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 text-base font-semibold text-white shadow-md shadow-brand-500/30 transition hover:brightness-105"
                >
                  Book a demo <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#platform"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-brand-900 transition hover:border-brand-300 hover:bg-brand-50"
                >
                  See the platform
                </a>
              </div>
              <p className="mt-6 animate-fade-up text-sm text-slate-500" style={{ animationDelay: "320ms" }}>
                Running today at <span className="font-semibold text-brand-900">Classes by Koustav</span>.
              </p>
            </div>

            <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
              <ExamMock />
            </div>
          </div>
        </section>

        {/* Highlights strip */}
        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-x-8 gap-y-4 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {highlights.map(({ icon: Icon, text }) => (
              <p key={text} className="flex items-center gap-3 text-sm font-medium text-brand-900">
                <Icon className="h-5 w-5 shrink-0 text-brand-500" />
                {text}
              </p>
            ))}
          </div>
        </section>

        {/* Problem */}
        <section className="bg-slate-50">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
            <Reveal>
              <Eyebrow>The problem</Eyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
                Tuition exams still run on chat groups and forms.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">
                The paper goes out as a file, answers come back as photos, and marks end up in a sheet. Every step
                leaks time, and some of them leak the paper.
              </p>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {pains.map(({ icon: Icon, text }, i) => (
                <Reveal key={text} delay={i * 80}>
                  <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-4 font-medium leading-snug text-ink">{text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Platform modules */}
        <section id="platform" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <Reveal className="max-w-3xl">
              <Eyebrow>The platform</Eyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
                Five parts, one portal, <span className="text-gradient">no spreadsheets</span>.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">
                From the moment a paper is written to the moment a parent sees the result, every step happens in the
                same place.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {modules.map((m, i) => (
                <Reveal key={m.n} delay={(i % 3) * 80}>
                  <article className="group h-full rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-900/5">
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-xl font-bold text-brand-900">{m.title}</h3>
                      <span className="font-mono text-sm font-semibold text-brand-300 transition group-hover:text-brand-500">
                        {m.n}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-600">{m.body}</p>
                    <ul className="mt-5 space-y-2.5">
                      {m.points.map((p) => (
                        <li key={p} className="flex gap-2.5 text-sm text-slate-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </article>
                </Reveal>
              ))}
              <Reveal delay={160}>
                <div className="flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-brand-500 to-sky-600 p-6 text-white">
                  <div>
                    <ClipboardCheck className="h-8 w-8 text-white/80" />
                    <h3 className="mt-4 text-xl font-bold">See it with your own papers</h3>
                    <p className="mt-2 text-white/80">
                      Send us one of your papers and we will set it up in a demo portal for you.
                    </p>
                  </div>
                  <a
                    href={demoHref}
                    className="mt-6 inline-flex w-fit items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                  >
                    Book a demo <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Proctoring */}
        <section id="proctoring" className="relative isolate overflow-hidden bg-brand-950 text-white">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-dot-grid-dark" />
            <div className="absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full bg-brand-500/30 blur-3xl" />
            <div className="absolute -bottom-40 left-0 h-[420px] w-[420px] rounded-full bg-sky-500/20 blur-3xl" />
          </div>
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <Reveal className="max-w-3xl">
              <Eyebrow dark>Proctoring</Eyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                An exam hall, without the hall.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-white/70">
                Strikes are counted on the server, so a reload never resets them. No video is saved or sent: the camera
                works on the student&apos;s own device and only the flags reach the tutor.
              </p>
            </Reveal>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {proctoring.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={(i % 3) * 80}>
                  <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:border-white/25 hover:bg-white/10">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-sky-500">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/65">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Who it is for */}
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <Reveal className="max-w-3xl">
              <Eyebrow>Who it is for</Eyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
                A view for everyone in the classroom.
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {people.map(({ icon: Icon, title, body, status }, i) => (
                <Reveal key={title} delay={(i % 3) * 80}>
                  <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span
                        className={
                          status === "Live"
                            ? "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700"
                            : "rounded-full border border-accent-400/40 bg-accent-50 px-2.5 py-0.5 text-[11px] font-semibold text-accent-600"
                        }
                      >
                        {status}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-brand-900">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Your portal */}
        <section className="bg-slate-50">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-28">
            <Reveal>
              <Eyebrow>Your portal</Eyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
                Your name on the door. Your data behind it.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">
                Every organisation runs its own copy of Proshnopotro, set up for it. Students see your brand, not ours.
              </p>
            </Reveal>
            <div className="space-y-4">
              {yours.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={i * 80}>
                  <div className="flex gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-600 text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-brand-900">{title}</h3>
                      <p className="mt-1 text-slate-600">{body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Organisations / log in */}
        <section id="organisations" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <Reveal className="mx-auto max-w-2xl text-center">
              <Eyebrow>Log in</Eyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">Find your portal</h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">
                Students and staff sign in on their own organisation&apos;s portal.
              </p>
            </Reveal>
            <div className="mx-auto mt-12 grid max-w-3xl gap-4">
              {organisations.map((org) => (
                <Reveal key={org.url}>
                  <a
                    href={org.url}
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
                  >
                    <span className="flex items-center gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <BookOpenCheck className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block font-semibold text-brand-900">{org.name}</span>
                        <span className="block text-sm text-slate-500">{new URL(org.url).host}</span>
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                      Open portal
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </a>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <Reveal>
              <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[1.2fr_1fr]">
                <div className="p-8 sm:p-10">
                  <Eyebrow>Pricing</Eyebrow>
                  <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-900">Pay per student. Nothing else.</h2>
                  <p className="mt-4 text-lg leading-relaxed text-slate-600">
                    One monthly price for each student on your roster. Every feature, every exam, every teacher included.
                  </p>
                  <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                    {[
                      "Your own portal and brand",
                      "Your own database and storage",
                      "Unlimited tests and teachers",
                      "Proctoring and camera checks",
                      "Setup of your first papers",
                      "Pay by bank transfer, UPI or cheque",
                    ].map((f) => (
                      <li key={f} className="flex gap-2.5 text-sm text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col justify-center bg-gradient-to-br from-brand-900 to-brand-700 p-8 text-white sm:p-10">
                  <p className="text-sm font-semibold uppercase tracking-wider text-brand-200">Per enrolled student</p>
                  <p className="mt-3 text-4xl font-extrabold tracking-tight">Talk to us</p>
                  <p className="mt-3 text-white/70">
                    Pricing depends on the size of your roster. Tell us how many students you have and we will send a
                    quote.
                  </p>
                  <a
                    href={demoHref}
                    className="mt-8 inline-flex w-fit items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-brand-800 transition hover:bg-brand-50"
                  >
                    Get a quote <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-28">
            <Reveal>
              <Eyebrow>FAQ</Eyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">Questions, answered.</h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">
                Something else on your mind?{" "}
                <a href={demoHref} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
                  Write to us
                </a>
                .
              </p>
            </Reveal>
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {faqs.map(({ q, a }) => (
                <details key={q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold text-brand-900 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-3">
                      <MessageCircleQuestion className="h-5 w-5 shrink-0 text-brand-400" />
                      {q}
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-brand-500 transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 pl-8 leading-relaxed text-slate-600">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-white px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
          <Reveal>
            <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-sky-600 px-6 py-16 text-center text-white sm:px-12">
              <div aria-hidden="true" className="absolute inset-0 -z-10 bg-dot-grid-dark" />
              <div aria-hidden="true" className="absolute -right-20 -top-20 -z-10 h-72 w-72 rounded-full bg-accent-400/40 blur-3xl" />
              <Eye className="mx-auto h-10 w-10 text-white/80" />
              <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                Give your students an exam that feels like the real one.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
                We will set up a portal with your name on it and one of your own papers inside.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a
                  href={demoHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 shadow-lg transition hover:bg-brand-50"
                >
                  Book a demo <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#platform"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  Explore features
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-600">
              {site.tagline}. Set papers, run proctored exams, mark on screen and track progress.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-900">Platform</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              <li><a href="#platform" className="hover:text-brand-600">Features</a></li>
              <li><a href="#proctoring" className="hover:text-brand-600">Proctoring</a></li>
              <li><a href="#pricing" className="hover:text-brand-600">Pricing</a></li>
              <li><a href="#faq" className="hover:text-brand-600">FAQ</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-900">Organisations</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              {organisations.map((org) => (
                <li key={org.url}><a href={org.url} className="hover:text-brand-600">{org.name}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-900">Contact</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              <li><a href={`mailto:${site.contactEmail}`} className="hover:text-brand-600">{site.contactEmail}</a></li>
              <li><a href={demoHref} className="hover:text-brand-600">Book a demo</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-200">
          <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
            © {new Date().getFullYear()} {site.name}. All rights reserved.
            <span className="mx-2">·</span>
            <a href="/privacy" className="hover:text-brand-600">Privacy</a>
            <span className="mx-2">·</span>
            <a href="/terms" className="hover:text-brand-600">Terms</a>
          </p>
        </div>
      </footer>
    </>
  );
}
