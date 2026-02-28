'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAdmin } from '@/components/require-admin';

const NAV_ITEMS = [
  { href: '/admin/security', label: 'Security Overview' },
  { href: '/admin/security/policies', label: 'Security Policies' },
  { href: '/admin/security/audit', label: 'Audit Logs' },
  { href: '/admin/sdk', label: 'SDK Setup' },
  { href: '/admin/api-keys', label: 'API Keys' },
  { href: '/admin/providers', label: 'LLM Providers' },
  { href: '/admin/environments', label: 'Environments' },
  { href: '/admin/teams', label: 'Teams' },
  { href: '/admin/team', label: 'Members' },
  { href: '/admin', label: 'Billing' },
];

function isActiveLink(pathname: string, href: string): boolean {
  // Exact match always wins
  if (pathname === href) return true;
  // The root /admin route only matches exactly
  if (href === '/admin') return false;
  // For prefix matches, ensure no other nav item is a more specific match.
  // e.g. when on /admin/security/audit, /admin/security should NOT match
  // because /admin/security/audit is a more specific match.
  const isPrefix = pathname.startsWith(href + '/') || pathname.startsWith(href + '?');
  if (!isPrefix) return false;
  // Check if a more specific nav item matches
  const hasMoreSpecific = NAV_ITEMS.some(
    (other) =>
      other.href !== href &&
      other.href.startsWith(href + '/') &&
      (pathname === other.href || pathname.startsWith(other.href + '/') || pathname.startsWith(other.href + '?')),
  );
  return !hasMoreSpecific;
}

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
                  isActiveLink(pathname, item.href)
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
