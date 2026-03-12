'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { PostHogProvider } from '@/lib/posthog';

const PUBLIC_LINKS = [
  { href: '/why', label: 'Why LaunchPromptly' },
  { href: '/security', label: 'Security' },
  { href: '/playground', label: 'Playground' },
  { href: '/docs', label: 'Docs' },
];

const AUTH_NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/admin/sdk', label: 'Getting Started' },
  { href: '/docs', label: 'Docs' },
];

const SECURITY_DROPDOWN = [
  { href: '/admin/security/policies', label: 'Policies' },
  { href: '/admin/security/alerts', label: 'Alerts' },
  { href: '/admin/security/audit', label: 'Audit Log' },
];

const IS_BETA = new Date() < new Date('2025-04-30T23:59:59Z');

function BetaBanner() {
  if (!IS_BETA) return null;
  return (
    <div className="bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white">
      Public Beta — All features free until April 30. No credit card required.
    </div>
  );
}

function TopNav() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const securityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (securityRef.current && !securityRef.current.contains(e.target as Node)) {
        setSecurityOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(href + '/');

  const isSecurityActive = pathname.startsWith('/admin/security');

  return (
    <header className="border-b bg-white px-6 py-4">
      <div className="mx-auto flex max-w-7xl items-center gap-8">
        <Link href="/" className="text-xl font-bold">
          LaunchPromptly
        </Link>

        <nav className="flex items-center gap-4 text-sm font-medium">
          {isAuthenticated ? (
            <>
              {AUTH_NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors ${
                    isActive(link.href) ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Security dropdown */}
              <div ref={securityRef} className="relative">
                <button
                  onClick={() => setSecurityOpen(!securityOpen)}
                  className={`flex items-center gap-1 transition-colors ${
                    isSecurityActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Security
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${securityOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {securityOpen && (
                  <div className="absolute left-0 mt-2 w-44 rounded-lg border bg-white py-1 shadow-lg z-50">
                    {SECURITY_DROPDOWN.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setSecurityOpen(false)}
                        className={`block px-4 py-2 text-sm ${
                          isActive(link.href)
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            PUBLIC_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors ${
                  isActive(link.href) ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {link.label}
              </Link>
            ))
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
                <div className="absolute right-0 mt-2 w-52 rounded-lg border bg-white py-1 shadow-lg z-50">
                  <div className="border-b px-4 py-2 flex items-center gap-2">
                    <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {user.plan === 'free' ? 'Free' : user.plan === 'pro' ? 'Indie' : 'Startup'}
                    </span>
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : 'Member'}
                    </span>
                  </div>
                  <Link
                    href="/admin/settings"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Settings
                  </Link>
                  {user.role === 'admin' && (
                    <Link
                      href="/admin/api-keys"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      API Keys
                    </Link>
                  )}
                  <div className="border-t my-1" />
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
    <PostHogProvider>
      <AuthProvider>
        <BetaBanner />
        <TopNav />
        {children}
      </AuthProvider>
    </PostHogProvider>
  );
}
