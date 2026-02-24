'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';

interface ChecklistState {
  providerKey: boolean;
  prompt: boolean;
  apiKey: boolean;
}

interface DashboardStats {
  activePrompts: number;
  totalApiKeys: number;
}

export default function HomePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [checklist, setChecklist] = useState<ChecklistState>({
    providerKey: false,
    prompt: false,
    apiKey: false,
  });
  const [stats, setStats] = useState<DashboardStats>({ activePrompts: 0, totalApiKeys: 0 });
  const [loadingChecklist, setLoadingChecklist] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !user?.projectId) return;

    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      apiFetch<{ id: string }[]>('/provider-keys', { headers }),
      apiFetch<{ id: string; slug: string }[]>(`/prompt/${projectId}`, { headers }),
      apiFetch<{ id: string }[]>(`/project/${projectId}/api-keys`, { headers }),
    ]).then(([providerRes, promptRes, apiKeyRes]) => {
      const hasProviderKey = providerRes.status === 'fulfilled' && providerRes.value.length > 0;
      const prompts = promptRes.status === 'fulfilled' ? promptRes.value : [];
      const apiKeys = apiKeyRes.status === 'fulfilled' ? apiKeyRes.value : [];

      setChecklist({
        providerKey: hasProviderKey,
        prompt: prompts.length > 0,
        apiKey: apiKeys.length > 0,
      });
      setStats({
        activePrompts: prompts.length,
        totalApiKeys: apiKeys.length,
      });
      setLoadingChecklist(false);
    });
  }, [isAuthenticated, user?.projectId]);

  if (isLoading || !isAuthenticated) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  const allComplete = checklist.providerKey && checklist.prompt && checklist.apiKey;

  const steps = [
    {
      key: 'providerKey',
      title: 'Add an LLM provider key',
      description: 'Connect your OpenAI or Anthropic API key so you can test prompts.',
      href: '/settings/providers',
      linkText: 'Go to LLM Providers',
      done: checklist.providerKey,
    },
    {
      key: 'prompt',
      title: 'Test a prompt in the Playground',
      description: 'Write a system prompt, test it against models, and publish as a managed prompt.',
      href: '/prompts',
      linkText: 'Open Playground',
      done: checklist.prompt,
    },
    {
      key: 'apiKey',
      title: 'Generate an SDK API key',
      description: 'Create an API key to integrate PlanForge into your application.',
      href: '/settings',
      linkText: 'Go to Settings',
      done: checklist.apiKey,
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">
        Welcome{user?.email ? `, ${user.email.split('@')[0]}` : ''}
      </h1>

      {loadingChecklist ? (
        <div className="mt-8 text-gray-400">Loading setup status...</div>
      ) : allComplete ? (
        /* ── Mini Dashboard ── */
        <div className="mt-8">
          <p className="text-gray-600">Your setup is complete. Here&apos;s a quick overview.</p>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <Link
              href="/prompts/managed"
              className="rounded-lg border bg-white p-5 transition hover:border-blue-300"
            >
              <div className="text-2xl font-bold">{stats.activePrompts}</div>
              <div className="mt-1 text-sm text-gray-500">Managed Prompts</div>
            </Link>
            <Link
              href="/analytics"
              className="rounded-lg border bg-white p-5 transition hover:border-blue-300"
            >
              <div className="text-2xl font-bold text-gray-400">—</div>
              <div className="mt-1 text-sm text-gray-500">View Analytics</div>
            </Link>
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              href="/prompts"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Open Playground
            </Link>
            <Link
              href="/prompts/managed"
              className="rounded border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Manage Prompts
            </Link>
          </div>
        </div>
      ) : (
        /* ── Setup Checklist ── */
        <div className="mt-8">
          <p className="text-gray-600">
            Complete these steps to start managing your AI prompts.
          </p>

          <div className="mt-6 space-y-3">
            {steps.map((step, i) => (
              <div
                key={step.key}
                className={`rounded-lg border p-4 ${
                  step.done ? 'border-green-200 bg-green-50' : 'bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      step.done
                        ? 'bg-green-600 text-white'
                        : 'border-2 border-gray-300 text-gray-400'
                    }`}
                  >
                    {step.done ? (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`font-medium ${step.done ? 'text-green-800' : 'text-gray-900'}`}>
                      {step.title}
                    </div>
                    <div className={`mt-0.5 text-sm ${step.done ? 'text-green-600' : 'text-gray-500'}`}>
                      {step.description}
                    </div>
                    {!step.done && (
                      <Link
                        href={step.href}
                        className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {step.linkText} &rarr;
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
