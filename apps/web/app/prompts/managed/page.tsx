'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { ManagedPromptWithVersions } from '@aiecon/types';

interface TeamInfo {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface TeamOption {
  id: string;
  name: string;
  color: string;
}

export default function ManagedPromptsPage() {
  const [prompts, setPrompts] = useState<ManagedPromptWithVersions[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ slug: '', name: '', description: '', initialContent: '', teamId: '' });

  const loadPrompts = useCallback(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      setAuthenticated(false);
      return;
    }
    setAuthenticated(true);
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      apiFetch<ManagedPromptWithVersions[]>(`/prompt/${projectId}`, { headers }),
      apiFetch<TeamOption[]>(`/team/${projectId}`, { headers }).catch(() => [] as TeamOption[]),
    ])
      .then(([promptsData, teamsData]) => {
        setPrompts(promptsData);
        setTeams(teamsData);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(loadPrompts, [loadPrompts]);

  const toggleTeam = (key: string) => {
    setCollapsedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setError('Not authenticated. Please register or log in first.');
      return;
    }
    setCreating(true);
    try {
      await apiFetch(`/prompt/${projectId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          slug: form.slug,
          name: form.name,
          description: form.description || undefined,
          initialContent: form.initialContent || undefined,
          teamId: form.teamId || undefined,
        }),
      });
      setForm({ slug: '', name: '', description: '', initialContent: '', teamId: '' });
      setShowCreate(false);
      setLoading(true);
      loadPrompts();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Managed Prompts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create, version, and deploy your AI prompts.
          </p>
        </div>
        {authenticated && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showCreate ? 'Cancel' : 'Create Prompt'}
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 rounded-lg border bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="customer-support"
                pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
                required
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Customer Support Agent"
                required
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description..."
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          {teams.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Team</label>
              <select
                value={form.teamId}
                onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              >
                <option value="">Unassigned (visible to all)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Initial Content (optional, creates v1)
            </label>
            <textarea
              value={form.initialContent}
              onChange={(e) => setForm({ ...form, initialContent: e.target.value })}
              placeholder="You are a helpful customer support agent..."
              rows={3}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Prompt'}
          </button>
        </form>
      )}

      {error && <div className="mt-4 text-sm text-red-500">{error}</div>}

      {!authenticated && !loading && (
        <div className="mt-12 text-center">
          <p className="text-gray-400">Not authenticated.</p>
          <p className="mt-1 text-sm text-gray-400">
            <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
            {' '}to manage your prompts.
          </p>
        </div>
      )}

      {authenticated && loading ? (
        <div className="py-20 text-center text-gray-400">Loading...</div>
      ) : authenticated && prompts.length === 0 ? (
        <div className="mt-12 text-center text-gray-400">
          No managed prompts yet. Create one to get started.
        </div>
      ) : authenticated ? (
        <div className="mt-6 space-y-4">
          {(() => {
            // Group prompts by team
            const unassigned = prompts.filter((p) => !p.team);
            const teamMap = new Map<string, { team: TeamInfo; prompts: ManagedPromptWithVersions[] }>();
            for (const p of prompts) {
              if (p.team) {
                if (!teamMap.has(p.team.id)) {
                  teamMap.set(p.team.id, { team: p.team, prompts: [] });
                }
                teamMap.get(p.team.id)!.prompts.push(p);
              }
            }
            const groups = Array.from(teamMap.values());

            const renderPromptRow = (p: ManagedPromptWithVersions) => {
              const activeVersion = p.versions?.[0];
              return (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="py-3">
                    <Link
                      href={`/prompts/managed/${p.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-3 font-mono text-xs text-gray-500">{p.slug}</td>
                  <td className="py-3">{p._count?.versions ?? 0}</td>
                  <td className="py-3">
                    {activeVersion ? (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        v{activeVersion.version}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">none</span>
                    )}
                  </td>
                  <td className="py-3 text-xs text-gray-500">
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            };

            const renderSection = (key: string, label: React.ReactNode, sectionPrompts: ManagedPromptWithVersions[]) => (
              <div key={key} className="rounded-lg border bg-white">
                <button
                  onClick={() => toggleTeam(key)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    {label}
                    <span className="text-xs text-gray-400">
                      ({sectionPrompts.length} prompt{sectionPrompts.length !== 1 && 's'})
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {collapsedTeams.has(key) ? '▸' : '▾'}
                  </span>
                </button>
                {!collapsedTeams.has(key) && (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-t text-xs uppercase text-gray-500">
                        <th className="px-4 pb-2 pt-3 font-medium">Name</th>
                        <th className="pb-2 pt-3 font-medium">Slug</th>
                        <th className="pb-2 pt-3 font-medium">Versions</th>
                        <th className="pb-2 pt-3 font-medium">Active</th>
                        <th className="pb-2 pt-3 font-medium">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionPrompts.map(renderPromptRow)}
                    </tbody>
                  </table>
                )}
              </div>
            );

            return (
              <>
                {unassigned.length > 0 && renderSection(
                  '__unassigned',
                  <span className="text-sm font-semibold text-gray-700">Unassigned</span>,
                  unassigned,
                )}
                {groups.map(({ team, prompts: teamPrompts }) =>
                  renderSection(
                    team.id,
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="text-sm font-semibold">{team.name}</span>
                    </span>,
                    teamPrompts,
                  ),
                )}
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
