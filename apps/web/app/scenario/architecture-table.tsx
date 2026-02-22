'use client';

import type { SimulationResult, RiskLevel } from '@aiecon/types';

interface ArchitectureTableProps {
  simulations: SimulationResult[];
}

function getRiskBadge(risk: RiskLevel) {
  const styles: Record<RiskLevel, string> = {
    Low: 'bg-green-100 text-green-800',
    Medium: 'bg-yellow-100 text-yellow-800',
    High: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${styles[risk]}`}>
      {risk}
    </span>
  );
}

export function ArchitectureTable({ simulations }: ArchitectureTableProps) {
  return (
    <div>
      <h3 className="text-lg font-medium">Step 3: Architecture Comparison</h3>
      <p className="mt-1 text-sm text-gray-500">Sorted by highest margin.</p>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-700">Architecture</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Cost/User</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Monthly Cost</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Margin</th>
              <th className="px-4 py-3 text-center font-medium text-gray-700">Risk</th>
            </tr>
          </thead>
          <tbody>
            {simulations.map((sim, i) => (
              <tr key={sim.architectureName} className={`border-b ${i === 0 ? 'bg-green-50' : ''}`}>
                <td className="px-4 py-3 font-medium">
                  {sim.architectureName}
                  {i === 0 && (
                    <span className="ml-2 text-xs text-green-600">(Best)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  ${sim.costPerUser.toFixed(4)}
                </td>
                <td className="px-4 py-3 text-right">
                  ${sim.monthlyCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right">
                  {sim.grossMargin.toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-center">
                  {getRiskBadge(sim.riskLevel)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
