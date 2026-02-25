'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type { EnvironmentWithKey } from '@aiecon/types';

interface CreateForm {
  name: string;
  slug: string;
  color: string;
}

const DEFAULT_COLORS = [
  '#059669', // green
  '#6366F1', // indigo
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function EnvironmentsPage() {
  const [environments, setEnvironments] = useState<EnvironmentWithKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    name: '',
    slug: '',
    color: '#6366F1',
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [creating, setCreating] = useState(false);

  // Newly created key (shown once)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{
    envId: string;
    rawKey: string;
  } | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    color: string;
    isCritical: boolean;
  }>({ name: '', color: '', isCritical: false });

  // Confirm dialog
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete' | 'reset';
    envId: string;
    envName: string;
  } | null>(null);

  // Success banner
  const [successMsg, setSuccessMsg] = useState('');

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  }, []);

  const fetchEnvironments = useCallback(async () => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }
    try {
      const envs = await apiFetch<EnvironmentWithKey[]>(
        `/environment/${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setEnvironments(envs);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const handleCreate = async () => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId || !createForm.name || !createForm.slug) return;

    setCreating(true);
    try {
      const result = await apiFetch<EnvironmentWithKey & { sdkKey: string }>(
        `/environment/${projectId}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(createForm),
        },
      );

      setNewlyCreatedKey({ envId: result.id, rawKey: result.sdkKey });
      setShowCreate(false);
      setCreateForm({ name: '', slug: '', color: '#6366F1' });
      setSlugEdited(false);
      showSuccess(`Environment "${result.name}" created.`);
      await fetchEnvironments();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (envId: string) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    try {
      await apiFetch(`/environment/${projectId}/${envId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      setEditingId(null);
      showSuccess('Environment updated.');
      await fetchEnvironments();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (envId: string) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    try {
      await apiFetch(`/environment/${projectId}/${envId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setConfirmAction(null);
      showSuccess('Environment deleted.');
      await fetchEnvironments();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleResetKey = async (envId: string) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    try {
      const result = await apiFetch<{ sdkKey: string }>(
        `/environment/${projectId}/${envId}/reset-key`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setConfirmAction(null);
      setNewlyCreatedKey({ envId, rawKey: result.sdkKey });
      showSuccess('SDK key rotated. Copy the new key below.');
      await fetchEnvironments();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess('Copied to clipboard.');
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Environments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Each environment has its own SDK key. Deploy different prompt versions per environment.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Create Environment
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button
            onClick={() => setError('')}
            className="ml-2 text-red-500 underline"
          >
            dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="mt-4 rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700">
            New Environment
          </h3>
          <div className="mt-3 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Name
              </label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setCreateForm((f) => ({
                    ...f,
                    name,
                    slug: slugEdited ? f.slug : slugify(name),
                  }));
                }}
                placeholder="e.g. Staging"
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Slug (immutable)
              </label>
              <input
                type="text"
                value={createForm.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setCreateForm((f) => ({ ...f, slug: e.target.value }));
                }}
                placeholder="e.g. staging"
                className="mt-1 w-full rounded border px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Color
              </label>
              <div className="mt-1 flex items-center gap-2">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCreateForm((f) => ({ ...f, color: c }))}
                    className={`h-6 w-6 rounded-full border-2 ${
                      createForm.color === c
                        ? 'border-gray-800'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !createForm.name || !createForm.slug}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Environment List */}
      <div className="mt-6 space-y-3">
        {environments.map((env) => (
          <div key={env.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: env.color }}
                />
                {editingId === env.id ? (
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="rounded border px-2 py-1 text-sm font-semibold"
                  />
                ) : (
                  <span className="font-semibold text-gray-900">
                    {env.name}
                  </span>
                )}
                {env.isCritical && (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    Critical
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editingId === env.id ? (
                  <>
                    <label className="flex items-center gap-1 text-xs text-gray-600">
                      <input
                        type="checkbox"
                        checked={editForm.isCritical}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            isCritical: e.target.checked,
                          }))
                        }
                      />
                      Critical
                    </label>
                    <div className="flex gap-1">
                      {DEFAULT_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() =>
                            setEditForm((f) => ({ ...f, color: c }))
                          }
                          className={`h-4 w-4 rounded-full border ${
                            editForm.color === c
                              ? 'border-gray-800'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => handleUpdate(env.id)}
                      className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-gray-500"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingId(env.id);
                        setEditForm({
                          name: env.name,
                          color: env.color,
                          isCritical: env.isCritical,
                        });
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        setConfirmAction({
                          type: 'delete',
                          envId: env.id,
                          envName: env.name,
                        })
                      }
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              slug: <span className="font-mono">{env.slug}</span>
            </div>

            {/* SDK Key */}
            <div className="mt-3 flex items-center gap-2 rounded bg-gray-50 px-3 py-2">
              <span className="text-xs font-medium text-gray-500">
                SDK Key:
              </span>
              {newlyCreatedKey?.envId === env.id ? (
                <code className="flex-1 break-all text-xs font-mono text-green-700">
                  {newlyCreatedKey.rawKey}
                </code>
              ) : (
                <code className="flex-1 text-xs font-mono text-gray-600">
                  {env.sdkKeyPrefix ? `${env.sdkKeyPrefix}...` : 'No key'}
                </code>
              )}
              {newlyCreatedKey?.envId === env.id && (
                <button
                  onClick={() => copyToClipboard(newlyCreatedKey.rawKey)}
                  className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                >
                  Copy
                </button>
              )}
              <button
                onClick={() =>
                  setConfirmAction({
                    type: 'reset',
                    envId: env.id,
                    envName: env.name,
                  })
                }
                className="text-xs text-orange-600 hover:text-orange-800"
              >
                Reset
              </button>
            </div>

            {newlyCreatedKey?.envId === env.id && (
              <p className="mt-1 text-xs text-yellow-700">
                Copy this key now — it will not be shown again.
              </p>
            )}
          </div>
        ))}

        {environments.length === 0 && (
          <p className="text-sm text-gray-400">
            No environments yet. Create one to get started.
          </p>
        )}
      </div>

      {/* Quick Start */}
      <div className="mt-8 rounded-lg border bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-700">Quick Start</h3>
        <pre className="mt-3 overflow-x-auto rounded bg-gray-900 p-4 text-xs text-gray-100">
{`# Set the env var for your target environment:
export PLANFORGE_API_KEY="pf_live_..."

# In your code — no key needed, reads from env:
import { PlanForge } from '@aiecon/sdk';

const pf = new PlanForge();
const prompt = await pf.prompt('my-prompt');`}
        </pre>
        <p className="mt-2 text-xs text-gray-500">
          Each environment has its own SDK key. The key determines which prompt
          versions are resolved — no environment parameter is needed in code.
        </p>
      </div>

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">
              {confirmAction.type === 'delete'
                ? 'Delete Environment'
                : 'Reset SDK Key'}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {confirmAction.type === 'delete'
                ? `Are you sure you want to delete "${confirmAction.envName}"? This will also revoke its SDK key.`
                : `Are you sure you want to reset the SDK key for "${confirmAction.envName}"? The current key will stop working immediately.`}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="rounded border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  confirmAction.type === 'delete'
                    ? handleDelete(confirmAction.envId)
                    : handleResetKey(confirmAction.envId)
                }
                className={`rounded px-4 py-2 text-sm font-medium text-white ${
                  confirmAction.type === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {confirmAction.type === 'delete' ? 'Delete' : 'Reset Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
