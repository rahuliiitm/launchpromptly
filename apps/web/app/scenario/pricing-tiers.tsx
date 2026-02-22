'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { PricingRecommendationResult, RiskLevel } from '@aiecon/types';

interface PricingTiersProps {
  scenarioId: string;
  token: string;
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

export function PricingTiers({ scenarioId, token }: PricingTiersProps) {
  const [data, setData] = useState<PricingRecommendationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<PricingRecommendationResult>(
      `/scenario/${scenarioId}/pricing-recommendation`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [scenarioId, token]);

  if (loading) {
    return <p className="text-sm text-gray-500">Loading pricing recommendations...</p>;
  }

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <h3 className="text-lg font-medium">Pricing Recommendation</h3>
      <p className="mt-1 text-sm text-gray-500">
        Based on your AI cost of <strong>${data.costPerUser.toFixed(4)}</strong> per user/month.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {data.tiers.map((tier) => (
          <div
            key={tier.targetMargin}
            className="rounded-lg border border-gray-200 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">
                {tier.targetMargin}% Margin
              </span>
              {getRiskBadge(tier.riskLevel)}
            </div>
            <p className="mt-3 text-3xl font-bold">
              ${tier.recommendedPrice.toFixed(2)}
              <span className="text-base font-normal text-gray-500">/mo</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">
              AI Cost: ${tier.costPerUser.toFixed(4)}/user
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
