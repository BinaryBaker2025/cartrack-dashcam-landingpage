import Image from 'next/image';
import Link from 'next/link';
import LeadForm from '@/components/form/LeadForm';
import QuoteExperience from '@/components/QuoteExperience';
export default function Home() {
  return (
    <QuoteExperience>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="brand-header">
        <div className="page-width">
          <Link href="/" className="brand-wordmark" aria-label="Best Car Dash home">
            best<span>car</span>dash.com
          </Link>
        </div>
      </header>
      <main id="main">
        <div className="campaign-layout">
          <section className="campaign-hero" aria-labelledby="campaign-title">
            <div className="campaign-hero-inner">
              <div className="campaign-copy">
                <div className="campaign-draw-badge">
                  <p className="campaign-draw-intro">Stand a chance to win your share of</p>
                  <div className="campaign-prize-panel">
                    <p className="campaign-prize">R10,000</p>
                    <p className="campaign-draw-label">on our annual draw</p>
                  </div>
                </div>
                <div className="campaign-hero-top">
                  <p className="campaign-kicker">Stay safe with a dash cam</p>
                  <span className="campaign-pill">
                    <span className="campaign-pill-dot" aria-hidden="true" />
                    Record it. Prove it.
                  </span>
                </div>
                <h1 id="campaign-title">
                  <span className="campaign-headline-line">See more.</span>
                  <span className="campaign-headline-chip">Worry less.</span>
                </h1>
                <p className="campaign-price-line">
                  From as little as <strong>R6.99/day*</strong>
                </p>
                <p className="campaign-priority">
                  Being covered should still be your top priority.
                </p>
                <a className="campaign-cta" href="#quote">
                  Get Quote &amp; Qualify <span aria-hidden="true">↓</span>
                </a>
                <p className="campaign-terms">*Terms and conditions apply.</p>
              </div>
              <div className="campaign-photo">
                <div className="campaign-photo-frame">
                  <Image
                    src="/assets/dashcam-product.jpeg"
                    alt="A driver travelling with a dashcam installed on the windscreen"
                    fill
                    sizes="(max-width: 767px) 100vw, 28vw"
                    preload
                    className="campaign-photo-image"
                  />
                </div>
              </div>
            </div>
          </section>
          <section className="quote-section" aria-label="Request a quote">
            <LeadForm />
          </section>
        </div>
        <section className="benefits" aria-labelledby="benefits-title">
          <div className="page-width">
            <h2 id="benefits-title">Why you need a car dashcam</h2>
            <p className="benefits-intro">
              Accidents, potholes, insurance disputes, or even just reckless drivers, these are
              everyday risks on our roads. A dashcam puts you in control by documenting everything
              that happens.
            </p>
            <div className="benefits-grid">
              <Image
                className="product-image"
                loading="eager"
                src="/assets/dashcam-product.jpeg"
                alt="Driver travelling with a dashcam installed on the windscreen"
                width={519}
                height={258}
                sizes="(max-width: 767px) calc(100vw - 40px), 519px"
              />
              <ul className="benefit-list">
                {[
                  'Deterring car break-ins and vandalism',
                  'Peace of mind on the road',
                  'Easy, hassle-free installation process',
                  'GPS capabilities',
                ].map((text) => (
                  <li key={text}>
                    <span aria-hidden="true">✅</span>
                    {text}
                  </li>
                ))}
              </ul>
              <aside className="did-you-know">
                <h3>Did you know?</h3>
                <p>
                  Insurance companies in South Africa are becoming{' '}
                  <strong>more open to offering favourable premiums</strong> to drivers who use
                  dashcams, as they provide concrete evidence that can expedite insurance claims.
                </p>
              </aside>
              <a className="cta benefits-cta" href="#quote">
                Get a free call back
              </a>
            </div>
          </div>
        </section>
        <section className="closing">
          <h2>Get your free quote today</h2>
          <a className="cta" href="#quote">
            Get your quote
          </a>
        </section>
      </main>
      <footer className="footer">
        <p>
          Best Car Dash · *From R6.99 per day. Terms apply.
          <span className="footer-association">In association with LeadByte.</span>
        </p>
        <nav aria-label="Legal">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy notice</a>
        </nav>
      </footer>
    </QuoteExperience>
  );
}
