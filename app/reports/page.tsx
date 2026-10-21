import type { Metadata } from 'next';
import ReportingDashboard from '@/components/ReportingDashboard';
export const metadata: Metadata = {
  title: 'Owner reports | CarTrack Cameras',
  robots: { index: false, follow: false },
  alternates: { canonical: '/reports' },
};
export default function ReportsPage() {
  return <ReportingDashboard />;
}
