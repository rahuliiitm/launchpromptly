'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';

interface SecurityPolicy {
  id: string;
  projectId: string;
  name: string;
  description: string;
  rules: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NewPolicyForm {
  name: string;
  description: string;
  rules: string;
  isActive: boolean;
}

const EMPTY_FORM: NewPolicyForm = {
  name: '',
  description: '',
  rules: '{\n  \n}',
  isActive: true,
};

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<SecurityPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPolicy, setNewPolicy] = useState<NewPolicyForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRules, setEditRules] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPolicies = useCallback(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const headers = { Authorization: `Bearer ${token}` };

    apiFetch<SecurityPolicy[]>(
      `/v1/security/policies/${projectId}`,
      { headers },
    )
      .then((data) => setPolicies(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleCreate = async () => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    setFormError('');
    let parsedRules: Record<string, unknown>;
    try {
      parsedRules = JSON.parse(newPolicy.rules);
    } catch {
      setFormError('Rules must be valid JSON.');
      return;
    }

    setSaving(true);
    try {
      const created = await apiFetch<SecurityPolicy>(
        `/v1/security/policies/${projectId}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: newPolicy.name,
            description: newPolicy.description,
            rules: parsedRules,
            isActive: newPolicy.isActive,
          }),
        },
      );
      setPolicies((prev) => [created, ...prev]);
      setNewPolicy(EMPTY_FORM);
      setShowCreateForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create policy');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (policy: SecurityPolicy) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    try {
      const updated = await apiFetch<SecurityPolicy>(
        `/v1/security/policies/${projectId}/${policy.id}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ isActive: !policy.isActive }),
        },
      );
      setPolicies((prev) =>
        prev.map((p) => (p.id === policy.id ? updated : p)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update policy');
    }
  };

  const handleSaveRules = async (policyId: string) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    let parsedRules: Record<string, unknown>;
    try {
      parsedRules = JSON.parse(editRules);
    } catch {
      setFormError('Rules must be valid JSON.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const updated = await apiFetch<SecurityPolicy>(
        `/v1/security/policies/${projectId}/${policyId}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ rules: parsedRules }),
        },
      );
      setPolicies((prev) =>
        prev.map((p) => (p.id === policyId ? updated : p)),
      );
      setEditingId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update rules');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (policyId: string) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    try {
      await apiFetch(
        `/v1/security/policies/${projectId}/${policyId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setPolicies((prev) => prev.filter((p) => p.id !== policyId));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete policy');
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  if (error) {
    return <div className="py-20 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security Policies</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage security rules and policies for your project
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setFormError('');
          }}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancel' : 'Create Policy'}
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="mt-6 rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700">New Policy</h3>
          {formError && (
            <p className="mt-2 text-sm text-red-600">{formError}</p>
          )}
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Name
              </label>
              <input
                type="text"
                value={newPolicy.name}
                onChange={(e) =>
                  setNewPolicy((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. PII Redaction Policy"
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Description
              </label>
              <input
                type="text"
                value={newPolicy.description}
                onChange={(e) =>
                  setNewPolicy((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe what this policy does"
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Rules (JSON)
              </label>
              <textarea
                value={newPolicy.rules}
                onChange={(e) =>
                  setNewPolicy((prev) => ({ ...prev, rules: e.target.value }))
                }
                rows={6}
                className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm"
                spellCheck={false}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setNewPolicy((prev) => ({
                    ...prev,
                    isActive: !prev.isActive,
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  newPolicy.isActive ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    newPolicy.isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-600">
                {newPolicy.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <button
              onClick={handleCreate}
              disabled={saving || !newPolicy.name.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Policy'}
            </button>
          </div>
        </div>
      )}

      {/* Policy list */}
      <div className="mt-6 space-y-4">
        {policies.length === 0 && !showCreateForm && (
          <div className="rounded-lg border bg-white p-8 text-center">
            <h2 className="text-lg font-semibold text-gray-700">
              No policies yet
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Create your first security policy to define rules for PII handling,
              injection protection, and content moderation.
            </p>
          </div>
        )}

        {policies.map((policy) => (
          <div
            key={policy.id}
            className="rounded-lg border bg-white p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {policy.name}
                  </h3>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      policy.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {policy.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {policy.description && (
                  <p className="mt-1 text-sm text-gray-500">
                    {policy.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Created {new Date(policy.createdAt).toLocaleDateString()}
                  {policy.updatedAt !== policy.createdAt && (
                    <> &middot; Updated {new Date(policy.updatedAt).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(policy)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    policy.isActive ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  title={policy.isActive ? 'Deactivate' : 'Activate'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      policy.isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <button
                  onClick={() => {
                    if (editingId === policy.id) {
                      setEditingId(null);
                      setFormError('');
                    } else {
                      setEditingId(policy.id);
                      setEditRules(JSON.stringify(policy.rules, null, 2));
                      setFormError('');
                    }
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {editingId === policy.id ? 'Cancel' : 'Edit Rules'}
                </button>
                {deleteConfirmId === policy.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(policy.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-800"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(policy.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Edit rules inline */}
            {editingId === policy.id && (
              <div className="mt-3 border-t pt-3">
                {formError && (
                  <p className="mb-2 text-sm text-red-600">{formError}</p>
                )}
                <label className="block text-xs font-medium text-gray-500">
                  Rules (JSON)
                </label>
                <textarea
                  value={editRules}
                  onChange={(e) => setEditRules(e.target.value)}
                  rows={8}
                  className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm"
                  spellCheck={false}
                />
                <button
                  onClick={() => handleSaveRules(policy.id)}
                  disabled={saving}
                  className="mt-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Rules'}
                </button>
              </div>
            )}

            {/* Show current rules when not editing */}
            {editingId !== policy.id && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                  View current rules
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                  {JSON.stringify(policy.rules, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
