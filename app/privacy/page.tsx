import Link from 'next/link';
import { campaignIdentity } from '@/lib/config';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Privacy notice | CarTrack Cameras',
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: false },
};
export default function Privacy() {
  const identity = campaignIdentity();
  return (
    <main className="legal">
      <Link href="/">← Back to your quote</Link>
      <h1>Privacy notice</h1>
      <p>
        When you request a quote, this site collects your name, South African mobile number,
        eligibility answers, contact consent and, if provided, preferred call time.
      </p>
      <h2>How your details are used</h2>
      <p>
        Your eligibility answers determine whether you meet this campaign’s initial requirements.
        Qualified requests are sent to LeadByte, the campaign’s lead processing service, for
        processing and contact by CarTrack and its campaign service providers. Your full phone
        number is sent securely to that service. This site does not keep a lead database or log your
        full mobile number.
      </p>
      <h2>What this site retains</h2>
      <p>
        Your browser temporarily stores campaign attribution, a submission identifier, attempt times
        and a submission result. These records do not contain your name or mobile number.
        Attribution may include the referring affiliate, transaction ID and UTM campaign parameters.
      </p>
      <p>
        The server briefly holds pseudonymous request and network identifiers in memory to reduce
        repeated submissions. Diagnostic logs contain request IDs, outcome codes, redacted response
        text or qualification categories. No external analytics provider is enabled by default.
      </p>
      <h2>Retention and your choices</h2>
      <p>
        Browser result records expire after 30 minutes and are removed when the site next accesses
        storage. Session storage generally ends when the tab closes, although browser session
        restore may preserve it. Server memory records expire within 30 minutes or disappear when
        the function restarts. Hosting logs follow the operator’s hosting retention settings.
        CarTrack and its service providers apply their own retention policies to the details they
        receive. You may decline a call or ask the representative to stop further contact. No
        purchase is required to submit this form.
      </p>
      <h2>Privacy enquiries</h2>
      <p>{identity.name}</p>
      {identity.email && (
        <p>
          For access, correction, deletion or contact preferences, email{' '}
          <a href={`mailto:${identity.email}`}>{identity.email}</a>.
        </p>
      )}
    </main>
  );
}
