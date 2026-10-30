import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import AdvertisingConsent from '@/components/AdvertisingConsent';
import { uetBootstrap } from '@/lib/uet';
import { GOOGLE_ADS_TAG_ID, googleTagBootstrap } from '@/lib/googleTag';
import { siteUrl } from '@/lib/config';
import { isIndexable } from '@/lib/hosting';
import './globals.css';
const montserrat = localFont({
  src: [
    { path: '../public/assets/fonts/montserrat-0.ttf', weight: '400' },
    { path: '../public/assets/fonts/montserrat-1.ttf', weight: '700' },
  ],
  variable: '--font-montserrat',
  display: 'swap',
});
const indexable = isIndexable();
export const metadata: Metadata = {
  icons: { icon: '/assets/best-car-dash-logo.png' },
  metadataBase: new URL(siteUrl()),
  title: 'Best Car Dash | Get a Free Quote',
  description:
    'Protect your vehicle and capture every moment with a dashcam. Request a free quote and call back.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Best Car Dash | Get a Free Quote',
    description: 'Request a free call about a dashcam for your vehicle.',
    url: '/',
    type: 'website',
    locale: 'en_ZA',
    images: [
      { url: '/assets/dashcam-product.jpeg', width: 519, height: 258, alt: 'Dashcam in a vehicle' },
    ],
  },
  robots: { index: indexable, follow: indexable },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION?.trim() || undefined,
    other: process.env.BING_SITE_VERIFICATION?.trim()
      ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION.trim() }
      : undefined,
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA">
      <head>
        <Script id="google-ads-config" strategy="beforeInteractive">
          {googleTagBootstrap}
        </Script>
        <Script id="microsoft-uet" strategy="beforeInteractive">
          {uetBootstrap}
        </Script>
      </head>
      <body suppressHydrationWarning className={montserrat.variable}>
        {children}
        <Script
          id="google-ads-tag"
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_TAG_ID}`}
          strategy="afterInteractive"
        />
        <AdvertisingConsent />
      </body>
    </html>
  );
}
