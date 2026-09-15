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
      <header className="site-header">
        <div className="page-width">
          <Link href="/" aria-label="CarTrack Cameras home">
            <Image
              src="/assets/cartrack-logo.jpg"
              alt="Cartrack"
              width={233}
              height={63}
              priority
              className="brand-logo"
            />
          </Link>
        </div>
      </header>
      <main id="main">
        <section className="hero">
          <div className="page-width hero-grid">
            <div className="hero-copy">
              <h1>Protect your vehicle</h1>
              <div className="hero-price" aria-label="From only R199 per month. Terms apply.">
                <p className="price-intro">from only</p>
                <p className="price-amount">
                  <span>R199</span>
                  <small>pm*</small>
                </p>
              </div>
              <div className="hero-rule" />
              <p className="hero-description">
                Protect your vehicle and capture every moment with Cartrack&apos;s dashcam
              </p>
            </div>
            <LeadForm />
          </div>
        </section>
        <section className="benefits" aria-labelledby="benefits-title">
          <div className="page-width">
            <h2 id="benefits-title">Why you need a car dashcam</h2>
            <p className="benefits-intro">
              Accidents, potholes, insurance disputes, or even just reckless drivers, these are
              everyday risks on our roads. A Cartrack Dashcam puts you in control by documenting
              everything that happens.
            </p>
            <div className="benefits-grid">
              <Image
                className="product-image"
                loading="eager"
                src="/assets/dashcam-product.jpeg"
                alt="Driver with a Cartrack dashcam installed on the windscreen"
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
        <p>CarTrack Cameras · *From R199 per month. Terms apply.</p>
        <nav aria-label="Legal">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy notice</a>
        </nav>
      </footer>
    </QuoteExperience>
  );
}
