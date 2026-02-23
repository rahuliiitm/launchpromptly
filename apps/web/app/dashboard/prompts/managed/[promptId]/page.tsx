'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { ManagedPromptWithVersions, PromptVersion, PromptVersionAnalytics } from '@aiecon/types';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-600',
};

export default function PromptDetailPage() {
  const { promptId } = useParams<{ promptId: string }>();
  const router = useRouter();
  const [prompt, setPrompt] = useState<ManagedPromptWithVersions | null>(null);
  const [analytics, setAnalytics] = useState<PromptVersionAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', slug: '', description: '' });

  const token = getToken();
  const projectId = getProjectId();

  const loadPrompt = useCallback(() => {
    if (!token || !projectId) {
      setLoading(false);
      return;
    }
    Promise.all([
      apiFetch<ManagedPromptWithVersions>(
        `/prompt/${projectId}/${promptId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
      apiFetch<PromptVersionAnalytics[]>(
        `/prompt/${projectId}/${promptId}/analytics?days=30`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).catch(() => [] as PromptVersionAnalytics[]),
    ])
      .then(([p, a]) => {
        setPrompt(p);
        setAnalytics(a);
        setEditForm({ name: p.name, slug: p.slug, description: p.description });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, projectId, promptId]);

  useEffect(loadPrompt, [loadPrompt]);

  const handleDeploy = async (versionId: string) => {
    if (!token || !projectId) return;
    setActionLoading(`deploy-${versionId}`);
    try {
      await apiFetch(`/prompt/${projectId}/${promptId}/versions/${versionId}/deploy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadPrompt();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRollback = async () => {
    if (!token || !projectId) return;
    setActionLoading('rollback');
    try {
      await apiFetch(`/prompt/${projectId}/${promptId}/rollback`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadPrompt();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOptimize = async (versionId: string) => {
    if (!token || !projectId) return;
    setActionLoading(`optimize-${versionId}`);
    try {
      await apiFetch(`/prompt/${projectId}/${promptId}/versions/${versionId}/optimize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadPrompt();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !projectId || !newContent.trim()) return;
    setActionLoading('create-version');
    try {
      await apiFetch(`/prompt/${projectId}/${promptId}/versions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newContent }),
      });
      setNewContent('');
      setShowNewVersion(false);
      loadPrompt();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !projectId) return;
    setActionLoading('update');
    try {
      await apiFetch(`/prompt/${projectId}/${promptId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      setEditing(false);
      loadPrompt();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!token || !projectId) return;
    if (!confirm('Are you sure you want to delete this prompt and all versions?')) return;
    setActionLoading('delete');
    try {
      await apiFetch(`/prompt/${projectId}/${promptId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      router.push('/dashboard/prompts/managed');
    } catch (err) {
      setError((err as Error).message);
      setActionLoading(null);
    }
  };

  const getAnalyticsForVersion = (versionId: string) =>
    analytics.find((a) => a.promptVersionId === versionId);

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (!prompt) {
    return <div className="py-20 text-center text-red-500">Prompt not found</div>;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-gray-500">
        <Link href="/dashboard/prompts/managed" className="hover:text-gray-700">
          Managed Prompts
        </Link>
        {' > '}
        <span className="text-gray-800">{prompt.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {editing ? (
            <form onSubmit={handleUpdateMeta} className="space-y-2">
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="rounded border px-3 py-1 text-lg font-bold"
              />
              <input
                type="text"
                value={editForm.slug}
                onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                className="block rounded border px-3 py-1 font-mono text-sm"
                pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
              />
              <input
                type="text"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="block w-96 rounded border px-3 py-1 text-sm"
                placeholder="Description..."
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={actionLoading === 'update'}
                  className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{prompt.name}</h1>
              <p className="mt-0.5 font-mono text-sm text-gray-500">{prompt.slug}</p>
              {prompt.description && (
                <p className="mt-1 text-sm text-gray-600">{prompt.description}</p>
              )}
            </>
          )}
        </div>
        <div className="flex gap-2">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              Edit
            </button>
          )}
          <button
            onClick={handleRollback}
            disabled={actionLoading === 'rollback'}
            className="rounded border px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {actionLoading === 'rollback' ? 'Rolling back...' : 'Rollback'}
          </button>
          <Link
            href={`/dashboard/prompts/managed/${promptId}/ab-tests`}
            className="rounded border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
          >
            A/B Tests
          </Link>
          <button
            onClick={handleDelete}
            disabled={actionLoading === 'delete'}
            className="rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {error && <div className="mt-3 text-sm text-red-500">{error}</div>}

      {/* New Version Button */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Versions</h2>
        <button
          onClick={() => setShowNewVersion(!showNewVersion)}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          {showNewVersion ? 'Cancel' : 'New Version'}
        </button>
      </div>

      {showNewVersion && (
        <form onSubmit={handleCreateVersion} className="mt-3 rounded border bg-white p-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Version Content
          </label>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={5}
            required
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="You are a helpful assistant that..."
          />
          <button
            type="submit"
            disabled={actionLoading === 'create-version'}
            className="mt-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {actionLoading === 'create-version' ? 'Creating...' : 'Create Version'}
          </button>
        </form>
      )}

      {/* Versions List */}
      <div className="mt-4 space-y-3">
        {prompt.versions.map((v: PromptVersion) => {
          const vAnalytics = getAnalyticsForVersion(v.id);
          return (
            <div key={v.id} className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">v{v.version}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[v.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {v.status}
                  </span>
                  {vAnalytics && vAnalytics.callCount > 0 && (
                    <span className="text-xs text-gray-500">
                      {vAnalytics.callCount} calls | ${vAnalytics.totalCostUsd.toFixed(4)} |{' '}
                      {Math.round(vAnalytics.avgLatencyMs)}ms avg
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {v.status !== 'active' && (
                    <button
                      onClick={() => handleDeploy(v.id)}
                      disabled={actionLoading === `deploy-${v.id}`}
                      className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {actionLoading === `deploy-${v.id}` ? 'Deploying...' : 'Deploy'}
                    </button>
                  )}
                  <button
                    onClick={() => handleOptimize(v.id)}
                    disabled={actionLoading === `optimize-${v.id}`}
                    className="rounded border px-3 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    {actionLoading === `optimize-${v.id}` ? 'Optimizing...' : 'Optimize'}
                  </button>
                </div>
              </div>
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                {v.content}
              </pre>
              <p className="mt-1 text-xs text-gray-400">
                Created: {new Date(v.createdAt).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
