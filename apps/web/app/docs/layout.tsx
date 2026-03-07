import Link from 'next/link';

export const metadata = {
  title: 'SDK Reference | LaunchPromptly',
  description:
    'Complete API reference for the LaunchPromptly Node.js and Python SDKs. PII redaction, prompt injection detection, cost guards, content filtering, and streaming guard.',
};

export default function PublicDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {/* CTA Banner */}
      <div className="border-b bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-3 text-center">
        <p className="text-sm text-gray-700">
          <span className="font-medium">Get started free</span> — no credit card required.{' '}
          <Link
            href="/login"
            className="font-semibold text-blue-600 underline hover:text-blue-800"
          >
            Create your account
          </Link>
        </p>
      </div>

      {/* Docs content */}
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
