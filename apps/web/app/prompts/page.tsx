'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import { MODEL_PRICING, calculatePerRequestCost } from '@launchpromptly/calculators';
import type { PlaygroundModelResult, PlaygroundResponse, ManagedPromptWithVersions } from '@launchpromptly/types';

function extractVariables(content: string): string[] {
  const vars = new Set<string>();
  const pattern = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    vars.add(match[1]!);
  }
  return [...vars];
}

function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    return name in variables && variables[name] ? variables[name] : match;
  });
}

function estimateTokens(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / 0.75);
}

function estimateCost(model: string, tokens: number): number {
  try {
    return calculatePerRequestCost(model, tokens, Math.ceil(tokens / 2));
  } catch {
    return 0;
  }
}

export default function PlaygroundPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400">Loading...</div>}>
      <PlaygroundContent />
    </Suspense>
  );
}

function PlaygroundContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editPromptId = searchParams.get('edit');
  const editVersionId = searchParams.get('version');

  const [systemPrompt, setSystemPrompt] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [platformCredits, setPlatformCredits] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<PlaygroundModelResult[]>([]);
  const [error, setError] = useState('');
  const [editingPromptName, setEditingPromptName] = useState('');

  // Template variables
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const detectedVars = extractVariables(systemPrompt);

  // Publish state
  const [showPublish, setShowPublish] = useState(false);
  const [publishMode, setPublishMode] = useState<'new' | 'version'>('new');
  const [publishForm, setPublishForm] = useState({ slug: '', name: '', description: '' });
  const [existingPrompts, setExistingPrompts] = useState<ManagedPromptWithVersions[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Real-time stats — estimate on the interpolated prompt
  const resolvedForEstimate = detectedVars.length > 0
    ? interpolate(systemPrompt, templateVars)
    : systemPrompt;
  const tokens = estimateTokens(resolvedForEstimate);

  // Load available models (based on org's configured provider keys + platform credits)
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiFetch<{ models: string[]; platformCredits: boolean }>('/playground/models', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        // Handle both old (string[]) and new ({ models, platformCredits }) response shapes
        if (Array.isArray(res)) {
          setAvailableModels(res);
        } else {
          setAvailableModels(res.models);
          setPlatformCredits(res.platformCredits);
        }
      })
      .catch(() => {});
  }, []);

  // Load existing prompts for publish flow
  const loadExistingPrompts = useCallback(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    apiFetch<ManagedPromptWithVersions[]>(
      `/prompt/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then(setExistingPrompts)
      .catch(() => {});
  }, []);

  useEffect(loadExistingPrompts, [loadExistingPrompts]);

  // Pre-fill from managed prompt when editing via URL params
  useEffect(() => {
    if (!editPromptId) return;
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    apiFetch<ManagedPromptWithVersions>(
      `/prompt/${projectId}/${editPromptId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then((prompt) => {
        const version = editVersionId
          ? prompt.versions.find((v) => v.id === editVersionId)
          : prompt.versions.find((v) => v.status === 'active') ?? prompt.versions[0];
        if (version) {
          setSystemPrompt(version.content);
        }
        setEditingPromptName(prompt.name);
        setSelectedPromptId(editPromptId);
        setPublishMode('version');
        setShowPublish(true);
      })
      .catch(() => {});
  }, [editPromptId, editVersionId]);

  const toggleModel = (model: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(model)) return prev.filter((m) => m !== model);
      if (prev.length >= 3) return prev;
      return [...prev, model];
    });
  };

  const handleTest = async () => {
    if (!systemPrompt.trim() || !userMessage.trim() || selectedModels.length === 0) return;
    setTesting(true);
    setError('');
    setResults([]);

    const token = getToken();
    if (!token) {
      setError('Not authenticated.');
      setTesting(false);
      return;
    }

    try {
      // Interpolate template variables before sending to LLM
      const resolvedPrompt = detectedVars.length > 0
        ? interpolate(systemPrompt, templateVars)
        : systemPrompt;

      const res = await apiFetch<PlaygroundResponse>('/playground/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ systemPrompt: resolvedPrompt, userMessage, models: selectedModels }),
      });
      setResults(res.results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const handlePublish = async (deploy: boolean) => {
    setError('');
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) {
      setError('Not authenticated. Please sign in first.');
      return;
    }

    setPublishing(true);
    try {
      if (publishMode === 'new') {
        const result = await apiFetch<{ id: string; versions: { id: string }[] }>(`/prompt/${projectId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            slug: publishForm.slug,
            name: publishForm.name,
            description: publishForm.description || undefined,
            initialContent: systemPrompt,
          }),
        });
        if (deploy && result.versions?.[0]?.id) {
          await apiFetch(`/prompt/${projectId}/${result.id}/versions/${result.versions[0].id}/deploy`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        router.push(`/prompts/managed/${result.id}`);
      } else {
        if (!selectedPromptId) {
          setError('Please select a prompt.');
          setPublishing(false);
          return;
        }
        const version = await apiFetch<{ id: string }>(`/prompt/${projectId}/${selectedPromptId}/versions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ content: systemPrompt }),
        });
        if (deploy && version.id) {
          await apiFetch(`/prompt/${projectId}/${selectedPromptId}/versions/${version.id}/deploy`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        router.push(`/prompts/managed/${selectedPromptId}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const gridCols =
    results.length === 1
      ? 'grid-cols-1'
      : results.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-3';

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Prompt Playground</h1>
        <p className="mt-1 text-sm text-gray-500">
          Test your prompts against multiple models side by side.
        </p>
      </div>

      {editPromptId && editingPromptName && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-sm text-blue-800">
            Editing <span className="font-semibold">{editingPromptName}</span> &mdash; modify the prompt below, test it, then save as a new version.
          </div>
          <Link
            href={`/prompts/managed/${editPromptId}`}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Back to prompt &rarr;
          </Link>
        </div>
      )}

      {/* System Prompt */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">System Prompt</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful assistant..."
          rows={8}
          className="w-full rounded-lg border bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="mt-1 text-xs text-gray-400">
          ~{tokens.toLocaleString()} tokens
        </div>
      </div>

      {/* Template Variables */}
      {detectedVars.length > 0 && (
        <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-purple-800">Template Variables</span>
              <span className="ml-2 text-xs text-purple-600">
                Fill in values before testing. Variables left empty will appear as {'{{name}}'} in the prompt.
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {detectedVars.map((v) => (
              <div key={v}>
                <label className="mb-1 block text-xs font-medium font-mono text-purple-700">
                  {`{{${v}}}`}
                </label>
                <input
                  type="text"
                  value={templateVars[v] ?? ''}
                  onChange={(e) =>
                    setTemplateVars((prev) => ({ ...prev, [v]: e.target.value }))
                  }
                  placeholder={v.replace(/_/g, ' ')}
                  className="w-full rounded border border-purple-200 bg-white px-3 py-1.5 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test User Message */}
      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Test User Message</label>
        <textarea
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          placeholder="What is the capital of France?"
          rows={4}
          className="w-full rounded-lg border bg-white px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Model Selector */}
      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Models {selectedModels.length > 0 && `(${selectedModels.length}/3)`}
        </label>
        {platformCredits && (
          <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Using LaunchPromptly credits for Anthropic models. Add your own API key in{' '}
            <Link href="/admin/providers" className="font-medium underline">Settings</Link>{' '}
            for unlimited usage.
          </div>
        )}
        {availableModels.length === 0 ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            No models available. Please{' '}
            <Link href="/admin/providers" className="font-medium underline">
              add your LLM provider keys
            </Link>{' '}
            in Admin to get started.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableModels.map((model) => {
              const isSelected = selectedModels.includes(model);
              const isDisabled = !isSelected && selectedModels.length >= 3;
              const cost = estimateCost(model, tokens);
              return (
                <button
                  key={model}
                  onClick={() => toggleModel(model)}
                  disabled={isDisabled}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : isDisabled
                        ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {isSelected && '✓ '}{model}
                  {tokens > 0 && (
                    <span className="ml-1 text-gray-400">~${cost.toFixed(4)}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={handleTest}
          disabled={testing || !systemPrompt.trim() || !userMessage.trim() || selectedModels.length === 0}
          className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {testing ? 'Testing...' : 'Test Selected Models'}
        </button>
        <button
          onClick={() => setShowPublish(!showPublish)}
          disabled={!systemPrompt.trim()}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Publish to Managed
        </button>
      </div>

      {error && <div className="mt-3 text-sm text-red-500">{error}</div>}

      {/* Publish panel — immediately after action buttons */}
      {showPublish && (
        <div className="mt-4 rounded-lg border bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase text-gray-500">Publish to Managed</h2>

          <div className="mb-4 flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={publishMode === 'new'}
                onChange={() => setPublishMode('new')}
              />
              Create new managed prompt
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={publishMode === 'version'}
                onChange={() => setPublishMode('version')}
              />
              Add as version to existing
            </label>
          </div>

          {publishMode === 'new' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Slug</label>
                  <input
                    type="text"
                    value={publishForm.slug}
                    onChange={(e) => setPublishForm({ ...publishForm, slug: e.target.value })}
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
                    value={publishForm.name}
                    onChange={(e) => setPublishForm({ ...publishForm, name: e.target.value })}
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
                  value={publishForm.description}
                  onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })}
                  placeholder="Optional description..."
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Select prompt</label>
              <select
                value={selectedPromptId}
                onChange={(e) => setSelectedPromptId(e.target.value)}
                required
                className="w-full rounded border px-3 py-2 text-sm"
              >
                <option value="">Choose a prompt...</option>
                {existingPrompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.slug})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-3 rounded border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              <strong>Draft</strong> = only visible in dashboard. <strong>Deploy</strong> = your SDK serves this version.
            </p>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              disabled={publishing}
              onClick={() => handlePublish(false)}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {publishing ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              type="button"
              disabled={publishing}
              onClick={() => handlePublish(true)}
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {publishing ? 'Deploying...' : 'Save & Deploy'}
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase text-gray-500">Results</h2>
          <div className={`grid ${gridCols} gap-4`}>
            {results.map((result) => (
              <div
                key={result.model}
                className={`rounded-lg border p-4 ${
                  result.error ? 'border-red-200 bg-red-50' : 'bg-white'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{result.model}</span>
                  <span className="text-xs text-gray-400">{result.provider}</span>
                </div>

                {result.error ? (
                  <div className="text-sm text-red-600">{result.error}</div>
                ) : (
                  <>
                    <div className="mb-3 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>{(result.latencyMs / 1000).toFixed(1)}s</span>
                      <span>{result.totalTokens.toLocaleString()} tokens</span>
                      <span>${result.costUsd.toFixed(6)}</span>
                    </div>
                    <div className="max-h-64 overflow-auto rounded border bg-gray-50 p-3">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700">
                        {result.response}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Testing indicator */}
      {testing && (
        <div className="mt-6">
          <div className={`grid ${selectedModels.length === 1 ? 'grid-cols-1' : selectedModels.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-4`}>
            {selectedModels.map((model) => (
              <div key={model} className="animate-pulse rounded-lg border bg-white p-4">
                <div className="mb-2 text-sm font-semibold">{model}</div>
                <div className="space-y-2">
                  <div className="h-3 rounded bg-gray-200" />
                  <div className="h-3 w-3/4 rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
