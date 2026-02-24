'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { saveAuth, savePlan, saveRole, saveProjectId } from '@/lib/auth';

interface InviteInfo {
  email: string;
  orgName: string;
  expired: boolean;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<InviteInfo>(`/invitations/token/${token}`)
      .then(setInfo)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiFetch<{
        accessToken: string;
        userId: string;
        plan: string;
        role: string;
      }>('/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });

      saveAuth(result.accessToken, result.userId);
      savePlan(result.plan);
      saveRole(result.role ?? 'member');

      // Fetch profile to get projectId
      const profile = await apiFetch<{
        id: string;
        projectId: string | null;
      }>('/auth/me', {
        headers: { Authorization: `Bearer ${result.accessToken}` },
      });

      if (profile.projectId) saveProjectId(profile.projectId);

      // Full page reload to reinitialize auth context
      window.location.href = '/';
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (error && !info) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="rounded-lg border bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900">Invalid Invitation</h1>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
        </div>
      </main>
    );
  }

  if (info?.expired) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="rounded-lg border bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900">Invitation Expired</h1>
          <p className="mt-2 text-sm text-gray-500">
            This invitation has expired or has already been used. Please ask your
            team admin to send a new one.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-lg border bg-white p-8">
        <h1 className="text-center text-2xl font-bold">Join {info?.orgName}</h1>
        <p className="mt-2 text-center text-sm text-gray-500">
          You&apos;ve been invited to join as <strong>{info?.email}</strong>.
          <br />
          Create a password to get started.
        </p>

        {error && (
          <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
            className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating account...' : 'Accept Invitation'}
          </button>
        </form>
      </div>
    </main>
  );
}
