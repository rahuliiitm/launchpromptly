'use client';

import { RequireAuth } from '@/components/require-auth';

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <div className="mx-auto max-w-7xl p-6">{children}</div>
    </RequireAuth>
  );
}
