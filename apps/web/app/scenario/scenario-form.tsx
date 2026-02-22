'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { FinancialResult, SimulationResult } from '@aiecon/types';

interface ScenarioResponse {
  id: string;
  name: string;
  model: string;
  avgInputTokens: number;
  avgOutputTokens: number;
  requestsPerUser: number;
  projectedUsers: number;
  subscriptionPrice: number;
  financialResult: FinancialResult;
}

interface ScenarioFormProps {
  onSuccess: (scenario: ScenarioResponse, simulations: SimulationResult[]) => void;
}

const SUPPORTED_MODELS = ['gpt-4', 'gpt-4-mini'];

export function ScenarioForm({ onSuccess }: ScenarioFormProps) {
  const [name, setName] = useState('');
  const [model, setModel] = useState(SUPPORTED_MODELS[0]!);
  const [avgInputTokens, setAvgInputTokens] = useState('');
  const [avgOutputTokens, setAvgOutputTokens] = useState('');
  const [requestsPerUser, setRequestsPerUser] = useState('');
  const [projectedUsers, setProjectedUsers] = useState('');
  const [subscriptionPrice, setSubscriptionPrice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Register/login to get token (simplified for v1)
      const auth = await apiFetch<{ accessToken: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: 'demo@aiecon.app' }),
      });

      const scenario = await apiFetch<ScenarioResponse>('/scenario', {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({
          name,
          model,
          avgInputTokens: parseInt(avgInputTokens, 10),
          avgOutputTokens: parseInt(avgOutputTokens, 10),
          requestsPerUser: parseInt(requestsPerUser, 10),
          projectedUsers: parseInt(projectedUsers, 10),
          subscriptionPrice: parseFloat(subscriptionPrice),
        }),
      });

      const simulations = await apiFetch<SimulationResult[]>(
        `/scenario/${scenario.id}/simulations`,
      );

      onSuccess(scenario, simulations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-medium">Step 1: Define Your AI Feature</h3>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Scenario Name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="e.g. AI Chat Assistant"
        />
      </div>

      <div>
        <label htmlFor="model" className="block text-sm font-medium text-gray-700">
          AI Model
        </label>
        <select
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          {SUPPORTED_MODELS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="avgInputTokens" className="block text-sm font-medium text-gray-700">
            Avg Input Tokens
          </label>
          <input
            id="avgInputTokens"
            type="number"
            required
            min="0"
            value={avgInputTokens}
            onChange={(e) => setAvgInputTokens(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="e.g. 1000"
          />
        </div>
        <div>
          <label htmlFor="avgOutputTokens" className="block text-sm font-medium text-gray-700">
            Avg Output Tokens
          </label>
          <input
            id="avgOutputTokens"
            type="number"
            required
            min="0"
            value={avgOutputTokens}
            onChange={(e) => setAvgOutputTokens(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="e.g. 500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="requestsPerUser" className="block text-sm font-medium text-gray-700">
          Requests per User per Month
        </label>
        <input
          id="requestsPerUser"
          type="number"
          required
          min="1"
          value={requestsPerUser}
          onChange={(e) => setRequestsPerUser(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="e.g. 100"
        />
      </div>

      <div>
        <label htmlFor="projectedUsers" className="block text-sm font-medium text-gray-700">
          Projected Active Users
        </label>
        <input
          id="projectedUsers"
          type="number"
          required
          min="1"
          value={projectedUsers}
          onChange={(e) => setProjectedUsers(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="e.g. 1000"
        />
      </div>

      <div>
        <label htmlFor="subscriptionPrice" className="block text-sm font-medium text-gray-700">
          SaaS Subscription Price ($/month)
        </label>
        <input
          id="subscriptionPrice"
          type="number"
          required
          min="0"
          step="0.01"
          value={subscriptionPrice}
          onChange={(e) => setSubscriptionPrice(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="e.g. 29.00"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Calculating...' : 'Calculate Economics'}
      </button>
    </form>
  );
}
