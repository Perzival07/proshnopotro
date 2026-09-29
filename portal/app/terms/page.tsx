import type { Metadata } from "next";
import Link from "next/link";
import { Filled, LegalDoc } from "@/components/legal/LegalDoc";
import { org, PRODUCT_NAME } from "@/lib/org";

export const metadata: Metadata = { title: `Terms of use | ${org.name}` };

/** The rules for using this organisation's portal, as a student. */
export default function TermsPage() {
  const { legal, features } = org;
  const who = <Filled value={legal.entityName} missing="legal name of the organisation" />;

  return (
    <LegalDoc title="Terms of use">
      <p>
        These terms apply when you use the {org.name} portal. By signing in you agree to them. If you are under 18, your parent or
        guardian must agree to them for you.
      </p>

      <h2>1. The portal</h2>
      <p>
        The portal is provided by {who} (&ldquo;{org.name}&rdquo;, &ldquo;we&rdquo;) for its students and staff, and runs on{" "}
        {PRODUCT_NAME}. Your tuition, fees and classes are arranged with {org.name} directly; the portal does not take payments.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>Sign in with your own Google account, and only use your own account.</li>
        <li>Keep the details you give us correct, and do not let anyone else use your account.</li>
        <li>Tell us at once if you think someone else has used it.</li>
      </ul>

      <h2>3. Taking tests fairly</h2>
      <ul>
        <li>Do each test yourself, without help from anyone or anything the test does not allow.</li>
        <li>Do not copy, photograph, record or share question papers, answers or solutions.</li>
        {features.proctoring && (
          <li>
            Proctored tests check that you stay on the test and in full screen, block copying and screenshots
            {features.cameraProctoring ? ", and use your camera to check you are alone and without a phone" : ""}. Breaking these
            rules can end your attempt automatically. See the <Link href="/privacy">privacy notice</Link> for what is and is not
            stored.
          </li>
        )}
        <li>Your tutors decide how answers are marked and may disregard or reopen an attempt that breaks these rules.</li>
      </ul>

      <h2>4. Our material and yours</h2>
      <p>
        Question papers, solutions, notes and videos belong to {org.name} or their authors. You may use them for your own study
        only: do not copy, sell, upload or share them elsewhere. Your answers and answer-sheet photos remain yours; you let{" "}
        {org.name} use them to mark your work, give you feedback and keep your records.
      </p>

      <h2>5. Doubts and messages</h2>
      <p>
        Keep questions and messages about your studies, and polite. Do not post anything unlawful, hurtful, or that belongs to
        someone else.
      </p>

      <h2>6. Availability</h2>
      <p>
        We try to keep the portal working at all times but cannot promise it will never be unavailable or free of errors. A timed
        test&apos;s clock keeps running if you lose your connection, so start tests with a steady connection and enough battery.
        If something goes wrong during a test, tell your tutor straight away.
      </p>

      <h2>7. Ending your access</h2>
      <p>
        We may suspend or close your account if you break these terms or stop studying with us. What happens to your data then is
        explained in the <Link href="/privacy">privacy notice</Link>.
      </p>

      <h2>8. Responsibility</h2>
      <p>
        The portal is provided to support your studies. As far as the law allows, we are not responsible for losses caused by it
        being unavailable, or by mistakes in results that are corrected once found. Nothing in these terms takes away rights you
        have under Indian law.
      </p>

      <h2>9. Law</h2>
      <p>
        These terms are governed by the laws of India. Disputes will be decided by the courts of{" "}
        <Filled value={legal.city} missing="city" />.
      </p>

      <h2>10. Changes and contact</h2>
      <p>
        We may update these terms and will tell you in the portal if a change matters. Questions: call <Filled value={org.support.phoneDisplay || null} missing="phone number" />
        {legal.grievanceOfficer.email ? (
          <>
            {" "}
            or write to <a href={`mailto:${legal.grievanceOfficer.email}`}>{legal.grievanceOfficer.email}</a>
          </>
        ) : null}
        .
      </p>
    </LegalDoc>
  );
}
