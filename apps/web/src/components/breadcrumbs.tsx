'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LABELS: Record<string, string> = {
  admin: 'Admin',
  security: 'Security',
  policies: 'Policies',
  alerts: 'Alerts',
  audit: 'Audit Log',
  sdk: 'SDK Setup',
  'api-keys': 'API Keys',
  docs: 'SDK Reference',
  settings: 'Settings',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    const label = LABELS[seg] || seg;
    const isLast = i === segments.length - 1;

    return { href, label, isLast };
  });

  return (
    <nav className="mb-4 flex items-center gap-1.5 text-sm text-gray-500">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && (
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          )}
          {crumb.isLast ? (
            <span className="font-medium text-gray-900">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-gray-700">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
