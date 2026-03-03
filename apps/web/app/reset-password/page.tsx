'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PageLoader, Spinner } from '@/components/spinner';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="rounded-lg border bg-white p-8">
          <h1 className="text-xl font-bold text-red-600">Invalid Reset Link</h1>
          <p className="mt-2 text-sm text-gray-500">
            This password reset link is invalid or has expired.
          </p>
          <Link href="/forgot-password" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Request a new reset link
          </Link>
        </div>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Something went wrong.');
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="rounded-lg border bg-white p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Password Reset!</h1>
          <p className="mt-2 text-sm text-gray-500">
            Your password has been updated. Redirecting to sign in...
          </p>
          <Link href="/login" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Go to Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-center text-2xl font-bold">Reset your password</h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        Enter your new password below.
      </p>

      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            New Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Min 8 characters"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting && <Spinner className="h-4 w-4 text-white" />}
          {submitting ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </main>
  );
}
