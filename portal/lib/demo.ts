/**
 * The demo organisation (orgs/demo): a portal anyone the super admin approves
 * can try, reset from the master's "Reset demo data" button
 * (/api/master/demo/reset). Everything here is pure, so the sample content is
 * tested; lib/demo-reset.ts writes it.
 */
import type { AnswerKey, MarkingScheme } from "@/lib/marking";
import { SCHEME_PRESETS } from "@/lib/marking";

/** The organisation slug (ORG) the demo runs as. Nothing demo-only happens elsewhere. */
export const DEMO_SLUG = "demo";

/** Where visitors without access write to ask for it. */
export const DEMO_ACCESS_EMAIL = "proshnopotro.by.koustav@gmail.com";

/** A prefilled email asking for demo access. */
export function requestAccessHref(email?: string | null): string {
  const subject = "Proshnopotro demo access";
  const body = `Hello,\n\nPlease give me access to the Proshnopotro demo${email ? ` with the Google account ${email}` : ""}.\n\nName:\nOrganisation:\nRole (student, tutor or owner):\n`;
  return `mailto:${DEMO_ACCESS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export type DemoQuestion = {
  type: AnswerKey["type"];
  stem: string;
  options: { id: string; text: string }[];
  key: AnswerKey;
  solution: string;
};

export const DEMO_CLASSROOM = { name: "Demo class", subject: "General", description: "Every demo student and tutor is in this class." };

export const DEMO_TEST = {
  title: "Sample paper",
  subject: "General",
  description: "A short paper with one question of each kind: single and multiple choice, integer, decimal and written.",
  durationMinutes: 20,
  markingScheme: SCHEME_PRESETS.JEE_MAIN.scheme satisfies MarkingScheme,
  /** How long the sample test stays open after a reset or after someone is added. */
  openDays: 30,
};

export const DEMO_SECTIONS: { title: string; questions: DemoQuestion[] }[] = [
  {
    title: "Mathematics",
    questions: [
      {
        type: "SINGLE",
        stem: "What is $2^{10}$?",
        options: [
          { id: "A", text: "512" },
          { id: "B", text: "1024" },
          { id: "C", text: "2048" },
          { id: "D", text: "1000" },
        ],
        key: { type: "SINGLE", options: ["B"] },
        solution: "$2^{10} = 2^5 \\times 2^5 = 32 \\times 32 = 1024$.",
      },
      {
        type: "MULTIPLE",
        stem: "Which of these numbers are prime?",
        options: [
          { id: "A", text: "2" },
          { id: "B", text: "9" },
          { id: "C", text: "11" },
          { id: "D", text: "15" },
        ],
        key: { type: "MULTIPLE", options: ["A", "C"] },
        solution: "9 = 3 × 3 and 15 = 3 × 5; 2 and 11 have no divisors but 1 and themselves.",
      },
      {
        type: "INTEGER",
        stem: "How many sides does a hexagon have?",
        options: [],
        key: { type: "INTEGER", values: [6] },
        solution: "Hexa- means six.",
      },
      {
        type: "DECIMAL",
        stem: "Give the value of $\\pi$ to two decimal places.",
        options: [],
        key: { type: "DECIMAL", min: 3.14, max: 3.14 },
        solution: "$\\pi = 3.14159\\ldots$, which is 3.14 to two decimal places.",
      },
    ],
  },
  {
    title: "Science",
    questions: [
      {
        type: "SUBJECTIVE",
        stem: "In two or three sentences, explain why the sky looks blue.",
        options: [],
        key: { type: "SUBJECTIVE" },
        solution:
          "Sunlight is scattered by the molecules of the air, and shorter (blue) wavelengths are scattered far more than longer (red) ones, so blue light reaches the eye from every part of the sky.",
      },
    ],
  },
];

export const DEMO_NOTE = {
  title: "Welcome to the demo",
  subject: "General",
  description: "Notes can carry files or a link, and go to whole classes or single students.",
  linkUrl: "https://en.wikipedia.org/wiki/Rayleigh_scattering",
};
