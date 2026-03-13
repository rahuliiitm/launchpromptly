'use client';

import { piiTypeLabel, categoryLabel } from '@/lib/security-labels';

// ── ResultCard ──────────────────────────────────────────────────────────────

export function ResultCard({
  title,
  count,
  color,
  icon,
  children,
}: {
  title: string;
  count: number;
  color: 'blue' | 'orange' | 'red' | 'purple' | 'teal' | 'pink';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const colorMap = {
    blue: { badge: 'bg-blue-100 text-blue-700', icon: 'text-blue-600' },
    orange: { badge: 'bg-orange-100 text-orange-700', icon: 'text-orange-600' },
    red: { badge: 'bg-red-100 text-red-700', icon: 'text-red-600' },
    purple: { badge: 'bg-purple-100 text-purple-700', icon: 'text-purple-600' },
    teal: { badge: 'bg-teal-100 text-teal-700', icon: 'text-teal-600' },
    pink: { badge: 'bg-pink-100 text-pink-700', icon: 'text-pink-600' },
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={colorMap[color].icon}>{icon}</span>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          count > 0 ? colorMap[color].badge : 'bg-green-100 text-green-700'
        }`}>
          {count > 0 ? `${count} found` : 'Clear'}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── ActionBadge ─────────────────────────────────────────────────────────────

export function ActionBadge({ action }: { action: 'allow' | 'warn' | 'block' }) {
  const styles = {
    allow: 'bg-green-100 text-green-700',
    warn: 'bg-yellow-100 text-yellow-700',
    block: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${styles[action]}`}>
      {action}
    </span>
  );
}

// ── HighlightedText ─────────────────────────────────────────────────────────

export function HighlightedText({ text, detections }: {
  text: string;
  detections: Array<{ type: string; start: number; end: number; confidence: number }>;
}) {
  if (detections.length === 0) return <span className="text-sm text-gray-700">{text}</span>;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const d of detections) {
    if (d.start > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`} className="text-gray-700">{text.slice(lastIndex, d.start)}</span>);
    }
    parts.push(
      <span
        key={`pii-${d.start}`}
        className="rounded bg-red-200 px-0.5 text-red-900"
        title={`${piiTypeLabel(d.type as any)} (${Math.round(d.confidence * 100)}%)`}
      >
        {text.slice(d.start, d.end)}
      </span>,
    );
    lastIndex = d.end;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`} className="text-gray-700">{text.slice(lastIndex)}</span>);
  }

  return <p className="text-sm leading-relaxed">{parts}</p>;
}

// ── SecuritySummaryBanner ───────────────────────────────────────────────────

export function SecuritySummaryBanner({ count }: { count: number }) {
  return (
    <div className={`rounded-lg border p-4 ${
      count === 0
        ? 'border-green-200 bg-green-50'
        : 'border-red-200 bg-red-50'
    }`}>
      <div className="flex items-center gap-2">
        {count === 0 ? (
          <>
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-green-800">All clear - no issues detected</span>
          </>
        ) : (
          <>
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-sm font-medium text-red-800">
              {count} {count === 1 ? 'issue' : 'issues'} detected
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── InjectionGauge ──────────────────────────────────────────────────────────

export function InjectionGauge({ score, action, triggered }: {
  score: number;
  action: 'allow' | 'warn' | 'block';
  triggered: string[];
}) {
  return (
    <>
      {/* Risk score gauge */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">Risk Score</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{score.toFixed(2)}</span>
            <ActionBadge action={action} />
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-gray-200">
          <div
            className={`h-3 rounded-full transition-all ${
              score >= 0.7
                ? 'bg-red-500'
                : score >= 0.3
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.max(score * 100, 2)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>Safe</span>
          <span>Dangerous</span>
        </div>
      </div>

      {triggered.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-gray-500">Triggered Categories</p>
          <div className="flex flex-wrap gap-2">
            {triggered.map((cat) => (
              <span
                key={cat}
                className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700"
              >
                {categoryLabel(cat)}
              </span>
            ))}
          </div>
        </div>
      )}

      {triggered.length === 0 && (
        <p className="text-sm text-gray-500">No injection patterns detected.</p>
      )}
    </>
  );
}

// ── PIIDetailTable ──────────────────────────────────────────────────────────

export function PIIDetailTable({ detections, text }: {
  detections: Array<{ type: string; start: number; end: number; confidence: number }>;
  text?: string | null;
}) {
  if (detections.length === 0) {
    return <p className="text-sm text-gray-500">No PII detected.</p>;
  }

  return (
    <>
      {/* Highlighted text preview (if text provided) */}
      {text && (
        <div className="mb-3 rounded border bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Highlighted preview</p>
          <HighlightedText text={text} detections={detections} />
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-gray-500">
            <th className="pb-2 font-medium">Type</th>
            <th className="pb-2 font-medium">Position</th>
            <th className="pb-2 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {detections.map((d, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2">
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {piiTypeLabel(d.type as any)}
                </span>
              </td>
              <td className="py-2 font-mono text-xs text-gray-700">{d.start}-{d.end}</td>
              <td className="py-2 text-xs text-gray-500">{Math.round(d.confidence * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ── JailbreakGauge ──────────────────────────────────────────────────────────

export function JailbreakGauge({ score, action, triggered }: {
  score: number;
  action: 'allow' | 'warn' | 'block';
  triggered: string[];
}) {
  return (
    <>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">Jailbreak Score</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{score.toFixed(2)}</span>
            <ActionBadge action={action} />
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-gray-200">
          <div
            className={`h-3 rounded-full transition-all ${
              score >= 0.7
                ? 'bg-red-500'
                : score >= 0.3
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.max(score * 100, 2)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>Safe</span>
          <span>Jailbreak</span>
        </div>
      </div>

      {triggered.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-gray-500">Triggered Categories</p>
          <div className="flex flex-wrap gap-2">
            {triggered.map((cat) => (
              <span
                key={cat}
                className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700"
              >
                {categoryLabel(cat)}
              </span>
            ))}
          </div>
        </div>
      )}

      {triggered.length === 0 && (
        <p className="text-sm text-gray-500">No jailbreak patterns detected.</p>
      )}
    </>
  );
}

// ── UnicodeThreatsTable ────────────────────────────────────────────────────

export function UnicodeThreatsTable({ threats }: {
  threats: Array<{ category: string; description?: string; severity: string }>;
}) {
  if (threats.length === 0) {
    return <p className="text-sm text-gray-500">No suspicious Unicode characters detected.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-gray-500">
          <th className="pb-2 font-medium">Category</th>
          <th className="pb-2 font-medium">Description</th>
          <th className="pb-2 font-medium">Severity</th>
        </tr>
      </thead>
      <tbody>
        {threats.map((f, i) => (
          <tr key={i} className="border-b last:border-0">
            <td className="py-2">
              <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
                {categoryLabel(f.category)}
              </span>
            </td>
            <td className="py-2 text-xs text-gray-700">{f.description ?? f.category}</td>
            <td className="py-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                f.severity === 'block'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {f.severity}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── SecretDetectionTable ───────────────────────────────────────────────────

export function SecretDetectionTable({ secrets }: {
  secrets: Array<{ type: string; value?: string }>;
}) {
  if (secrets.length === 0) {
    return <p className="text-sm text-gray-500">No secrets or credentials detected.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-gray-500">
          <th className="pb-2 font-medium">Type</th>
          {secrets.some((s) => s.value) && <th className="pb-2 font-medium">Value</th>}
        </tr>
      </thead>
      <tbody>
        {secrets.map((s, i) => (
          <tr key={i} className="border-b last:border-0">
            <td className="py-2">
              <span className="rounded bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700">
                {s.type}
              </span>
            </td>
            {secrets.some((sec) => sec.value) && (
              <td className="py-2 font-mono text-xs text-gray-700">{s.value ?? '--'}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── ContentViolationTable ───────────────────────────────────────────────────

export function ContentViolationTable({ violations }: {
  violations: Array<{ category: string; matched: string; severity: string }>;
}) {
  if (violations.length === 0) {
    return <p className="text-sm text-gray-500">No content violations detected.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-gray-500">
          <th className="pb-2 font-medium">Category</th>
          <th className="pb-2 font-medium">Matched</th>
          <th className="pb-2 font-medium">Severity</th>
        </tr>
      </thead>
      <tbody>
        {violations.map((v, i) => (
          <tr key={i} className="border-b last:border-0">
            <td className="py-2">
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {categoryLabel(v.category)}
              </span>
            </td>
            <td className="py-2 font-mono text-xs text-gray-700">{v.matched}</td>
            <td className="py-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                v.severity === 'block'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {v.severity}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
