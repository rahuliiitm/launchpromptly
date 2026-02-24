'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAdmin } from '@/components/require-admin';

const NAV_ITEMS = [
  { href: '/admin', label: 'Billing' },
  { href: '/admin/team', label: 'Team' },
  { href: '/admin/api-keys', label: 'API Keys' },
  { href: '/admin/providers', label: 'LLM Providers' },
  { href: '/admin/sdk', label: 'SDK Setup' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <RequireAdmin>
      <div className="flex min-h-[calc(100vh-57px)]">
        <aside className="w-56 shrink-0 border-r bg-white px-4 py-6">
          <h2 className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Admin
          </h2>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
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
    </RequireAdmin>
  );
}
