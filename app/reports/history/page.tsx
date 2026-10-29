import type { Metadata } from 'next';
import ChangeHistory from '@/components/ChangeHistory';

export const metadata: Metadata = {
  title: 'Change history | CarTrack Cameras',
  robots: { index: false, follow: false },
  alternates: { canonical: '/reports/history' },
};

export default function HistoryPage() {
  return <ChangeHistory />;
}
