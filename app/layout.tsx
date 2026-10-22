import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import AdvertisingConsent from '@/components/AdvertisingConsent';
import { uetBootstrap } from '@/lib/uet';
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
const poppins = localFont({
  src: [
    { path: '../public/assets/fonts/poppins-0.ttf', weight: '400' },
    { path: '../public/assets/fonts/poppins-1.ttf', weight: '700' },
  ],
  variable: '--font-poppins',
  display: 'swap',
});
const questrial = localFont({
  src: '../public/assets/fonts/questrial-0.ttf',
  variable: '--font-questrial',
  display: 'swap',
  preload: false,
});
const handwriting = localFont({
  src: '../public/assets/fonts/nanum-pen-script-0.ttf',
  variable: '--font-handwriting',
  display: 'swap',
  preload: false,
});
const indexable = isIndexable();
export const metadata: Metadata = {
  icons: { icon: '/assets/cartrack-logo.jpg' },
  metadataBase: new URL(siteUrl()),
  title: 'CarTrack Cameras | Get a Free Quote',
  description:
    'Protect your vehicle and capture every moment with CarTrack’s dashcam. Check your eligibility and request a free call back.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'CarTrack Cameras | Get a Free Quote',
    description: 'Request a call about CarTrack Cameras for your vehicle.',
    url: '/',
    type: 'website',
    locale: 'en_ZA',
    images: [
      { url: '/assets/dashcam-product.jpeg', width: 519, height: 258, alt: 'CarTrack dashcam' },
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
        <Script id="microsoft-uet" strategy="beforeInteractive">
          {uetBootstrap}
        </Script>
      </head>
      <body
        suppressHydrationWarning
        className={`${montserrat.variable} ${poppins.variable} ${questrial.variable} ${handwriting.variable}`}
      >
        {children}
        <AdvertisingConsent />
      </body>
    </html>
  );
}
