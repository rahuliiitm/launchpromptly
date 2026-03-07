'use client';

import { RequireAdmin } from '@/components/require-admin';
import { Breadcrumbs } from '@/components/breadcrumbs';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAdmin>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <Breadcrumbs />
        {children}
      </main>
    </RequireAdmin>
  );
}
