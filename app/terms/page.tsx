import Link from 'next/link';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Terms | CarTrack Cameras',
  alternates: { canonical: '/terms' },
  robots: { index: false, follow: false },
};
export default function Terms() {
  return (
    <main className="legal">
      <Link href="/">← Back to your quote</Link>
      <h1>Quote request terms</h1>
      <p>
        This form is a request to be contacted about CarTrack Cameras. Submitting a request does not
        enter you into a purchase contract and does not guarantee acceptance, a particular price,
        installation or insurance benefits.
      </p>
      <h2>Who can request a call?</h2>
      <p>
        This campaign is for South African residents aged 18 or older who have access to a vehicle,
        are employed or self-employed, and earn at least R10,000 per month. Please provide accurate
        information and use your own mobile number.
      </p>
      <h2>Your request</h2>
      <p>
        By accepting the form’s consent statement, you agree that your details may be shared with
        CarTrack and the campaign’s service providers to process your request and contact you about
        CarTrack Cameras. Any preferred call time is a request and is subject to availability.
      </p>
      <p>
        A successful submission means we have saved your request for processing. CarTrack will
        explain any applicable product terms and pricing before you decide whether to proceed.
      </p>
      <h2>Contact preferences</h2>
      <p>
        You may decline the offer or ask the representative not to contact you again. Read the{' '}
        <a href="/privacy">privacy notice</a> for information about how your request is handled.
      </p>
    </main>
  );
}
