'use client';

interface TextDiffProps {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
}

export function TextDiff({ oldText, newText, oldLabel, newLabel }: TextDiffProps) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const diff = computeDiff(oldLines, newLines);

  return (
    <div className="rounded border bg-white text-sm font-mono">
      {oldLabel && newLabel && (
        <div className="flex gap-4 border-b px-3 py-1.5 text-xs text-gray-500">
          <span className="text-red-600">{oldLabel}</span>
          <span>&rarr;</span>
          <span className="text-green-600">{newLabel}</span>
        </div>
      )}
      <div className="max-h-64 overflow-auto p-2">
        {diff.map((line, i) => (
          <div
            key={i}
            className={`px-2 py-0.5 ${
              line.type === 'add'
                ? 'bg-green-50 text-green-800'
                : line.type === 'remove'
                  ? 'bg-red-50 text-red-800'
                  : 'text-gray-600'
            }`}
          >
            <span className="mr-2 inline-block w-4 text-right text-gray-400 select-none">
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </span>
            {line.text || '\u00A0'}
          </div>
        ))}
        {diff.length === 0 && (
          <div className="px-2 py-2 text-gray-400">No differences</div>
        )}
      </div>
    </div>
  );
}

interface DiffLine {
  type: 'add' | 'remove' | 'same';
  text: string;
}

function computeDiff(a: string[], b: string[]): DiffLine[] {
  const m = a.length;
  const n = b.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    const row = dp[i]!;
    const prevRow = dp[i - 1]!;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        row[j] = prevRow[j - 1]! + 1;
      } else {
        row[j] = Math.max(prevRow[j]!, row[j - 1]!);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.push({ type: 'same', text: a[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      result.push({ type: 'add', text: b[j - 1]! });
      j--;
    } else {
      result.push({ type: 'remove', text: a[i - 1]! });
      i--;
    }
  }
  return result.reverse();
}
