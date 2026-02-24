'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

type Tab = 'signin' | 'signup';

export default function LoginPage() {
  const { isAuthenticated, isLoading, login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';

  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirect);
    }
  }, [isLoading, isAuthenticated, router, redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (tab === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (tab === 'signin') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (isAuthenticated) {
    return null; // will redirect
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-center text-2xl font-bold">Welcome to PlanForge</h1>
      <p className="mt-2 text-center text-sm text-gray-500">
        Track, analyze, and optimize your AI costs.
      </p>

      {/* Tabs */}
      <div className="mt-8 flex border-b">
        <button
          onClick={() => { setTab('signin'); setError(''); }}
          className={`flex-1 py-2 text-center text-sm font-medium ${
            tab === 'signin'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => { setTab('signup'); setError(''); }}
          className={`flex-1 py-2 text-center text-sm font-medium ${
            tab === 'signup'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sign Up
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder={tab === 'signup' ? 'Min 8 characters' : ''}
          />
        </div>

        {tab === 'signup' && (
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
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting
            ? 'Please wait...'
            : tab === 'signin'
              ? 'Sign In'
              : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-gray-400">
        {tab === 'signin'
          ? "Don't have an account? "
          : 'Already have an account? '}
        <button
          onClick={() => { setTab(tab === 'signin' ? 'signup' : 'signin'); setError(''); }}
          className="text-blue-600 hover:underline"
        >
          {tab === 'signin' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </main>
  );
}
