'use client';

import { useState } from 'react';
import { ScenarioForm } from './scenario/scenario-form';
import { FinancialOutput } from './scenario/financial-output';
import { ArchitectureTable } from './scenario/architecture-table';
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

export default function Home() {
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [simulations, setSimulations] = useState<SimulationResult[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const handleScenarioCreated = (data: ScenarioResponse, sims: SimulationResult[]) => {
    setScenario(data);
    setSimulations(sims);
    setStep(2);
  };

  const handleReset = () => {
    setScenario(null);
    setSimulations([]);
    setStep(1);
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold">AI Feature Unit Economics Simulator</h2>
      <p className="mt-2 text-gray-600">
        Model and optimize the unit economics of your AI features before you scale.
      </p>

      <div className="mt-8">
        {step === 1 && (
          <ScenarioForm onSuccess={handleScenarioCreated} />
        )}

        {step >= 2 && scenario && (
          <>
            <FinancialOutput
              scenario={scenario}
              financialResult={scenario.financialResult}
            />
            <div className="mt-6 flex gap-3">
              {step === 2 && (
                <button
                  onClick={() => setStep(3)}
                  className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  Compare Architectures
                </button>
              )}
              <button
                onClick={handleReset}
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                New Scenario
              </button>
            </div>
          </>
        )}

        {step === 3 && simulations.length > 0 && (
          <div className="mt-8">
            <ArchitectureTable simulations={simulations} />
          </div>
        )}
      </div>
    </div>
  );
}
