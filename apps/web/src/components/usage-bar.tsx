'use client';

export interface UsageBarProps {
  eventCount: number;
  eventLimit: number;
  plan: string;
}

export function UsageBar({ eventCount, eventLimit, plan }: UsageBarProps) {
  const percent = eventLimit > 0 ? Math.min((eventCount / eventLimit) * 100, 100) : 0;
  const isUnlimited = eventLimit === -1;

  let barColor = 'bg-green-500';
  if (percent >= 90) barColor = 'bg-red-500';
  else if (percent >= 70) barColor = 'bg-yellow-500';

  const planLabel = plan === 'free' ? 'Free' : plan === 'pro' ? 'Indie' : plan === 'business' ? 'Startup' : plan;

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          Events this month
          <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {planLabel}
          </span>
        </span>
        <span className="font-medium text-gray-900">
          {isUnlimited
            ? `${eventCount.toLocaleString()} events`
            : `${eventCount.toLocaleString()} / ${eventLimit.toLocaleString()}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
          <div
            className={`h-2 rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.max(percent, 1)}%` }}
          />
        </div>
      )}
    </div>
  );
}
