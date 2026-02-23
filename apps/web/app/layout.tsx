import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'PlanForge — AI Cost Intelligence Platform',
  description: 'Track, analyze, and optimize the unit economics of your AI features.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <header className="border-b bg-white px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center gap-8">
            <Link href="/" className="text-xl font-bold">
              PlanForge
            </Link>
            <nav className="flex gap-4 text-sm font-medium">
              <Link
                href="/"
                className="text-gray-500 transition-colors hover:text-gray-900"
              >
                Simulator
              </Link>
              <Link
                href="/dashboard"
                className="text-gray-500 transition-colors hover:text-gray-900"
              >
                Dashboard
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
