'use client';

import type { FinancialResult, RiskLevel } from '@aiecon/types';

interface FinancialOutputProps {
  scenario: {
    name: string;
    model: string;
    projectedUsers: number;
    subscriptionPrice: number;
  };
  financialResult: FinancialResult;
}

function getRiskBadge(risk: RiskLevel) {
  const styles: Record<RiskLevel, string> = {
    Low: 'bg-green-100 text-green-800',
    Medium: 'bg-yellow-100 text-yellow-800',
    High: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${styles[risk]}`}>
      {risk} Risk
    </span>
  );
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function FinancialOutput({ scenario, financialResult }: FinancialOutputProps) {
  return (
    <div>
      <h3 className="text-lg font-medium">Step 2: Financial Output</h3>
      <p className="mt-1 text-sm text-gray-500">
        {scenario.name} &mdash; {scenario.model} &mdash; {scenario.projectedUsers.toLocaleString()} users @ {formatCurrency(scenario.subscriptionPrice)}/mo
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MetricCard label="Cost per Request" value={formatCurrency(financialResult.costPerRequest)} />
        <MetricCard label="Cost per User" value={formatCurrency(financialResult.costPerUser)} />
        <MetricCard label="Monthly AI Cost" value={formatCurrency(financialResult.monthlyCost)} />
        <MetricCard label="Gross Margin" value={formatPercent(financialResult.grossMargin)} />
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Risk Level</p>
          <div className="mt-1">{getRiskBadge(financialResult.riskLevel)}</div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
