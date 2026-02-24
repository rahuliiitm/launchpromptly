'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';

interface TeamMember {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export default function TeamPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteUrl, setInviteUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      apiFetch<TeamMember[]>('/invitations/team', { headers }).then(setMembers),
      apiFetch<Invitation[]>('/invitations', { headers }).then(setInvitations),
    ]).finally(() => setLoading(false));
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInviteUrl('');
    setSubmitting(true);

    const token = getToken();
    if (!token) return;

    try {
      const result = await apiFetch<{ invitation: Invitation; inviteUrl: string }>(
        '/invitations',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
        },
      );
      setInviteUrl(result.inviteUrl);
      setInvitations((prev) => [result.invitation, ...prev]);
      setInviteEmail('');
      setInviteRole('member');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await apiFetch(`/invitations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setInvitations((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await apiFetch(`/invitations/team/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  const pendingInvitations = invitations.filter(
    (i) => !i.acceptedAt && new Date(i.expiresAt) > new Date(),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Team</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manage your organization&apos;s team members and invitations.
      </p>

      {error && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Invite Form */}
      <div className="mt-6 rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold">Invite Team Member</h2>
        <form onSubmit={handleInvite} className="mt-3 flex gap-2">
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="flex-1 rounded border px-3 py-2 text-sm"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Inviting...' : 'Invite'}
          </button>
        </form>

        {inviteUrl && (
          <div className="mt-4 rounded border border-yellow-300 bg-yellow-50 p-4">
            <p className="text-sm font-medium text-yellow-800">
              Share this invite link:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-gray-100 p-2 text-xs font-mono">
                {inviteUrl}
              </code>
              <button
                onClick={() => copyToClipboard(inviteUrl)}
                className="shrink-0 rounded border px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Members</h2>
        <div className="mt-3 space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded border bg-white p-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{member.email}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    member.role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {member.role === 'admin' ? 'Admin' : 'Member'}
                </span>
                {member.id === user?.id && (
                  <span className="text-xs text-gray-400">(you)</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  Joined {new Date(member.createdAt).toLocaleDateString()}
                </span>
                {member.id !== user?.id && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-gray-400">No team members yet.</p>
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Pending Invitations</h2>
          <div className="mt-3 space-y-2">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded border bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm">{inv.email}</span>
                  <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                    Pending
                  </span>
                  <span className="text-xs text-gray-400">
                    as {inv.role}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
