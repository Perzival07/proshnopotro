import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarClock,
  Camera,
  CheckCheck,
  CheckCircle2,
  Copy,
  Database,
  FileWarning,
  Fingerprint,
  GraduationCap,
  Languages,
  LayoutDashboard,
  Maximize,
  MessageCircleQuestion,
  MonitorSmartphone,
  Palette,
  PenLine,
  ScanFace,
  Smartphone,
  Timer,
  TimerOff,
  ToggleRight,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Logo } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { ExamMock } from "@/components/ExamMock";
import { Pipeline, PlatformFlow, type PipelineStep } from "@/components/Flow";
import { JoinedOrgs } from "@/components/JoinedOrgs";
import { demoHref, site } from "@/lib/site";
import { showcaseOrgs, type ShowcaseOrg } from "@/lib/showcase";
import { techStack } from "@/lib/tech-stack";

// Organisations come from the master database; a new one shows within five minutes.
export const revalidate = 300;

const highlights = [
  { icon: LayoutDashboard, text: "NTA-style exam screen" },
  { icon: Database, text: "A separate database per organisation" },
  { icon: Languages, text: "Hindi and second-language papers" },
  { icon: Smartphone, text: "Works on any phone, installs as an app" },
];

const marqueeWords = [
  "CBT exam screen",
  "Camera proctoring",
  "Auto-marking",
  "On-screen answer marking",
  "Question bank",
  "Hindi papers",
  "Doubt threads",
  "Parent progress links",
  "Word and CSV import",
  "Classrooms and tutors",
];

const modules = [
  {
    n: "01",
    tag: "Write once",
    color: "#7f85fb",
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
    tag: "Exam day",
    color: "#38bdf8",
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
    tag: "Fair play",
    color: "#fb7185",
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
    tag: "Less evenings",
    color: "#34d399",
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
    tag: "After the exam",
    color: "#ffac3f",
    title: "Stay close",
    body: "Everything after the exam, in the same place as the exam.",
    points: [
      "Progress by subject and chapter over time",
      "Doubt threads on any question",
      "Notes and PDFs shared with a classroom",
      "A private progress link for parents",
    ],
  },
];

const examDay: PipelineStep[] = [
  { icon: CalendarClock, title: "Assign", body: "Set a paper to a classroom. It opens and closes on schedule." },
  { icon: ScanFace, title: "Face check", body: "A quick camera check must pass before the paper opens." },
  { icon: MonitorSmartphone, title: "Sit the paper", body: "An NTA-style screen with timer, palette and calculator." },
  { icon: TimerOff, title: "Auto-submit", body: "At time up, or on the second tab switch." },
  { icon: CheckCheck, title: "Marked", body: "Objective answers at once; written ones on screen." },
  { icon: TrendingUp, title: "Results", body: "Released to students, with a progress link for parents." },
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
  { icon: GraduationCap, title: "Students", body: "Tests, results, progress, notes and doubts, on phone or computer." },
  { icon: PenLine, title: "Teachers", body: "Mark answer sheets and answer doubts for their own classrooms." },
  { icon: Building2, title: "Organisation admins", body: "Tests, classrooms, students, notes, syllabus and the question bank." },
  { icon: Users, title: "Parents", body: "A private, read-only progress link the student can share or revoke." },
  { icon: LayoutDashboard, title: "One sign-in, every organisation", body: "Students enrolled with several organisations pick one from a single hub." },
  { icon: Wallet, title: "Billing page", body: "Each organisation sees its student count, amount due and payment history." },
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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-300">{children}</p>;
}

function Heading({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-[2.6rem] sm:leading-[1.1] ${className}`}>{children}</h2>;
}

/** An organisation's logo, or its initial, for the "Find your portal" list. */
function OrgMark({ org }: { org: ShowcaseOrg }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logoUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center rounded-lg text-lg font-extrabold text-white"
            style={{ background: `linear-gradient(135deg, ${org.color}, #1e1e4b)` }}
          >
            {org.name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span className="font-semibold text-white">{org.name}</span>
    </span>
  );
}

export default async function Home() {
  const organisations = await showcaseOrgs();
  return (
    <div className="bg-night-950 font-display text-slate-200">
      <Header />
      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-dot-grid-dark" />
            <div className="absolute -left-48 -top-24 h-[620px] w-[620px] rounded-full bg-sky-500/25 blur-[120px]" />
            <div className="absolute -right-40 top-40 h-[560px] w-[560px] rounded-full bg-accent-500/25 blur-[120px]" />
            <div className="absolute bottom-[-200px] left-1/3 h-[480px] w-[480px] rounded-full bg-brand-600/30 blur-[120px]" />
          </div>

          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:px-8 lg:pb-28 lg:pt-24">
            <div>
              <p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.25em] text-brand-300">{site.tagline}</p>
              <h1
                className="mt-6 animate-fade-up text-balance text-[2.5rem] font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-[3.6rem] xl:text-[3.9rem]"
                style={{ animationDelay: "80ms" }}
              >
                Every question paper, from <span className="text-gradient-warm">setting</span> to{" "}
                <span className="text-gradient-warm">marking</span>, in one portal.
              </h1>
              <p
                className="mt-6 max-w-xl animate-fade-up text-pretty text-lg leading-relaxed text-slate-300"
                style={{ animationDelay: "160ms" }}
              >
                Proshnopotro gives your tuition centre its own exam portal: papers students sit on a real CBT screen,
                proctoring that holds up, marking on screen, and progress every student and parent can see.
              </p>
              <div className="mt-9 flex animate-fade-up flex-wrap items-center gap-3" style={{ animationDelay: "240ms" }}>
                <a
                  href={demoHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-400"
                >
                  Book a demo <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-night-900/80 px-6 py-3.5 text-base font-semibold text-white transition hover:border-white/30 hover:bg-night-800"
                >
                  See how it works
                </a>
                <a href="/hub" className="inline-flex items-center gap-1.5 px-3 py-3.5 text-base font-semibold text-slate-300 transition hover:text-white">
                  Log in <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="relative animate-fade-up" style={{ animationDelay: "200ms" }}>
              <div aria-hidden="true" className="absolute inset-6 -z-10 rounded-3xl bg-brand-500/30 blur-3xl" />
              <ExamMock />
            </div>
          </div>
        </section>

        {/* Organisations that have joined */}
        {organisations.length > 0 && (
          <section id="joined" aria-labelledby="joined-heading" className="border-y border-white/10 bg-night-900/80">
            <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 lg:px-8">
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-300">Our organisations</p>
                <h2 id="joined-heading" className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  The organisations that have <span className="text-gradient-warm">joined us</span>
                </h2>
              </div>
              <div className="mt-8">
                <JoinedOrgs orgs={organisations} />
              </div>
            </div>
            <div className="mask-fade-x overflow-hidden border-t border-white/5 py-3" aria-hidden="true">
              <div className="flex w-max animate-marquee gap-12 whitespace-nowrap">
                {[...marqueeWords, ...marqueeWords].map((w, i) => (
                  <span key={i} className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Problem */}
        <section className="bg-night-950">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
            <Reveal>
              <Eyebrow>The problem</Eyebrow>
              <Heading>Tuition exams still run on chat groups and forms.</Heading>
              <p className="mt-5 text-lg leading-relaxed text-slate-400">
                The paper goes out as a file, answers come back as photos, and marks end up in a sheet. Every step
                leaks time, and some of them leak the paper.
              </p>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {pains.map(({ icon: Icon, text }, i) => (
                <Reveal key={text} delay={i * 80}>
                  <div className="h-full rounded-2xl border border-white/10 bg-night-900 p-5 transition hover:border-rose-400/40">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-4 font-medium leading-snug text-slate-100">{text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Platform: the flow diagram and its five parts */}
        <section id="platform" className="relative isolate border-t border-white/5 bg-night-900/60">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <Reveal className="mx-auto max-w-3xl text-center">
              <Eyebrow>The platform</Eyebrow>
              <Heading>
                From your papers to a parent&apos;s phone, <span className="text-gradient-warm">in one flow</span>.
              </Heading>
              <p className="mt-5 text-lg leading-relaxed text-slate-400">
                Bring papers in however you have them. Proshnopotro turns each one into a proctored, marked and tracked exam.
              </p>
            </Reveal>

            <Reveal className="mt-14">
              <PlatformFlow
                eyebrow="One portal"
                headline="Turns every question paper into an exam students sit, you mark and parents see."
                inputs={["Word and CSV files", "Your question bank", "Google Form, Doc, PDF"]}
                outputs={modules.map((m) => ({ label: m.title, color: m.color }))}
              />
            </Reveal>

            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-6">
              {modules.map((m, i) => (
                <Reveal key={m.n} delay={(i % 3) * 80} className={i < 3 ? "lg:col-span-2" : "lg:col-span-3"}>
                  <article className="group h-full rounded-2xl border border-white/10 bg-night-900 p-6 transition hover:-translate-y-1 hover:border-white/20">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: m.color }}>
                          {m.tag}
                        </p>
                        <h3 className="mt-1 text-xl font-bold text-white">{m.title}</h3>
                      </div>
                      <span className="font-mono text-sm font-semibold text-slate-600 transition group-hover:text-slate-300">{m.n}</span>
                    </div>
                    <p className="mt-3 border-t border-white/5 pt-3 text-slate-400">{m.body}</p>
                    <ul className="mt-4 space-y-2.5">
                      {m.points.map((p) => (
                        <li key={p} className="flex gap-2.5 text-sm text-slate-300">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: m.color }} />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* How it works: exam day */}
        <section id="how-it-works" className="relative isolate overflow-hidden border-t border-white/5 bg-night-950">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-dot-grid-dark" />
            <div className="absolute left-1/2 top-1/2 h-[420px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/20 blur-[120px]" />
          </div>
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <Reveal className="max-w-3xl">
              <Eyebrow>How it works</Eyebrow>
              <Heading>
                Exam day, <span className="text-gradient-warm">step by step</span>.
              </Heading>
              <p className="mt-5 text-lg leading-relaxed text-slate-400">
                Nothing to collect, forward or total up. Each step starts the next one by itself.
              </p>
            </Reveal>
            <Reveal className="mt-14">
              <Pipeline steps={examDay} />
            </Reveal>
          </div>
        </section>

        {/* Proctoring */}
        <section id="proctoring" className="relative isolate overflow-hidden border-t border-white/5 bg-night-900/60">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full bg-brand-500/20 blur-[120px]" />
            <div className="absolute -bottom-40 left-0 h-[420px] w-[420px] rounded-full bg-accent-500/10 blur-[120px]" />
          </div>
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <Reveal className="max-w-3xl">
              <Eyebrow>Proctoring</Eyebrow>
              <Heading>An exam hall, without the hall.</Heading>
              <p className="mt-5 text-lg leading-relaxed text-slate-400">
                Strikes are counted on the server, so a reload never resets them. No video is saved or sent: the camera
                works on the student&apos;s own device and only the flags reach the tutor.
              </p>
            </Reveal>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {proctoring.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={(i % 3) * 80}>
                  <div className="h-full rounded-2xl border border-white/10 bg-night-900 p-6 transition hover:border-brand-400/40">
                    <Icon className="h-6 w-6 text-brand-300" />
                    <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Who it is for */}
        <section className="border-t border-white/5 bg-night-950">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <Reveal className="max-w-3xl">
              <Eyebrow>Who it is for</Eyebrow>
              <Heading>A view for everyone in the classroom.</Heading>
            </Reveal>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {people.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={(i % 3) * 80}>
                  <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-night-900 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <Icon className="h-6 w-6 text-brand-300" />
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                        Live
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Your portal */}
        <section className="border-t border-white/5 bg-night-900/60">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-28">
            <Reveal>
              <Eyebrow>Your portal</Eyebrow>
              <Heading>Your name on the door. Your data behind it.</Heading>
              <p className="mt-5 text-lg leading-relaxed text-slate-400">
                Every organisation runs its own copy of Proshnopotro, set up for it. Students see your brand, not ours.
              </p>
              <ul className="mt-8 space-y-3">
                {highlights.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                    <Icon className="h-5 w-5 shrink-0 text-brand-300" />
                    {text}
                  </li>
                ))}
              </ul>
            </Reveal>
            <div className="space-y-4">
              {yours.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={i * 80}>
                  <div className="flex gap-5 rounded-2xl border border-white/10 bg-night-900 p-6">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-600 text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{title}</h3>
                      <p className="mt-1 text-slate-400">{body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Organisations / log in */}
        <section id="organisations" className="border-t border-white/5 bg-night-950">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <Reveal className="mx-auto max-w-2xl text-center">
              <Eyebrow>Log in</Eyebrow>
              <Heading>Find your portal</Heading>
              <p className="mt-5 text-lg leading-relaxed text-slate-400">Students and staff sign in on their own organisation&apos;s portal.</p>
            </Reveal>
            <div className="mx-auto mt-12 grid max-w-3xl gap-4">
              {organisations.map((org) => (
                <Reveal key={org.slug}>
                  <a
                    href={org.portalUrl}
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-night-900 p-5 transition hover:border-brand-400/50"
                  >
                    <span className="flex items-center gap-4">
                      <OrgMark org={org} />
                      <span className="hidden text-sm text-slate-500 sm:block">{new URL(org.portalUrl).host}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-300">
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
        <section id="pricing" className="border-t border-white/5 bg-night-900/60">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <Reveal>
              <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-night-900 lg:grid-cols-[1.2fr_1fr]">
                <div className="p-8 sm:p-10">
                  <Eyebrow>Pricing</Eyebrow>
                  <Heading className="sm:text-3xl">Pay per student. Nothing else.</Heading>
                  <p className="mt-4 text-lg leading-relaxed text-slate-400">
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
                      <li key={f} className="flex gap-2.5 text-sm text-slate-300">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative isolate flex flex-col justify-center overflow-hidden bg-gradient-to-br from-brand-700 to-night-800 p-8 text-white sm:p-10">
                  <div aria-hidden="true" className="absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full bg-accent-500/30 blur-3xl" />
                  <p className="text-sm font-semibold uppercase tracking-wider text-brand-200">Per enrolled student</p>
                  <p className="mt-3 text-4xl font-extrabold tracking-tight">Talk to us</p>
                  <p className="mt-3 text-white/70">
                    Pricing depends on the size of your roster. Tell us how many students you have and we will send a quote.
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
        <section id="faq" className="border-t border-white/5 bg-night-950">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-28">
            <Reveal>
              <Eyebrow>FAQ</Eyebrow>
              <Heading>Questions, answered.</Heading>
              <p className="mt-5 text-lg leading-relaxed text-slate-400">
                Something else on your mind?{" "}
                <a href={demoHref} className="font-semibold text-brand-300 underline-offset-4 hover:underline">
                  Write to us
                </a>
                .
              </p>
            </Reveal>
            <div className="divide-y divide-white/10 border-y border-white/10">
              {faqs.map(({ q, a }) => (
                <details key={q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold text-white [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-3">
                      <MessageCircleQuestion className="h-5 w-5 shrink-0 text-brand-300" />
                      {q}
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-brand-300 transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 pl-8 leading-relaxed text-slate-400">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-night-950 px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
          <Reveal>
            <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-night-900 px-6 py-16 text-center sm:px-12">
              <div aria-hidden="true" className="absolute inset-0 -z-10 bg-dot-grid-dark" />
              <div aria-hidden="true" className="absolute -left-20 -top-24 -z-10 h-80 w-80 rounded-full bg-sky-500/25 blur-3xl" />
              <div aria-hidden="true" className="absolute -bottom-24 -right-20 -z-10 h-80 w-80 rounded-full bg-accent-500/25 blur-3xl" />
              <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Give your students an exam that feels like <span className="text-gradient-warm">the real one</span>.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">We will set up a portal with your name on it and one of your own papers inside.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a
                  href={demoHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-400"
                >
                  Book a demo <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#platform"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/5"
                >
                  Explore features
                </a>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Technology strip */}
        <section aria-label="Technologies Proshnopotro is built on" className="border-t border-white/10 bg-night-900/80">
          <div className="mx-auto max-w-7xl px-4 pt-10 text-center sm:px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Built on</p>
            <p className="mt-2 text-sm text-slate-500">Hosted in Mumbai, on services trusted by some of the web&apos;s largest products.</p>
          </div>
          <div className="mask-fade-x overflow-hidden py-8">
            <ul className="flex w-max animate-marquee items-center gap-14 [animation-duration:50s] hover:[animation-play-state:paused]">
              {[...techStack, ...techStack].map((t, i) => (
                <li
                  key={i}
                  aria-hidden={i >= techStack.length}
                  className="flex items-center gap-2.5 whitespace-nowrap text-slate-400 transition hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                    <path d={t.path} />
                  </svg>
                  <span className="text-base font-semibold">{t.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-night-950">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              {site.tagline}. Set papers, run proctored exams, mark on screen and track progress.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Platform</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              <li><a href="#how-it-works" className="hover:text-white">How it works</a></li>
              <li><a href="#platform" className="hover:text-white">Features</a></li>
              <li><a href="#proctoring" className="hover:text-white">Proctoring</a></li>
              <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
              <li><a href="#faq" className="hover:text-white">FAQ</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Organisations</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              {organisations.map((org) => (
                <li key={org.slug}><a href={org.portalUrl} className="hover:text-white">{org.name}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Contact</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
              <li><a href={`mailto:${site.contactEmail}`} className="hover:text-white">{site.contactEmail}</a></li>
              <li><a href={demoHref} className="hover:text-white">Book a demo</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
            © {new Date().getFullYear()} {site.name}. All rights reserved.
            <span className="mx-2">·</span>
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <span className="mx-2">·</span>
            <a href="/terms" className="hover:text-white">Terms</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
