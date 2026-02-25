'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import type {
  EvalDataset,
  EvalDatasetWithCases,
  EvalCase,
  EvalRun,
  EvalRunWithResults,
  PromptVersion,
  ManagedPromptWithVersions,
} from '@aiecon/types';

export default function EvalsPage() {
  const { promptId } = useParams<{ promptId: string }>();
  const [prompt, setPrompt] = useState<ManagedPromptWithVersions | null>(null);
  const [datasets, setDatasets] = useState<EvalDataset[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<EvalDatasetWithCases | null>(null);
  const [selectedRun, setSelectedRun] = useState<EvalRunWithResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState('');

  // New dataset form
  const [showNewDataset, setShowNewDataset] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState('');
  const [newDatasetThreshold, setNewDatasetThreshold] = useState('3.5');

  // New case form
  const [showNewCase, setShowNewCase] = useState(false);
  const [newCaseInput, setNewCaseInput] = useState('');
  const [newCaseExpected, setNewCaseExpected] = useState('');
  const [newCaseVariables, setNewCaseVariables] = useState('');
  const [newCaseCriteria, setNewCaseCriteria] = useState('');
  const [generating, setGenerating] = useState(false);

  const loadData = useCallback(() => {
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
      apiFetch<EvalDataset[]>(
        `/eval/${projectId}/${promptId}/datasets`,
        { headers },
      ).catch(() => [] as EvalDataset[]),
      apiFetch<EvalRun[]>(
        `/eval/${projectId}/${promptId}/runs`,
        { headers },
      ).catch(() => [] as EvalRun[]),
    ])
      .then(([p, d, r]) => {
        setPrompt(p);
        setDatasets(d);
        setRuns(r);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [promptId]);

  useEffect(loadData, [loadData]);

  useEffect(() => {
    if (!successBanner) return;
    const timer = setTimeout(() => setSuccessBanner(''), 5000);
    return () => clearTimeout(timer);
  }, [successBanner]);

  const handleCreateDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId || !newDatasetName.trim()) return;
    setActionLoading('create-dataset');
    try {
      await apiFetch(`/eval/${projectId}/${promptId}/datasets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: newDatasetName,
          passThreshold: parseFloat(newDatasetThreshold) || 3.5,
        }),
      });
      setNewDatasetName('');
      setNewDatasetThreshold('3.5');
      setShowNewDataset(false);
      setSuccessBanner('Dataset created.');
      loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteDataset = async (dsId: string) => {
    if (!confirm('Delete this dataset and all its test cases?')) return;
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    try {
      await apiFetch(`/eval/${projectId}/${promptId}/datasets/${dsId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (selectedDataset?.id === dsId) setSelectedDataset(null);
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSelectDataset = async (dsId: string) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    try {
      const ds = await apiFetch<EvalDatasetWithCases>(
        `/eval/${projectId}/${promptId}/datasets/${dsId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSelectedDataset(ds);
      setSelectedRun(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDataset) return;
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId || !newCaseInput.trim()) return;
    setActionLoading('add-case');
    try {
      let variables: Record<string, string> | undefined;
      if (newCaseVariables.trim()) {
        try {
          variables = JSON.parse(newCaseVariables);
        } catch {
          setError('Variables must be valid JSON, e.g. {"name": "Alice"}');
          setActionLoading(null);
          return;
        }
      }
      await apiFetch(
        `/eval/${projectId}/${promptId}/datasets/${selectedDataset.id}/cases`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            input: newCaseInput,
            expectedOutput: newCaseExpected || undefined,
            variables,
            criteria: newCaseCriteria || undefined,
          }),
        },
      );
      setNewCaseInput('');
      setNewCaseExpected('');
      setNewCaseVariables('');
      setNewCaseCriteria('');
      setShowNewCase(false);
      handleSelectDataset(selectedDataset.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!selectedDataset) return;
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    try {
      await apiFetch(
        `/eval/${projectId}/${promptId}/datasets/${selectedDataset.id}/cases/${caseId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      handleSelectDataset(selectedDataset.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRunEval = async (datasetId: string, versionId: string) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    setActionLoading(`run-${datasetId}-${versionId}`);
    try {
      const run = await apiFetch<EvalRunWithResults>(
        `/eval/${projectId}/${promptId}/datasets/${datasetId}/run`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ promptVersionId: versionId }),
        },
      );
      setSelectedRun(run);
      setSuccessBanner(
        run.passed
          ? `Eval passed! Score: ${run.score}/5`
          : `Eval failed. Score: ${run.score}/5 (threshold: ${selectedDataset?.passThreshold ?? 3.5})`,
      );
      loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewRun = async (runId: string) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    try {
      const run = await apiFetch<EvalRunWithResults>(
        `/eval/${projectId}/${promptId}/runs/${runId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSelectedRun(run);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleGenerateDataset = async () => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId || versions.length === 0) return;
    const latestVersion = versions[0];
    setGenerating(true);
    setError('');
    try {
      const dataset = await apiFetch<EvalDatasetWithCases>(
        `/eval/${projectId}/${promptId}/datasets/generate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ promptVersionId: latestVersion!.id }),
        },
      );
      setSelectedDataset(dataset);
      setSelectedRun(null);
      setSuccessBanner(`Generated dataset with ${dataset.cases?.length ?? 0} test cases.`);
      loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  const versions = prompt?.versions ?? [];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-gray-500">
        <Link href="/prompts/managed" className="hover:text-gray-700">Managed Prompts</Link>
        {' > '}
        <Link href={`/prompts/managed/${promptId}`} className="hover:text-gray-700">
          {prompt?.name ?? promptId}
        </Link>
        {' > '}
        <span className="text-gray-800">Evaluations</span>
      </div>

      {successBanner && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
          successBanner.includes('failed')
            ? 'border-red-200 bg-red-50 text-red-800'
            : 'border-green-200 bg-green-50 text-green-800'
        }`}>
          {successBanner}
        </div>
      )}
      {error && (
        <div className="mb-4 text-sm text-red-500">{error}</div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Evaluations</h1>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateDataset}
            disabled={generating || versions.length === 0}
            className="rounded bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Dataset'}
          </button>
          <button
            onClick={() => setShowNewDataset(!showNewDataset)}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            {showNewDataset ? 'Cancel' : 'New Dataset'}
          </button>
        </div>
      </div>

      <p className="mt-1 text-sm text-gray-500">
        Create test datasets or auto-generate them from your prompt. Eval runs execute your
        prompt against each test case and score the actual responses using LLM-as-judge.
      </p>

      {/* New Dataset Form */}
      {showNewDataset && (
        <form onSubmit={handleCreateDataset} className="mt-4 rounded border bg-white p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Dataset Name</label>
              <input
                type="text"
                value={newDatasetName}
                onChange={(e) => setNewDatasetName(e.target.value)}
                required
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="e.g. Core Scenarios"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Pass Threshold (1-5)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={newDatasetThreshold}
                onChange={(e) => setNewDatasetThreshold(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={actionLoading === 'create-dataset'}
            className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {actionLoading === 'create-dataset' ? 'Creating...' : 'Create Dataset'}
          </button>
        </form>
      )}

      <div className="mt-6 grid grid-cols-3 gap-6">
        {/* Left: Dataset List */}
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Datasets</h2>
          {datasets.length === 0 ? (
            <p className="text-sm text-gray-400">No datasets yet. Create one to get started.</p>
          ) : (
            <div className="space-y-2">
              {datasets.map((ds) => (
                <div
                  key={ds.id}
                  className={`cursor-pointer rounded border p-3 text-sm transition-colors ${
                    selectedDataset?.id === ds.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleSelectDataset(ds.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{ds.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDataset(ds.id);
                      }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {ds._count?.cases ?? 0} cases | {ds._count?.runs ?? 0} runs | threshold: {ds.passThreshold}/5
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Runs */}
          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Recent Runs
          </h2>
          {runs.length === 0 ? (
            <p className="text-sm text-gray-400">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {runs.slice(0, 10).map((run) => (
                <div
                  key={run.id}
                  className={`cursor-pointer rounded border p-2 text-xs transition-colors ${
                    selectedRun?.id === run.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleViewRun(run.id)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        run.passed === true
                          ? 'bg-green-500'
                          : run.passed === false
                            ? 'bg-red-500'
                            : 'bg-yellow-500'
                      }`}
                    />
                    <span className="font-medium">
                      v{(run as any).promptVersion?.version ?? '?'}
                    </span>
                    <span className="text-gray-500">
                      {run.score !== null ? `${run.score}/5` : run.status}
                    </span>
                    <span className="ml-auto text-gray-400">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Dataset Detail or Run Results */}
        <div className="col-span-2">
          {selectedRun ? (
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Eval Run — v{selectedRun.promptVersion?.version ?? '?'}
                </h2>
                <button
                  onClick={() => setSelectedRun(null)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>

              <div className="mt-2 flex items-center gap-4">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    selectedRun.passed
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {selectedRun.passed ? 'PASSED' : 'FAILED'}
                </span>
                <span className="text-sm">
                  Score: <strong>{selectedRun.score}/5</strong>
                </span>
                <span className="text-xs text-gray-500">
                  Threshold: {selectedRun.dataset?.passThreshold ?? 3.5}/5
                </span>
              </div>

              {/* Results table */}
              <div className="mt-4 space-y-3">
                {selectedRun.results?.map((result, i) => (
                  <div key={result.id} className="rounded border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">
                        Case #{i + 1}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          result.score >= 4
                            ? 'bg-green-100 text-green-700'
                            : result.score >= 3
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {result.score}/5
                      </span>
                    </div>
                    <div className="mt-1 text-sm">
                      <span className="font-medium">Input: </span>
                      <span className="text-gray-700">{result.evalCase?.input ?? 'N/A'}</span>
                    </div>
                    {result.response && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-gray-600">Response:</span>
                        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-700">
                          {result.response}
                        </pre>
                      </div>
                    )}
                    <div className="mt-1 text-xs text-gray-600">
                      <span className="font-medium">Reasoning: </span>
                      {result.reasoning}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : selectedDataset ? (
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{selectedDataset.name}</h2>
                <button
                  onClick={() => setShowNewCase(!showNewCase)}
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  {showNewCase ? 'Cancel' : 'Add Case'}
                </button>
              </div>

              {/* Run eval against a version */}
              <div className="mt-3 rounded border border-purple-200 bg-purple-50 p-3">
                <p className="text-xs font-medium text-purple-700">Run Evaluation</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {versions.map((v: PromptVersion) => (
                    <button
                      key={v.id}
                      onClick={() => handleRunEval(selectedDataset.id, v.id)}
                      disabled={actionLoading?.startsWith('run-') || selectedDataset.cases.length === 0}
                      className="rounded border border-purple-300 bg-white px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                    >
                      {actionLoading === `run-${selectedDataset.id}-${v.id}`
                        ? 'Running...'
                        : `Eval v${v.version}`}
                    </button>
                  ))}
                </div>
                {selectedDataset.cases.length === 0 && (
                  <p className="mt-1 text-xs text-purple-500">Add test cases before running.</p>
                )}
              </div>

              {/* Add case form */}
              {showNewCase && (
                <form onSubmit={handleAddCase} className="mt-3 rounded border bg-white p-4">
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Test Input (user message)
                      </label>
                      <textarea
                        value={newCaseInput}
                        onChange={(e) => setNewCaseInput(e.target.value)}
                        rows={2}
                        required
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="How do I reset my password?"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Expected Output (optional reference)
                      </label>
                      <textarea
                        value={newCaseExpected}
                        onChange={(e) => setNewCaseExpected(e.target.value)}
                        rows={2}
                        className="w-full rounded border px-3 py-2 text-sm"
                        placeholder="Should mention the forgot password link..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Template Variables (JSON, optional)
                        </label>
                        <input
                          type="text"
                          value={newCaseVariables}
                          onChange={(e) => setNewCaseVariables(e.target.value)}
                          className="w-full rounded border px-3 py-2 font-mono text-sm"
                          placeholder='{"name": "Alice"}'
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Criteria (optional)
                        </label>
                        <input
                          type="text"
                          value={newCaseCriteria}
                          onChange={(e) => setNewCaseCriteria(e.target.value)}
                          className="w-full rounded border px-3 py-2 text-sm"
                          placeholder="Must mention refund policy"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading === 'add-case'}
                    className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading === 'add-case' ? 'Adding...' : 'Add Case'}
                  </button>
                </form>
              )}

              {/* Cases list */}
              <div className="mt-4 space-y-2">
                {selectedDataset.cases.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No test cases yet. Add cases to define what good prompt behavior looks like.
                  </p>
                ) : (
                  selectedDataset.cases.map((c: EvalCase, i: number) => (
                    <div key={c.id} className="rounded border bg-white p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Case #{i + 1}</span>
                        <button
                          onClick={() => handleDeleteCase(c.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="mt-1 text-sm">
                        <span className="font-medium">Input: </span>
                        <span className="text-gray-700">{c.input}</span>
                      </div>
                      {c.expectedOutput && (
                        <div className="mt-1 text-xs text-gray-500">
                          <span className="font-medium">Expected: </span>
                          {c.expectedOutput}
                        </div>
                      )}
                      {c.variables && (
                        <div className="mt-1">
                          {Object.entries(c.variables).map(([k, v]) => (
                            <span
                              key={k}
                              className="mr-1 inline-block rounded bg-purple-100 px-2 py-0.5 text-xs font-mono text-purple-700"
                            >
                              {k}={String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                      {c.criteria && (
                        <div className="mt-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
                          <span className="font-semibold">Criteria: </span>
                          {c.criteria}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-gray-400">
              Select a dataset or run to see details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
