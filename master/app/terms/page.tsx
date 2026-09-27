import type { Metadata } from "next";
import Link from "next/link";
import { Filled, LegalDoc } from "@/components/legal/LegalDoc";
import { legal, site } from "@/lib/site";

export const metadata: Metadata = { title: `Terms | ${site.name}` };

/**
 * Proshnopotro's terms: mainly the agreement with the tuition organisations
 * that use it, plus a short part for anyone using this website or the hub.
 * Students using a portal are covered by that organisation's own terms
 * (portal/app/terms).
 */
export default function TermsPage() {
  const operator = <Filled value={legal.operatorName} missing="legal name of the business running Proshnopotro" />;

  return (
    <LegalDoc title="Terms">
      <p>
        These terms are between {operator} (&ldquo;{site.name}&rdquo;, &ldquo;we&rdquo;) and each tuition organisation that uses{" "}
        {site.name} (&ldquo;you&rdquo;). Section 11 also covers anyone using this website or the student hub. Students using an
        organisation&apos;s portal agree to that organisation&apos;s own terms, linked at the bottom of its pages.
      </p>

      <h2>1. The service</h2>
      <p>
        We give your organisation its own portal, under your name and colours, with its own separate database: tests and question
        papers, proctored exams, on-screen marking of answer sheets, results and progress, doubts, notes and classrooms. We host,
        maintain and support it.
      </p>

      <h2>2. Your staff</h2>
      <p>
        You decide who your owners and tutors are, and you are responsible for what they do in the portal. Tell us at once if you
        think an account has been misused.
      </p>

      <h2>3. Your students&apos; data</h2>
      <p>
        You decide how your students&apos; personal data is used, so under India&apos;s Digital Personal Data Protection Act, 2023
        you are responsible for it, and you agree to:
      </p>
      <ul>
        <li>give your students your portal&apos;s privacy notice, with your own details filled in;</li>
        <li>
          get the consent the law requires, including the consent of a parent or lawful guardian for every student under 18,
          before their data goes into the portal;
        </li>
        <li>add only students you teach, keep your roster up to date, and answer requests from students and parents;</li>
        <li>choose the proctoring features you switch on responsibly.</li>
      </ul>
      <p>In return, for that data we:</p>
      <ul>
        <li>process it only to run your portal and on your instructions, and never sell it or use it for advertising;</li>
        <li>keep it secure and separate from every other organisation&apos;s data;</li>
        <li>use only the providers named in our <Link href="/privacy">privacy policy</Link>, under contracts that protect it;</li>
        <li>tell you without delay if we learn of a breach affecting it, and help you meet your obligations;</li>
        <li>help you answer students&apos; and parents&apos; requests;</li>
        <li>delete it when our agreement ends, as set out in section 7.</li>
      </ul>
      <p>
        We keep a list of your students&apos; email addresses, and nothing else about them, to bill you and so that students can
        find your portal from our website.
      </p>

      <h2>4. Your content</h2>
      <p>
        Your question papers, notes, videos and other material stay yours. You let us store and show them in your portal to run
        the service, and you confirm you have the right to use them. {site.name} itself, its software and design stay ours.
      </p>

      <h2>5. Fees</h2>
      <p>
        You pay a price per enrolled student per month, as agreed with us. Every student account in your portal counts, whether or
        not they took a test that month. You pay us directly, by bank transfer, UPI or another agreed method; the portal does not
        take payments. Your portal&apos;s Billing page shows your student count, amount and payments we have recorded, and we can
        send you a monthly statement.
      </p>

      <h2>6. Suspension</h2>
      <p>
        If a payment is overdue, or your portal is used in breach of these terms, we may suspend it after telling you. While
        suspended, your portal shows students and staff that it is temporarily unavailable; nothing is deleted, and it reopens as
        soon as the matter is settled.
      </p>

      <h2>7. Ending the agreement</h2>
      <p>
        Either of us can end the agreement with 30 days&apos; written notice, or at once if the other seriously breaks these terms.
        Before your portal closes, we can give you a copy of your students&apos; results on request. Within 30 days after it closes,
        we delete your portal&apos;s database and files, and your students&apos; emails from our list, unless the law requires us to
        keep something.
      </p>

      <h2>8. Acceptable use</h2>
      <p>
        Do not use {site.name} for anything unlawful, to upload material you have no right to, to harm or harass anyone, or to try
        to reach data or systems that are not yours.
      </p>

      <h2>9. Availability and responsibility</h2>
      <p>
        We work to keep every portal available and correct, but cannot promise it will never be interrupted or free of errors. As
        far as the law allows, we are not responsible for indirect losses, and our total responsibility to you is limited to the
        fees you paid us in the 12 months before the claim.
      </p>

      <h2>10. Law</h2>
      <p>
        These terms are governed by the laws of India. Disputes will be decided by the courts of{" "}
        <Filled value={legal.city} missing="city" />.
      </p>

      <h2>11. Using this website and the hub</h2>
      <p>
        Anyone may read this website. The student hub is for students to find the portals of organisations that have enrolled
        them: sign in only with your own Google account. Signing in to the hub does not give access to any portal; each portal
        signs you in itself.
      </p>

      <h2>12. Changes and contact</h2>
      <p>
        We will tell organisations about changes to these terms at least 30 days before they apply. Questions:{" "}
        <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>
    </LegalDoc>
  );
}
