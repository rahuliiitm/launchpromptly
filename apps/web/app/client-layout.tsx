'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';

const PUBLIC_LINKS = [
  { href: '/pricing', label: 'Pricing' },
];

const AUTH_LINKS = [
  { href: '/admin/security', label: 'Security', adminOnly: false },
  { href: '/prompts', label: 'Prompts', adminOnly: false },
  { href: '/observability', label: 'Observability', adminOnly: false },
  { href: '/admin', label: 'Admin', adminOnly: true },
];

function TopNav() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const isAdmin = user?.role === 'admin';

  return (
    <header className="border-b bg-white px-6 py-4">
      <div className="mx-auto flex max-w-7xl items-center gap-8">
        <Link href="/" className="text-xl font-bold">
          LaunchPromptly
        </Link>

        <nav className="flex gap-4 text-sm font-medium">
          {isAuthenticated ? (
            AUTH_LINKS.map((link) => {
              if (link.adminOnly && !isAdmin) return null;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors ${
                    active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })
          ) : (
            PUBLIC_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors ${
                    active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })
          )}
        </nav>

        <div className="ml-auto">
          {isLoading ? null : isAuthenticated && user ? (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <span>{user.email}</span>
                <svg
                  className={`h-4 w-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border bg-white py-1 shadow-lg">
                  <div className="border-b px-4 py-2 flex items-center gap-2">
                    <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {user.plan === 'free' ? 'Free' : user.plan === 'pro' ? 'Pro' : 'Business'}
                    </span>
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : 'Member'}
                    </span>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); logout(); }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TopNav />
      {children}
    </AuthProvider>
  );
}
