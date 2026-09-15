'use client';

import Image from 'next/image';
import { createContext, useEffect, useRef, useState, type ReactNode } from 'react';

export const QuoteSuccessContext = createContext<(() => void) | null>(null);

function ThankYou() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = 'Thank you | CarTrack Cameras';
    window.scrollTo({ top: 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="thank-you-page">
      <header className="thank-you-header">
        <Image
          src="/assets/cartrack-logo.jpg"
          alt="Cartrack"
          width={346}
          height={94}
          loading="eager"
        />
      </header>
      <main className="thank-you-content">
        <h1 tabIndex={-1} ref={heading}>
          Thank you for your application.
          <br />
          We’ll be in touch shortly.
        </h1>
      </main>
    </div>
  );
}

export default function QuoteExperience({ children }: { children: ReactNode }) {
  const [accepted, setAccepted] = useState(false);
  return (
    <QuoteSuccessContext.Provider value={() => setAccepted(true)}>
      {accepted ? <ThankYou /> : children}
    </QuoteSuccessContext.Provider>
  );
}
