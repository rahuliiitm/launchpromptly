import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AIEcon — AI Feature Unit Economics Simulator',
  description: 'Model and optimize the unit economics of your AI features before you scale.',
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
          <h1 className="text-xl font-bold">AIEcon</h1>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
