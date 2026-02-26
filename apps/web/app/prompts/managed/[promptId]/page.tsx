'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import { TextDiff } from '@/components/text-diff';
import type {
  ManagedPromptWithVersions,
  PromptVersion,
  PromptVersionAnalytics,
  PromptDeploymentInfo,
  EnvironmentUsageStats,
  Environment,
} from '@aiecon/types';

function extractVariables(content: string): string[] {
  const vars = new Set<string>();
  const pattern = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    vars.add(match[1]!);
  }
  return [...vars];
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-600',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

function statusIndicator(lastCalledAt: string | null): { color: string; label: string } {
  if (!lastCalledAt) return { color: 'bg-gray-400', label: 'Never called' };
  const diff = Date.now() - new Date(lastCalledAt).getTime();
  if (diff < 5 * 60_000) return { color: 'bg-green-500', label: 'Active' };
  if (diff < 30 * 60_000) return { color: 'bg-yellow-500', label: 'Idle' };
  return { color: 'bg-gray-400', label: 'Inactive' };
}

export default function PromptDetailPage() {
  const { promptId } = useParams<{ promptId: string }>();
  const router = useRouter();
  const [prompt, setPrompt] = useState<ManagedPromptWithVersions | null>(null);
  const [analytics, setAnalytics] = useState<PromptVersionAnalytics[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [deployments, setDeployments] = useState<PromptDeploymentInfo[]>([]);
  const [usageStats, setUsageStats] = useState<EnvironmentUsageStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', slug: '', description: '' });
  const [successBanner, setSuccessBanner] = useState('');
  const [compareWith, setCompareWith] = useState<Record<string, string>>({});
  const [deployDropdown, setDeployDropdown] = useState<string | null>(null); // versionId with open dropdown
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPrompt = useCallback(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      apiFetch<ManagedPromptWithVersions>(
        `/prompt/${projectId}/${promptId}`,
        { headers },
      ),
      apiFetch<PromptVersionAnalytics[]>(
        `/prompt/${projectId}/${promptId}/analytics?days=30`,
        { headers },
      ).catch(() => [] as PromptVersionAnalytics[]),
      apiFetch<Environment[]>(
        `/environment/${projectId}`,
        { headers },
      ).catch(() => [] as Environment[]),
      apiFetch<PromptDeploymentInfo[]>(
        `/prompt/${projectId}/${promptId}/deployments`,
        { headers },
      ).catch(() => [] as PromptDeploymentInfo[]),
      apiFetch<EnvironmentUsageStats[]>(
        `/prompt/${projectId}/${promptId}/deployments/usage`,
        { headers },
      ).catch(() => [] as EnvironmentUsageStats[]),
    ])
      .then(([p, a, envs, deps, usage]) => {
        setPrompt(p);
        setAnalytics(a);
        setEnvironments(envs);
        setDeployments(deps);
        setUsageStats(usage);
        setEditForm({ name: p.name, slug: p.slug, description: p.description });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [promptId]);

  useEffect(loadPrompt, [loadPrompt]);

  // Auto-refresh usage stats every 30 seconds
  useEffect(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    const headers = { Authorization: `Bearer ${token}` };

    pollRef.current = setInterval(() => {
      Promise.all([
        apiFetch<PromptDeploymentInfo[]>(
          `/prompt/${projectId}/${promptId}/deployments`,
          { headers },
        ).catch(() => null),
        apiFetch<EnvironmentUsageStats[]>(
          `/prompt/${projectId}/${promptId}/deployments/usage`,
          { headers },
        ).catch(() => null),
      ]).then(([deps, usage]) => {
        if (deps) setDeployments(deps);
        if (usage) setUsageStats(usage);
      });
    }, 30_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [promptId]);

  // Auto-dismiss success banner
  useEffect(() => {
    if (!successBanner) return;
    const timer = setTimeout(() => setSuccessBanner(''), 5000);
    return () => clearTimeout(timer);
  }, [successBanner]);

  const handleDeployToEnv = async (versionId: string, versionNum: number, envId: string, envName: string, isCritical: boolean) => {
    if (isCritical && !confirm(`Deploy v${versionNum} to ${envName}? This is a critical environment.`)) return;
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    setActionLoading(`deploy-${versionId}-${envId}`);
    setDeployDropdown(null);
    try {
      await apiFetch(`/prompt/${projectId}/${promptId}/versions/${versionId}/deploy-to/${envId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccessBanner(`v${versionNum} deployed to ${envName}.`);
      loadPrompt();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeploy = async (versionId: string, versionNum: number) => {
    if (!confirm(`Deploy v${versionNum} to production? SDK will immediately serve this version.`)) return;
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    setActionLoading(`deploy-${versionId}`);
    try {
      await apiFetch(`/prompt/${projectId}/${promptId}/versions/${versionId}/deploy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccessBanner(`v${versionNum} is now live. Your SDK is serving this version.`);
      loadPrompt();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRollback = async () => {
    const archivedVersions = prompt?.versions.filter((v: PromptVersion) => v.status === 'archived') ?? [];
    const previousVersion = archivedVersions[0];
    if (!previousVersion) return;
    if (!confirm(`Rollback to v${previousVersion.version}? This will replace the active version.`)) return;
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    setActionLoading('rollback');
    try {
      await apiFetch(`/prompt/${projectId}/${promptId}/rollback`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccessBanner(`Rolled back to v${previousVersion.version}.`);
      loadPrompt();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOptimize = (versionId: string) => {
    router.push(`/prompts?edit=${promptId}&version=${versionId}`);
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    const projectId = getProjectId();
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
    const token = getToken();
    const projectId = getProjectId();
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
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    if (!confirm('Are you sure you want to delete this prompt and all versions?')) return;
    setActionLoading('delete');
    try {
      await apiFetch(`/prompt/${projectId}/${promptId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      router.push('/prompts/managed');
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

  const hasActiveVersion = prompt.versions.some((v: PromptVersion) => v.status === 'active');
  const archivedVersions = prompt.versions.filter((v: PromptVersion) => v.status === 'archived');
  const rollbackTarget = archivedVersions.length > 0 ? archivedVersions[0] : null;
  const hasEnvironments = environments.length > 0;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-gray-500">
        <Link href="/prompts/managed" className="hover:text-gray-700">
          Managed Prompts
        </Link>
        {' > '}
        <span className="text-gray-800">{prompt.name}</span>
      </div>

      {/* Success banner */}
      {successBanner && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successBanner}
        </div>
      )}

      {/* No active version warning */}
      {!hasActiveVersion && deployments.length === 0 && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          No active deployment. SDK calls for this prompt will fail until you deploy a version.
        </div>
      )}

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
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{prompt.name}</h1>
                {prompt.team && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: prompt.team.color }}
                  >
                    {prompt.team.name}
                  </span>
                )}
              </div>
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
            disabled={actionLoading === 'rollback' || !rollbackTarget}
            className="rounded border px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
            title={rollbackTarget ? `Rollback to v${rollbackTarget.version}` : 'No previous version to rollback to'}
          >
            {actionLoading === 'rollback'
              ? 'Rolling back...'
              : rollbackTarget
                ? `Rollback to v${rollbackTarget.version}`
                : 'Rollback'}
          </button>
          <Link
            href={`/prompts/managed/${promptId}/evals`}
            className="rounded border border-purple-200 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50"
          >
            Evals
          </Link>
          <Link
            href={`/prompts/managed/${promptId}/ab-tests`}
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

      {/* ── Deployment Status Panel ── */}
      {hasEnvironments && (
        <div className="mt-6 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Deployment Status
            </h2>
            <button
              onClick={loadPrompt}
              className="text-xs text-gray-500 hover:text-gray-700"
              title="Refresh"
            >
              Refresh
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {environments.map((env) => {
              const dep = deployments.find((d) => d.environmentId === env.id);
              const usage = usageStats.find((u) => u.environmentId === env.id);
              const indicator = dep ? statusIndicator(usage?.lastCalledAt ?? null) : null;

              return (
                <div
                  key={env.id}
                  className="flex items-center gap-3 rounded border px-3 py-2 text-sm"
                >
                  {/* Color dot + env name */}
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: env.color }}
                  />
                  <span className="w-36 shrink-0 font-medium truncate">{env.name}</span>

                  {dep ? (
                    <>
                      {/* Version badge */}
                      <span className="shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        v{dep.version}
                      </span>

                      {/* Status indicator */}
                      <span className="flex items-center gap-1 shrink-0">
                        <span className={`h-2 w-2 rounded-full ${indicator!.color}`} />
                        <span className="text-xs text-gray-500">{indicator!.label}</span>
                      </span>

                      {/* Call count 24h */}
                      <span className="text-xs text-gray-500 shrink-0">
                        {usage?.callCount24h ?? 0} calls (24h)
                      </span>

                      {/* Last called */}
                      {usage?.lastCalledAt && (
                        <span className="text-xs text-gray-400 shrink-0">
                          last: {timeAgo(usage.lastCalledAt)}
                        </span>
                      )}

                    </>
                  ) : (
                    <span className="text-xs text-gray-400">Not deployed</span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-gray-400">
            Auto-refreshes every 30s. Manage environments in{' '}
            <Link href="/admin/environments" className="text-blue-600 hover:underline">
              Admin &gt; Environments
            </Link>.
          </p>
        </div>
      )}

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

      {showNewVersion && (() => {
        const detectedVars = extractVariables(newContent);
        return (
          <form onSubmit={handleCreateVersion} className="mt-3 rounded border bg-white p-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Version Content
            </label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={5}
              required
              className="w-full rounded border px-3 py-2 font-mono text-sm"
              placeholder={'You are a {{role}} assistant.\nHelp {{user_name}} with their question about {{topic}}.'}
            />
            {detectedVars.length > 0 && (
              <div className="mt-2">
                <span className="text-xs font-medium text-gray-500">Template variables: </span>
                {detectedVars.map((v) => (
                  <span
                    key={v}
                    className="mr-1 inline-block rounded bg-purple-100 px-2 py-0.5 text-xs font-mono text-purple-700"
                  >
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            )}
            <button
              type="submit"
              disabled={actionLoading === 'create-version'}
              className="mt-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading === 'create-version' ? 'Creating...' : 'Create Version'}
            </button>
          </form>
        );
      })()}

      {/* Versions List */}
      <div className="mt-4 space-y-3">
        {prompt.versions.map((v: PromptVersion) => {
          const vAnalytics = getAnalyticsForVersion(v.id);
          const compareTargetId = compareWith[v.id];
          const compareTarget = compareTargetId
            ? prompt.versions.find((other: PromptVersion) => other.id === compareTargetId)
            : null;

          // Which environments is this version deployed to?
          const deployedTo = deployments.filter((d) => d.promptVersionId === v.id);

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
                  {/* Env badges for this version */}
                  {deployedTo.map((d) => (
                    <span
                      key={d.environmentId}
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs"
                      style={{
                        backgroundColor: `${d.environmentColor}20`,
                        color: d.environmentColor,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: d.environmentColor }}
                      />
                      {d.environmentName}
                    </span>
                  ))}
                  {vAnalytics && vAnalytics.callCount > 0 && (
                    <span className="text-xs text-gray-500">
                      {vAnalytics.callCount} calls | ${vAnalytics.totalCostUsd.toFixed(4)} |{' '}
                      {Math.round(vAnalytics.avgLatencyMs)}ms avg
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {/* Deploy to environment dropdown */}
                  {hasEnvironments && (
                    <div className="relative">
                      <button
                        onClick={() =>
                          setDeployDropdown(deployDropdown === v.id ? null : v.id)
                        }
                        disabled={!!actionLoading}
                        className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Deploy to...
                      </button>
                      {deployDropdown === v.id && (
                        <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded border bg-white py-1 shadow-lg">
                          {environments.map((env) => (
                            <button
                              key={env.id}
                              onClick={() =>
                                handleDeployToEnv(v.id, v.version, env.id, env.name, env.isCritical)
                              }
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50"
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: env.color }}
                              />
                              {env.name}
                              {env.isCritical && (
                                <span className="ml-auto text-red-500">!</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Legacy deploy button (if no environments configured) */}
                  {!hasEnvironments && v.status !== 'active' && (
                    <button
                      onClick={() => handleDeploy(v.id, v.version)}
                      disabled={actionLoading === `deploy-${v.id}`}
                      className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {actionLoading === `deploy-${v.id}` ? 'Deploying...' : 'Deploy'}
                    </button>
                  )}
                  <button
                    onClick={() => handleOptimize(v.id)}
                    className="rounded border px-3 py-1 text-xs font-medium hover:bg-gray-50"
                  >
                    Edit in Playground
                  </button>
                </div>
              </div>
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-50 p-3 font-mono text-sm text-gray-700 whitespace-pre-wrap">
                {v.content}
              </pre>

              {/* Template variables */}
              {(() => {
                const vars = extractVariables(v.content);
                if (vars.length === 0) return null;
                return (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-gray-500">Variables: </span>
                    {vars.map((varName) => (
                      <span
                        key={varName}
                        className="mr-1 inline-block rounded bg-purple-100 px-2 py-0.5 text-xs font-mono text-purple-700"
                      >
                        {`{{${varName}}}`}
                      </span>
                    ))}
                  </div>
                );
              })()}

              {/* Compare dropdown */}
              {prompt.versions.length > 1 && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-gray-500">Compare with:</label>
                  <select
                    value={compareWith[v.id] ?? ''}
                    onChange={(e) =>
                      setCompareWith((prev) => ({
                        ...prev,
                        [v.id]: e.target.value,
                      }))
                    }
                    className="rounded border px-2 py-1 text-xs"
                  >
                    <option value="">None</option>
                    {prompt.versions
                      .filter((other: PromptVersion) => other.id !== v.id)
                      .map((other: PromptVersion) => (
                        <option key={other.id} value={other.id}>
                          v{other.version}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Diff view */}
              {compareTarget && (
                <div className="mt-2">
                  <TextDiff
                    oldText={compareTarget.content}
                    newText={v.content}
                    oldLabel={`v${compareTarget.version}`}
                    newLabel={`v${v.version}`}
                  />
                </div>
              )}

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
