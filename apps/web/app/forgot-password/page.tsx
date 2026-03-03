'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Spinner } from '@/components/spinner';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Something went wrong.');
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="rounded-lg border bg-white p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Check your email</h1>
          <p className="mt-2 text-sm text-gray-500">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
            It expires in 1 hour.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm text-blue-600 hover:underline">
            Back to Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-center text-2xl font-bold">Forgot your password?</h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="you@company.com"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting && <Spinner className="h-4 w-4 text-white" />}
          {submitting ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-gray-400">
        Remember your password?{' '}
        <Link href="/login" className="text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
