'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/components/require-auth';

const NAV_ITEMS = [
  { href: '/analytics', label: 'Overview' },
  { href: '/analytics/rag', label: 'RAG Quality' },
];

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <RequireAuth>
      <div className="flex min-h-[calc(100vh-57px)]">
        <aside className="w-56 shrink-0 border-r bg-white px-4 py-6">
          <h2 className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Analytics
          </h2>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === item.href || (item.href !== '/analytics' && pathname.startsWith(item.href))
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </RequireAuth>
  );
}
