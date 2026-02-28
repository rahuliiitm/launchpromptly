import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClientLayout } from './client-layout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LaunchPromptly — LLM Privacy & Security SDK',
  description:
    'Protect your LLM applications with client-side PII redaction, prompt injection detection, cost controls, and compliance tooling. Zero-dependency SDK, 2-line integration.',
  openGraph: {
    title: 'LaunchPromptly — LLM Privacy & Security SDK',
    description:
      'Client-side PII redaction, prompt injection detection, and cost controls for LLM applications. Drop-in SDK with zero dependencies.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LaunchPromptly — LLM Privacy & Security SDK',
    description:
      'Client-side PII redaction, prompt injection detection, and cost controls for LLM applications. Drop-in SDK with zero dependencies.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gray-50 text-gray-900 antialiased`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
