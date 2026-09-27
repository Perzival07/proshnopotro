import type { Metadata } from "next";
import Link from "next/link";
import { Filled, LegalDoc } from "@/components/legal/LegalDoc";
import { legal, site } from "@/lib/site";

export const metadata: Metadata = { title: `Privacy policy | ${site.name}` };

/**
 * Proshnopotro's own privacy policy: this website, the student hub, and the
 * registry of which organisation enrolled which email. Inside each
 * organisation's portal the organisation is responsible and has its own
 * notice (portal/app/privacy); Proshnopotro only processes that data for it.
 */
export default function PrivacyPage() {
  const operator = <Filled value={legal.operatorName} missing="legal name of the business running Proshnopotro" />;
  const officer = legal.grievanceOfficer;
  const email = officer.email ?? site.contactEmail;

  return (
    <LegalDoc title="Privacy policy">
      <p>
        {site.name} is an exam and tutoring portal that tuition organisations use under their own name. This policy explains what
        personal data {operator}
        {legal.address ? `, ${legal.address}` : ""} (&ldquo;{site.name}&rdquo;, &ldquo;we&rdquo;) handles, and on whose behalf.
      </p>

      <h2>1. Two different roles</h2>
      <ul>
        <li>
          <strong>Inside an organisation&apos;s portal</strong> (its tests, results, answer photos, doubts and notes), the
          organisation decides how students&apos; data is used and is responsible for it. We run the portal for the organisation and
          process that data only on its instructions. Each portal has its own privacy notice, linked at the bottom of its pages;
          questions about that data are best sent to the organisation.
        </li>
        <li>
          <strong>On this website and its student hub</strong>, and for the list of which organisation has enrolled which email
          address, we are responsible for the data, as described below.
        </li>
      </ul>

      <h2>2. What we collect</h2>
      <ul>
        <li>
          <strong>If you write to us</strong> or book a demo: your name, email address, organisation and what you tell us.
        </li>
        <li>
          <strong>If you sign in to the student hub:</strong> your name and email address from Google.
        </li>
        <li>
          <strong>From each organisation&apos;s portal:</strong> the email addresses of the students it has enrolled, and nothing
          else about them: no names, phone numbers, answers or results.
        </li>
        <li>
          <strong>About organisations we serve:</strong> their contact people, student counts, prices and payment records.
        </li>
        <li>
          <strong>Technical data:</strong> a cookie that keeps you signed in, and our hosting provider&apos;s records of visits (such
          as IP address and browser) to keep the service secure. We do not use analytics or advertising cookies.
        </li>
      </ul>

      <h2>3. Why we use it</h2>
      <ul>
        <li>To answer you and arrange demos.</li>
        <li>To show a student, after they sign in to the hub, which organisations have enrolled them, and take them there.</li>
        <li>To bill each organisation for the students it has enrolled.</li>
        <li>To run, secure and support the service, and to meet our legal obligations.</li>
      </ul>
      <p>We do not sell personal data, advertise to students, or use their data to profile them.</p>

      <h2>4. Who we share it with</h2>
      <p>
        The companies that run our service for us: Vercel (hosting), Supabase (databases), Cloudinary (files in portals) and Google
        (sign-in). They may store or process data outside India, under contracts that require them to protect it. We also share
        data where the law requires it. An organisation never sees which other organisations a student is enrolled with.
      </p>

      <h2>5. How long we keep it</h2>
      <p>
        A student&apos;s email stays on an organisation&apos;s list while that organisation&apos;s portal has them enrolled; it is
        removed at the next nightly update after the organisation removes them, and all of an organisation&apos;s list is deleted
        if it leaves {site.name}. Enquiries are kept while they are useful to answer you, and billing records for as long as tax
        law requires.
      </p>

      <h2>6. Your rights</h2>
      <p>
        Under India&apos;s Digital Personal Data Protection Act, 2023, you can ask us what personal data we hold about you and who we
        have shared it with, to correct or delete it, and to let someone else use these rights for you if you cannot. A parent or
        guardian can do this for a child. For data inside a portal, ask the organisation; we will help it answer you.
      </p>

      <h2>7. Questions and complaints</h2>
      <p>
        Write to our grievance officer, <Filled value={officer.name} missing="name" />, at <a href={`mailto:${email}`}>{email}</a>.
        We will reply as quickly as we can and within the time the law allows. If you are not satisfied, you can complain to the
        Data Protection Board of India.
      </p>

      <h2>8. Security</h2>
      <p>
        Everything is served over encrypted connections. Each organisation has its own separate database, so one organisation can
        never reach another&apos;s data, and our link to each portal is protected by its own secret key.
      </p>

      <h2>9. Changes</h2>
      <p>
        We will post any change here, and tell organisations directly if it matters. See also our <Link href="/terms">terms</Link>.
      </p>
    </LegalDoc>
  );
}
