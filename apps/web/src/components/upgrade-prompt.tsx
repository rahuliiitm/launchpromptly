'use client';

import Link from 'next/link';

export interface UpgradePromptProps {
  percentUsed: number;
  plan: string;
  eventLimit: number;
}

export function UpgradePrompt({ percentUsed, plan, eventLimit }: UpgradePromptProps) {
  // Suppress during beta period
  if (new Date() < new Date('2025-04-30T23:59:59Z')) return null;

  // Only show for free tier when usage is high
  if (plan !== 'free' || percentUsed < 80) return null;

  const isOver = percentUsed >= 100;

  return (
    <div className={`rounded-lg border p-4 ${
      isOver ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className={`text-sm font-semibold ${isOver ? 'text-red-800' : 'text-yellow-800'}`}>
            {isOver
              ? 'Event limit reached'
              : `You\u2019ve used ${percentUsed}% of your free tier`}
          </h3>
          <p className={`mt-1 text-sm ${isOver ? 'text-red-700' : 'text-yellow-700'}`}>
            {isOver
              ? `Your free tier of ${eventLimit.toLocaleString()} events/month is full. New events will be rejected until next month.`
              : 'Upgrade to keep your guardrails running without interruption.'}
          </p>
        </div>
        <Link
          href="/admin/settings"
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white ${
            isOver ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'
          }`}
        >
          Upgrade Plan
        </Link>
      </div>
    </div>
  );
}
