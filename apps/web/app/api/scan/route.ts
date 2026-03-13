import { NextResponse } from 'next/server';
import {
  detectPII,
  detectInjection,
  detectContentViolations,
  detectJailbreak,
  mergeInjectionAnalyses,
  mergeJailbreakAnalyses,
  scanUnicode,
  detectSecrets,
} from 'launchpromptly';
import type {
  PIIDetection,
  InjectionAnalysis,
  ContentViolation,
  JailbreakAnalysis,
  SecretDetection,
  InjectionDetectorProvider,
  JailbreakDetectorProvider,
  ContentFilterProvider,
} from 'launchpromptly';

// ── ML model singletons (loaded once, reused across requests) ─────────────

let mlInjection: InjectionDetectorProvider | null = null;
let mlJailbreak: JailbreakDetectorProvider | null = null;
let mlToxicity: ContentFilterProvider | null = null;
let mlLoadPromise: Promise<void> | null = null;

async function ensureMLModels(): Promise<void> {
  if (mlInjection && mlJailbreak && mlToxicity) return;
  if (mlLoadPromise) return mlLoadPromise;

  mlLoadPromise = (async () => {
    try {
      const { MLInjectionDetector, MLJailbreakDetector, MLToxicityDetector } =
        await import('launchpromptly/ml');

      const [inj, jb, tox] = await Promise.all([
        MLInjectionDetector.create({ quantized: true }),
        MLJailbreakDetector.create({ quantized: true }),
        MLToxicityDetector.create(),
      ]);

      mlInjection = inj;
      mlJailbreak = jb;
      mlToxicity = tox;
      console.log('[scan] ML models loaded');
    } catch (err) {
      console.warn('[scan] ML models unavailable, using regex only:', (err as Error).message);
      mlLoadPromise = null;
    }
  })();

  return mlLoadPromise;
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface ScanRequest {
  text: string;
  scanners?: string[];
}

export interface ScanResponse {
  pii: PIIDetection[] | null;
  injection: { riskScore: number; triggered: string[]; action: string } | null;
  content: Array<{ category: string; matched: string; severity: string }> | null;
  jailbreak: { score: number; triggered: string[]; action: string } | null;
  unicode: Array<{ category: string; description: string; positions: number[]; severity: string }> | null;
  secrets: Array<{ type: string; value: string; start: number; end: number }> | null;
}

const SEVERITY_MAP: Record<string, 'warn' | 'block'> = {
  zero_width: 'warn',
  bidi_override: 'block',
  tag_char: 'block',
  homoglyph: 'block',
  variation_selector: 'warn',
  invisible_chars: 'warn',
};

// ── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json() as ScanRequest;
    const { text, scanners } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    if (text.length > 50_000) {
      return NextResponse.json({ error: 'text exceeds 50,000 character limit' }, { status: 400 });
    }

    // Load ML models (non-blocking — regex still runs if models aren't ready yet)
    await ensureMLModels();

    const enabled = new Set(scanners ?? ['pii', 'injection', 'content', 'jailbreak', 'unicode', 'secrets']);

    const result: ScanResponse = {
      pii: null,
      injection: null,
      content: null,
      jailbreak: null,
      unicode: null,
      secrets: null,
    };

    if (enabled.has('pii')) {
      result.pii = detectPII(text);
    }

    if (enabled.has('injection')) {
      // Regex detection
      const ruleAnalysis: InjectionAnalysis = detectInjection(text);
      // ML detection (if available)
      const analyses: InjectionAnalysis[] = [ruleAnalysis];
      if (mlInjection) {
        const mlAnalysis = await mlInjection.detect(text);
        analyses.push(mlAnalysis);
      }
      // Merge: take the max risk score across detectors
      const merged = mergeInjectionAnalyses(analyses);
      result.injection = {
        riskScore: merged.riskScore,
        triggered: merged.triggered,
        action: merged.action,
      };
    }

    if (enabled.has('content')) {
      // Regex detection
      const ruleViolations: ContentViolation[] = detectContentViolations(text, 'input');
      // ML toxicity detection (if available)
      let mlViolations: ContentViolation[] = [];
      if (mlToxicity) {
        mlViolations = await mlToxicity.detect(text, 'input') as ContentViolation[];
      }
      // Merge: combine and deduplicate by category
      const seen = new Set<string>();
      const all: Array<{ category: string; matched: string; severity: string }> = [];
      for (const v of [...ruleViolations, ...mlViolations]) {
        if (seen.has(v.category)) continue;
        seen.add(v.category);
        all.push({ category: v.category, matched: v.matched, severity: v.severity });
      }
      result.content = all;
    }

    if (enabled.has('jailbreak')) {
      // Regex detection
      const ruleAnalysis: JailbreakAnalysis = detectJailbreak(text);
      // ML detection (if available)
      const analyses: JailbreakAnalysis[] = [ruleAnalysis];
      if (mlJailbreak) {
        const mlAnalysis = await mlJailbreak.detect(text);
        analyses.push(mlAnalysis);
      }
      // Merge: take the max risk score across detectors
      const merged = mergeJailbreakAnalyses(analyses);
      result.jailbreak = {
        score: merged.riskScore,
        triggered: merged.triggered,
        action: merged.action,
      };
    }

    if (enabled.has('unicode')) {
      const scan = scanUnicode(text);
      const byType = new Map<string, number[]>();
      for (const threat of scan.threats) {
        const positions = byType.get(threat.type) ?? [];
        positions.push(threat.position);
        byType.set(threat.type, positions);
      }
      result.unicode = Array.from(byType.entries()).map(([type, positions]) => ({
        category: type,
        description: `Found ${positions.length} ${type.replace(/_/g, ' ')} character(s)`,
        positions,
        severity: SEVERITY_MAP[type] ?? 'warn',
      }));
    }

    if (enabled.has('secrets')) {
      const detections: SecretDetection[] = detectSecrets(text);
      result.secrets = detections.map((d) => ({
        type: d.type,
        value: d.value.length > 40
          ? d.value.slice(0, 20) + '...' + d.value.slice(-10)
          : d.value,
        start: d.start,
        end: d.end,
      }));
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Scan error:', err);
    return NextResponse.json({ error: 'Internal scan error' }, { status: 500 });
  }
}
