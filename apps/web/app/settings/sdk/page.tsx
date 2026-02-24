'use client';

import { useState } from 'react';

const INSTALL_CMD = 'npm install @planforge/node';

const USAGE_CODE = `import { PlanForge } from '@planforge/node';
import OpenAI from 'openai';

const pf = new PlanForge({
  apiKey: 'YOUR_API_KEY_HERE',
  endpoint: 'http://localhost:3001', // your PlanForge API
});

const openai = pf.wrap(new OpenAI(), {
  customer: () => ({ id: getCurrentUser().id }),
  feature: 'chat',
});

// Use openai as normal — everything is tracked transparently
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});

// On server shutdown
await pf.flush();`;

export default function SDKSetupPage() {
  const [copied, setCopied] = useState('');

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">SDK Setup</h1>
      <p className="mt-1 text-sm text-gray-500">
        Get started tracking your AI costs in under 5 minutes.
      </p>

      {/* Step 1 */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">1. Generate an API Key</h2>
        <p className="mt-1 text-sm text-gray-500">
          Go to{' '}
          <a href="/settings" className="text-blue-600 underline">
            API Keys
          </a>{' '}
          and generate a new API key.
        </p>
      </div>

      {/* Step 2 */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">2. Install the SDK</h2>
        <div className="relative mt-2">
          <pre className="rounded-lg bg-gray-900 p-4 text-sm text-green-400">
            {INSTALL_CMD}
          </pre>
          <button
            onClick={() => copyToClipboard(INSTALL_CMD, 'install')}
            className="absolute right-2 top-2 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
          >
            {copied === 'install' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Step 3 */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">3. Wrap your OpenAI client</h2>
        <div className="relative mt-2">
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">
            {USAGE_CODE}
          </pre>
          <button
            onClick={() => copyToClipboard(USAGE_CODE, 'code')}
            className="absolute right-2 top-2 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600"
          >
            {copied === 'code' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Step 4 */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">4. Check Analytics</h2>
        <p className="mt-1 text-sm text-gray-500">
          Once events are flowing, go to the{' '}
          <a href="/analytics" className="text-blue-600 underline">
            Analytics Overview
          </a>{' '}
          page to see your costs in real time.
        </p>
      </div>
    </div>
  );
}
