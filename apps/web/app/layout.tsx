import type { Metadata } from 'next';
import './globals.css';
import { ClientLayout } from './client-layout';

export const metadata: Metadata = {
  title: 'PlanForge — LLM Observability & Prompt Management',
  description:
    'Track LLM costs, evaluate RAG quality, and manage prompts with a 2-line SDK integration. Free tier available.',
  openGraph: {
    title: 'PlanForge — LLM Observability & Prompt Management',
    description:
      'Track LLM costs, evaluate RAG quality, and manage prompts with a 2-line SDK integration.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PlanForge — LLM Observability & Prompt Management',
    description:
      'Track LLM costs, evaluate RAG quality, and manage prompts with a 2-line SDK integration.',
  },
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
