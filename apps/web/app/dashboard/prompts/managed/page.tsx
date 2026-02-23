'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { ManagedPromptWithVersions } from '@aiecon/types';

export default function ManagedPromptsPage() {
  const [prompts, setPrompts] = useState<ManagedPromptWithVersions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ slug: '', name: '', description: '', initialContent: '' });

  const loadPrompts = useCallback(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }
    apiFetch<ManagedPromptWithVersions[]>(
      `/prompt/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then(setPrompts)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(loadPrompts, [loadPrompts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
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
        }),
      });
      setForm({ slug: '', name: '', description: '', initialContent: '' });
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
          <h1 className="text-2xl font-bold">Prompts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create, version, and deploy your AI prompts.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showCreate ? 'Cancel' : 'Create Prompt'}
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b">
        <Link
          href="/dashboard/prompts"
          className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          Discovered
        </Link>
        <span className="border-b-2 border-blue-600 px-4 py-2 text-sm font-medium text-blue-600">
          Managed
        </span>
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

      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading...</div>
      ) : prompts.length === 0 ? (
        <div className="mt-12 text-center text-gray-400">
          No managed prompts yet. Create one to get started.
        </div>
      ) : (
        <div className="mt-6">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-gray-500">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Slug</th>
                <th className="pb-2 font-medium">Versions</th>
                <th className="pb-2 font-medium">Active</th>
                <th className="pb-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {prompts.map((p) => {
                const activeVersion = p.versions?.[0];
                return (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="py-3">
                      <Link
                        href={`/dashboard/prompts/managed/${p.id}`}
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
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
