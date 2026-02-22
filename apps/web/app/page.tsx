'use client';

import { useState } from 'react';
import { ScenarioForm } from './scenario/scenario-form';
import { FinancialOutput } from './scenario/financial-output';
import { ArchitectureTable } from './scenario/architecture-table';
import { SensitivityPanel } from './scenario/sensitivity-panel';
import { PricingTiers } from './scenario/pricing-tiers';
import { SnapshotManager } from './scenario/snapshot-manager';
import { AdvisoryPanel } from './scenario/advisory-panel';
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

type TabKey = 'summary' | 'architectures' | 'sensitivity' | 'pricing' | 'snapshots' | 'advisory';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'architectures', label: 'Architectures' },
  { key: 'sensitivity', label: 'Sensitivity' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'snapshots', label: 'Snapshots' },
  { key: 'advisory', label: 'AI Advisory' },
];

export default function Home() {
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [simulations, setSimulations] = useState<SimulationResult[]>([]);
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('summary');

  const handleScenarioCreated = (
    data: ScenarioResponse,
    sims: SimulationResult[],
    accessToken: string,
  ) => {
    setScenario(data);
    setSimulations(sims);
    setToken(accessToken);
    setActiveTab('summary');
  };

  const handleReset = () => {
    setScenario(null);
    setSimulations([]);
    setToken('');
    setActiveTab('summary');
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold">AI Feature Unit Economics Simulator</h2>
      <p className="mt-2 text-gray-600">
        Model and optimize the unit economics of your AI features before you scale.
      </p>

      <div className="mt-8">
        {!scenario ? (
          <ScenarioForm onSuccess={handleScenarioCreated} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6">
                  {TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
                        activeTab === tab.key
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
              <button
                onClick={handleReset}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                New Scenario
              </button>
            </div>

            <div className="mt-6">
              {activeTab === 'summary' && (
                <FinancialOutput
                  scenario={scenario}
                  financialResult={scenario.financialResult}
                />
              )}

              {activeTab === 'architectures' && (
                <ArchitectureTable simulations={simulations} />
              )}

              {activeTab === 'sensitivity' && (
                <SensitivityPanel scenarioId={scenario.id} token={token} />
              )}

              {activeTab === 'pricing' && (
                <PricingTiers scenarioId={scenario.id} token={token} />
              )}

              {activeTab === 'snapshots' && (
                <SnapshotManager scenarioId={scenario.id} token={token} />
              )}

              {activeTab === 'advisory' && (
                <AdvisoryPanel scenarioId={scenario.id} token={token} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
