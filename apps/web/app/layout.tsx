import type { Metadata } from 'next';
import './globals.css';
import { ClientLayout } from './client-layout';

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
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
