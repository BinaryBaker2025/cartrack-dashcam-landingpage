import Link from 'next/link';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Privacy Policy | CarTrack Cameras',
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: false },
};
export default function Privacy() {
  return (
    <main className="legal">
      <Link href="/">&larr; Back to your quote</Link>
      <h1>Bestcardash Privacy Policy</h1>
      <p>Effective Date: 24 October 2026</p>
      <p>
        At Bestcardash, we are committed to protecting your privacy and ensuring your personal
        information is handled in accordance with the Protection of Personal Information Act 4 of
        2013 (POPIA). This Privacy Policy explains how we, as the Responsible Party, collect, use,
        store, and share your personal information when you use our website, bestcardash.com, and
        our related lead-generating pages.
      </p>
      <h2>1. Information We Collect and How We Collect It</h2>
      <p>
        We align our definition of &quot;personal information&quot; with POPIA. We collect only the
        information necessary to provide our services and connect you with relevant partners.
      </p>
      <ul>
        <li>
          <strong>Information you provide to us directly:</strong> When you submit an online form to
          request a quotation, enter our promotional draws, or contact us, we collect details such
          as your name, surname, email address, telephone number, and any other details you
          explicitly provide.
        </li>
        <li>
          <strong>Information collected automatically:</strong> Our website automatically collects
          technical data, including your IP address, browser type, operating system, and browsing
          behavior using cookies and tracking technologies. This helps us optimize website
          performance and user experience. You can manage your cookie preferences through our cookie
          consent banner.
        </li>
      </ul>
      <h2>2. Purpose and Lawful Basis for Processing</h2>
      <p>
        We process your personal information strictly for the purposes for which it was collected,
        relying on the following lawful bases:
      </p>
      <ul>
        <li>
          <strong>Consent:</strong> When you request an obligation-free quote, you explicitly
          consent to us sharing your contact details with our independent third-party partners who
          can fulfill your request. Your consent is also required if we intend to send you direct
          marketing communications. You may withdraw your consent or opt-out of marketing at any
          time.
        </li>
        <li>
          <strong>Legitimate Interests:</strong> We process usage and technical data to monitor
          website performance, prevent fraud, and manage our business operations.
        </li>
      </ul>
      <h2>3. Sharing Your Information (Third-Party Disclosure)</h2>
      <p>
        As a lead-generation platform, our core function involves sharing your information with
        selected clients and partners so they may contact you regarding the specific quotes or
        services you requested.
      </p>
      <ul>
        <li>
          <strong>Operators and Partners:</strong> We only share your data with partners who are
          bound by written agreements to protect your confidentiality and comply with POPIA. Once
          your information is shared, the receiving client becomes the Responsible Party for that
          data, and their privacy policy will apply to their interactions with you.
        </li>
        <li>
          <strong>Cross-Border Transfers:</strong> In some instances, our service providers (e.g.,
          cloud hosting or email platforms) may store data outside of South Africa. We ensure these
          transfers comply with Section 72 of POPIA, meaning the recipient country offers adequate
          data protection laws or we have suitable safeguards in place.
        </li>
      </ul>
      <h2>4. Data Security and Retention</h2>
      <p>
        We implement appropriate and reasonable technical and organizational measures to secure your
        personal information against loss, damage, and unauthorized access (such as using SSL
        encryption).
      </p>
      <p>
        We will only retain your personal information for as long as necessary to fulfill the
        purposes outlined in this policy, or as required by law. Data is securely destroyed or
        de-identified when it is no longer needed.
      </p>
      <h2>5. Your Rights as a Data Subject</h2>
      <p>Under POPIA, you have the following rights regarding your personal information:</p>
      <ul>
        <li>The right to be notified that your information is being collected.</li>
        <li>The right to access the personal information we hold about you.</li>
        <li>
          The right to request the correction, updating, or deletion of inaccurate or outdated
          information.
        </li>
        <li>
          The right to object to the processing of your information (e.g., for direct marketing).
        </li>
        <li>The right to lodge a complaint with the Information Regulator of South Africa.</li>
      </ul>
      <h2>6. Minors</h2>
      <p>
        We do not intentionally collect personal information from individuals under the age of 18
        without the consent of a competent person (parent or legal guardian). If you believe we have
        inadvertently collected data from a minor, please contact us immediately to have it removed.
      </p>
      <h2>7. Contact Details and Information Officer</h2>
      <p>
        We have appointed an Information Officer who is responsible for ensuring our compliance with
        POPIA and handling any requests or concerns you may have.
      </p>
      <p>
        To exercise your rights or if you have any questions about this Privacy Policy, please
        contact our Information Officer at: Email:{' '}
        <a href="mailto:info@bestcardash.com">info@bestcardash.com</a>
      </p>
      <p>
        If we are unable to resolve your concern, you have the right to complain to the Information
        Regulator of South Africa.
      </p>
      <p>
        Changes to this Policy: We may update this Privacy Policy periodically to reflect changes in
        our practices or legal requirements. We encourage you to review this page regularly for the
        latest information.
      </p>
    </main>
  );
}
