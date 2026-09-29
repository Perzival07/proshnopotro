import type { Metadata } from "next";
import Link from "next/link";
import { Filled, LegalDoc } from "@/components/legal/LegalDoc";
import { org, PRODUCT_NAME } from "@/lib/org";

export const metadata: Metadata = { title: `Privacy notice | ${org.name}` };

/**
 * The privacy notice students (and their parents) read. It is issued in the
 * organisation's name, because the organisation decides what student data is
 * for (the Data Fiduciary under India's DPDP Act, 2023); Proshnopotro runs the
 * portal for it. Keep every statement here true of the code: the sections on
 * proctoring, the camera and answer photos follow the organisation's feature
 * switches.
 */
export default function PrivacyPage() {
  const { legal, features } = org;
  const who = <Filled value={legal.entityName} missing="legal name of the organisation" />;
  const officer = legal.grievanceOfficer;

  return (
    <LegalDoc title="Privacy notice">
      <p>
        This notice explains what personal data the {org.name} portal collects about students, why, who can see it, how long it is
        kept and what you can do about it. If you are under 18, please read it with a parent or guardian.
      </p>

      <h2>1. Who is responsible</h2>
      <p>
        {who}
        {legal.address ? `, ${legal.address},` : ""} (&ldquo;{org.name}&rdquo;, &ldquo;we&rdquo;) decides how your data in this portal is
        used and is responsible for it. The portal is built and run for us by {PRODUCT_NAME}, which processes the data only on our
        instructions and for the purposes below.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your name, email address and profile picture from Google when you sign in, and the phone
          number and class you give us.
        </li>
        <li>
          <strong>Your work:</strong> the tests assigned to you, your answers, the time you spend on each question, your scores, and
          the marks and comments your tutors give you.
        </li>
        {features.answerSheetUpload && (
          <li>
            <strong>Answer-sheet photos:</strong> the pictures of your written answers you upload after a paper, and the marks your
            tutor draws on them.
          </li>
        )}
        {features.proctoring && (
          <li>
            <strong>Exam checks:</strong> during a proctored test, how many times you left the test tab or full screen and how many
            times a screenshot key was pressed. Too many can end the attempt.
          </li>
        )}
        {features.proctoring && features.cameraProctoring && (
          <li>
            <strong>Camera:</strong> during a proctored test your camera shows you a small picture of yourself and checks, on your
            own device, that one face is in view and no phone is. <strong>No video or photo is recorded, uploaded or stored.</strong>{" "}
            Only the number of times it noticed no face, more than one face or a phone is saved. The camera turns off when the
            test ends.
          </li>
        )}
        <li>
          <strong>Doubts:</strong> the questions you ask about a paper and the replies.
        </li>
        <li>
          <strong>Parent link:</strong> if you create one, a private link that lets a parent see your progress. You can change it
          at any time to cut off the old one.
        </li>
        <li>
          <strong>Technical data:</strong> a cookie that keeps you signed in, and the records our hosting provider keeps of visits
          (such as IP address and browser) to keep the service secure.
        </li>
      </ul>

      <h2>3. Why we use it</h2>
      <ul>
        <li>To give you tests, mark them, and show you your results and progress over time.</li>
        <li>To answer your doubts and share notes with you and your classroom.</li>
        {features.proctoring && <li>To keep tests fair for everyone.</li>}
        <li>To contact you or your parent about your studies, for example on WhatsApp.</li>
        <li>
          To keep our {PRODUCT_NAME} subscription right: your email address is shared with {PRODUCT_NAME} to count the students
          enrolled with us, and so that you can find this portal from the {PRODUCT_NAME} website.
        </li>
      </ul>
      <p>
        We do not sell your data, show you advertising, or use your data to profile you for marketing.
      </p>

      <h2>4. Students under 18</h2>
      <p>
        If you are under 18, we need the consent of your parent or lawful guardian to use your data, and we ask for it when you
        join us. Your parent or guardian can use every right in section 7 on your behalf.
        {features.proctoring
          ? " The exam checks above exist only to keep tests fair; they are never used to track you or to target anything at you."
          : ""}
      </p>

      <h2>5. Who can see it</h2>
      <ul>
        <li>{org.name}&apos;s owner, and the tutors who teach your classrooms (for marking and doubts).</li>
        <li>A parent, if you give them your parent link.</li>
        <li>
          {PRODUCT_NAME}, and the companies it uses to run the portal: Vercel (hosting), Supabase (the database), Cloudinary
          (answer-sheet photos and files) and Google (sign-in). They may store or process data outside India, under contracts that
          require them to protect it.
        </li>
        <li>Anyone the law requires us to share it with.</li>
      </ul>
      <p>Other students never see your answers, scores or photos.</p>

      <h2>6. How long we keep it</h2>
      <p>
        We keep your data while you study with us. When you leave and {org.name} removes your account, your account, tests,
        answers, results, doubts and answer-sheet photos are deleted from the portal. Tutors may also delete answer-sheet photos
        earlier, once a copy has been marked. Copies in our providers&apos; backups are removed as those backups expire.
      </p>

      <h2>7. Your rights</h2>
      <p>Under India&apos;s Digital Personal Data Protection Act, 2023, you can ask us to:</p>
      <ul>
        <li>tell you what personal data we hold about you and who we have shared it with;</li>
        <li>correct, complete or update it;</li>
        <li>delete it, once we no longer need it for the purposes above or you withdraw consent;</li>
        <li>let someone else use these rights for you if you die or cannot act for yourself.</li>
      </ul>
      <p>
        You can withdraw consent at any time; we then stop using your data and delete it, though we cannot continue to teach or
        test you through the portal. Withdrawing does not affect what we did before.
      </p>

      <h2>8. Questions and complaints</h2>
      <p>
        Write to our grievance officer, <Filled value={officer.name} missing="name" />, at{" "}
        {officer.email ? <a href={`mailto:${officer.email}`}>{officer.email}</a> : <Filled value={null} missing="email address" />}, or
        call <Filled value={org.support.phoneDisplay || null} missing="phone number" />. We will reply as quickly as we can and within the time the law allows. If you are not
        satisfied with our answer, you can complain to the Data Protection Board of India.
      </p>

      <h2>9. Security</h2>
      <p>
        The portal is served only over encrypted connections, every page and action checks who you are, tutors see only their own
        classrooms, and answer-sheet photos are private and opened only through short-lived signed links.
      </p>

      <h2>10. Changes</h2>
      <p>
        If we change this notice we will update it here and, if the change matters, tell you in the portal. See also our{" "}
        <Link href="/terms">terms of use</Link>.
      </p>
    </LegalDoc>
  );
}
