'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import {
  getOnboardingState,
  updateOnboarding,
  dismissOnboarding,
  type OnboardingState,
} from '@/lib/onboarding';
import { Spinner } from '@/components/spinner';

interface Props {
  onComplete: () => void;
}

export function OnboardingChecklist({ onComplete }: Props) {
  const [state, setState] = useState<OnboardingState>(getOnboardingState);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [generatedKey, setGeneratedKey] = useState('');
  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [tab, setTab] = useState<'node' | 'python'>('node');
  const [copied, setCopied] = useState('');

  // Auto-expand next incomplete step
  useEffect(() => {
    if (!state.apiKeyGenerated) setExpandedStep(1);
    else if (!state.sdkInstalled) setExpandedStep(2);
    else if (!state.firstCallMade) setExpandedStep(3);
    else setExpandedStep(4);
  }, [state]);

  const completedCount = [state.apiKeyGenerated, state.sdkInstalled, state.firstCallMade].filter(Boolean).length;

  function advance(partial: Partial<OnboardingState>) {
    updateOnboarding(partial);
    setState(getOnboardingState());
  }

  async function handleGenerateKey() {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    setGenerating(true);
    try {
      const result = await apiFetch<{ apiKey: { id: string }; rawKey: string }>(
        `/project/${projectId}/api-keys`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: 'Getting Started Key' }),
        },
      );
      setGeneratedKey(result.rawKey);
      advance({ apiKeyGenerated: true });
    } catch {
      // Silently fail — user can retry
    } finally {
      setGenerating(false);
    }
  }

  async function handleCheckEvents() {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;
    setChecking(true);
    try {
      const data = await apiFetch<{ totalEvents: number }>(
        `/analytics/${projectId}/security/overview?days=30`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.totalEvents > 0) {
        advance({ firstCallMade: true });
      }
    } catch {
      // Ignore
    } finally {
      setChecking(false);
    }
  }

  function handleDismiss() {
    dismissOnboarding();
    onComplete();
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  const apiKeyForSnippet = generatedKey || 'YOUR_API_KEY';

  const nodeInstall = 'npm install launchpromptly';
  const pythonInstall = 'pip install launchpromptly';

  const nodeSnippet = `import { LaunchPromptly } from 'launchpromptly';
import OpenAI from 'openai';

const lp = new LaunchPromptly({ apiKey: '${apiKeyForSnippet}' });
const openai = lp.wrap(new OpenAI());

// That's it — all calls through openai are now protected
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello world' }],
});`;

  const pythonSnippet = `from launchpromptly import LaunchPromptly
from openai import OpenAI

lp = LaunchPromptly(api_key="${apiKeyForSnippet}")
openai = lp.wrap(OpenAI())

# That's it — all calls through openai are now protected
response = openai.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello world"}],
)`;

  if (state.completedAt) {
    onComplete();
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl py-12 px-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome to LaunchPromptly</h1>
          <p className="mt-2 text-gray-500">
            Get your LLM security up and running in under 5 minutes.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Skip setup
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-8">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{completedCount} of 3 steps completed</span>
          <span>{Math.round((completedCount / 3) * 100)}%</span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all"
            style={{ width: `${(completedCount / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="mt-8 space-y-4">
        {/* Step 1: Generate API Key */}
        <StepCard
          number={1}
          title="Generate an API Key"
          completed={state.apiKeyGenerated}
          expanded={expandedStep === 1}
          onToggle={() => setExpandedStep(expandedStep === 1 ? null : 1)}
        >
          <p className="text-sm text-gray-600 mb-4">
            API keys authenticate the SDK with your project. Generate one to get started.
          </p>
          {generatedKey ? (
            <div className="rounded border border-green-300 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800 mb-2">
                Key generated! Copy it now — it won&apos;t be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-white border px-3 py-2 text-xs font-mono">
                  {generatedKey}
                </code>
                <button
                  onClick={() => copyToClipboard(generatedKey, 'key')}
                  className="shrink-0 rounded bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700"
                >
                  {copied === 'key' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerateKey}
              disabled={generating}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? <><Spinner className="inline h-4 w-4 mr-1" /> Generating...</> : 'Generate API Key'}
            </button>
          )}
        </StepCard>

        {/* Step 2: Install the SDK */}
        <StepCard
          number={2}
          title="Install the SDK"
          completed={state.sdkInstalled}
          expanded={expandedStep === 2}
          onToggle={() => setExpandedStep(expandedStep === 2 ? null : 2)}
        >
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setTab('node')}
              className={`rounded px-3 py-1 text-sm font-medium ${
                tab === 'node' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Node.js
            </button>
            <button
              onClick={() => setTab('python')}
              className={`rounded px-3 py-1 text-sm font-medium ${
                tab === 'python' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Python
            </button>
          </div>
          <div className="relative rounded bg-gray-900 p-4">
            <code className="text-sm text-gray-300">
              {tab === 'node' ? nodeInstall : pythonInstall}
            </code>
            <button
              onClick={() => copyToClipboard(tab === 'node' ? nodeInstall : pythonInstall, 'install')}
              className="absolute right-2 top-2 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
            >
              {copied === 'install' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => advance({ sdkInstalled: true })}
            className="mt-4 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            I&apos;ve installed it
          </button>
        </StepCard>

        {/* Step 3: Make Your First Call */}
        <StepCard
          number={3}
          title="Make Your First LLM Call"
          completed={state.firstCallMade}
          expanded={expandedStep === 3}
          onToggle={() => setExpandedStep(expandedStep === 3 ? null : 3)}
        >
          <p className="text-sm text-gray-600 mb-3">
            Wrap your LLM client with LaunchPromptly and make a call. Events will appear automatically.
          </p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setTab('node')}
              className={`rounded px-3 py-1 text-sm font-medium ${
                tab === 'node' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Node.js
            </button>
            <button
              onClick={() => setTab('python')}
              className={`rounded px-3 py-1 text-sm font-medium ${
                tab === 'python' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Python
            </button>
          </div>
          <div className="relative rounded bg-gray-900 p-4 overflow-x-auto">
            <pre className="text-sm text-gray-300 leading-relaxed">
              {tab === 'node' ? nodeSnippet : pythonSnippet}
            </pre>
            <button
              onClick={() => copyToClipboard(tab === 'node' ? nodeSnippet : pythonSnippet, 'snippet')}
              className="absolute right-2 top-2 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
            >
              {copied === 'snippet' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleCheckEvents}
              disabled={checking}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {checking ? <><Spinner className="inline h-4 w-4 mr-1" /> Checking...</> : 'Check for Events'}
            </button>
            <span className="text-xs text-gray-400">
              Click after making your first wrapped LLM call
            </span>
          </div>
        </StepCard>
      </div>

      {/* All done message */}
      {completedCount === 3 && (
        <div className="mt-8 rounded-lg border border-green-300 bg-green-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-green-800">You&apos;re all set!</h2>
          <p className="mt-1 text-sm text-green-700">
            Your LLM calls are now protected. Head to the dashboard to see your security metrics.
          </p>
          <button
            onClick={onComplete}
            className="mt-4 rounded bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            View Dashboard
          </button>
        </div>
      )}

      {/* Help links */}
      <div className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-400">
        <Link href="/docs" className="hover:text-gray-600">Documentation</Link>
        <Link href="/playground" className="hover:text-gray-600">Try the Playground</Link>
        <Link href="/admin/sdk" className="hover:text-gray-600">Full SDK Guide</Link>
      </div>
    </div>
  );
}

// ── Step Card ───────────────────────────────────────────────────────────────

function StepCard({
  number,
  title,
  completed,
  expanded,
  onToggle,
  children,
}: {
  number: number;
  title: string;
  completed: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border ${completed ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        {/* Step indicator */}
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          completed
            ? 'bg-green-600 text-white'
            : 'bg-gray-200 text-gray-600'
        }`}>
          {completed ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            number
          )}
        </span>
        <span className={`flex-1 text-sm font-semibold ${completed ? 'text-green-800' : 'text-gray-900'}`}>
          {title}
        </span>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {expanded && (
        <div className="border-t px-5 py-4 pl-[4.5rem]">
          {children}
        </div>
      )}
    </div>
  );
}
