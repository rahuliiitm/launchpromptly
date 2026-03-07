/**
 * Browser-compatible guardrail scanner for the interactive playground.
 * Ported from the LaunchPromptly Node SDK's detection engines.
 * Pure functions, zero dependencies, runs entirely in the browser.
 */

// ── PII Detection ───────────────────────────────────────────────────────────

export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'ip_address'
  | 'api_key'
  | 'date_of_birth'
  | 'us_address'
  | 'iban'
  | 'nhs_number'
  | 'uk_nino'
  | 'passport'
  | 'aadhaar'
  | 'eu_phone'
  | 'medicare'
  | 'drivers_license';

export interface PIIDetection {
  type: PIIType;
  value: string;
  start: number;
  end: number;
  confidence: number;
}

const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const PHONE_US_RE = /\b(?:\+1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const PHONE_INTL_RE = /(?<=^|[\s(])\+\d{1,3}[-.\s]?\d{4,14}(?:[-.\s]\d{1,6})*\b/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const CREDIT_CARD_RE = /\b\d(?:[\s\-]?\d){12,18}\b/g;
const IP_V4_RE = /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
const API_KEY_RE = /\b(?:sk-[a-zA-Z0-9]{20,}|sk-proj-[a-zA-Z0-9\-_]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9\-_]{20,}|xox[bsapr]-[a-zA-Z0-9\-]{10,})\b/g;
const DATE_OF_BIRTH_RE = /\b(?:0[1-9]|1[0-2])[\/\-](?:0[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b/g;
const US_ADDRESS_RE = /\b\d{1,6}\s+[A-Za-z][A-Za-z\s]{1,30}\s+(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Dr(?:ive)?|Ln|Lane|Rd|Road|Way|Ct|Court|Pl(?:ace)?|Cir(?:cle)?|Pkwy|Parkway)\b/gi;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g;
const NHS_NUMBER_RE = /(?<!\+)\b\d{3}\s?\d{3}\s?\d{4}\b/g;
const UK_NINO_RE = /\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g;
const PASSPORT_RE = /\b[A-Z]{1,2}\d{6,9}\b/g;
const AADHAAR_RE = /(?<!\+)\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const EU_PHONE_RE = /(?<=^|[\s(])\+(?:33|49|34|39|31|32|43|41|46|47|48|45|358|351|353|30|36)\s?\d[\d\s]{7,12}\b/g;
const MEDICARE_AU_RE = /(?<!\+)\b\d{4}\s?\d{5}\s?\d{1}\b/g;
const DRIVERS_LICENSE_US_RE = /\b[A-Z]\d{3}-\d{4}-\d{4}\b/g;

function luhnCheck(digits: string): boolean {
  const nums = digits.replace(/[\s\-]/g, '');
  if (!/^\d{13,19}$/.test(nums)) return false;
  let sum = 0;
  let alternate = false;
  for (let i = nums.length - 1; i >= 0; i--) {
    let n = parseInt(nums[i]!, 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function nhsNumberCheck(match: string): boolean {
  const digits = match.replace(/\s/g, '');
  return /^\d{10}$/.test(digits);
}

function aadhaarCheck(match: string): boolean {
  const digits = match.replace(/\s/g, '');
  if (!/^\d{12}$/.test(digits)) return false;
  if (digits[0] === '0' || digits[0] === '1') return false;
  return true;
}

const WELL_KNOWN_IPS = new Set([
  '0.0.0.0', '127.0.0.1', '255.255.255.255', '255.255.255.0',
  '192.168.0.1', '192.168.1.1', '10.0.0.1',
]);

interface PatternEntry {
  type: PIIType;
  regex: RegExp;
  confidence: number;
  validate?: (match: string) => boolean;
}

const PATTERNS: PatternEntry[] = [
  { type: 'email', regex: EMAIL_RE, confidence: 0.95 },
  { type: 'phone', regex: PHONE_US_RE, confidence: 0.85 },
  { type: 'phone', regex: PHONE_INTL_RE, confidence: 0.8 },
  { type: 'ssn', regex: SSN_RE, confidence: 0.95 },
  { type: 'credit_card', regex: CREDIT_CARD_RE, confidence: 0.9, validate: luhnCheck },
  { type: 'ip_address', regex: IP_V4_RE, confidence: 0.8, validate: (ip) => !WELL_KNOWN_IPS.has(ip) },
  { type: 'api_key', regex: API_KEY_RE, confidence: 0.95 },
  { type: 'date_of_birth', regex: DATE_OF_BIRTH_RE, confidence: 0.7 },
  { type: 'us_address', regex: US_ADDRESS_RE, confidence: 0.7 },
  { type: 'iban', regex: IBAN_RE, confidence: 0.9 },
  { type: 'nhs_number', regex: NHS_NUMBER_RE, confidence: 0.8, validate: nhsNumberCheck },
  { type: 'uk_nino', regex: UK_NINO_RE, confidence: 0.9 },
  { type: 'passport', regex: PASSPORT_RE, confidence: 0.7 },
  { type: 'aadhaar', regex: AADHAAR_RE, confidence: 0.85, validate: aadhaarCheck },
  { type: 'eu_phone', regex: EU_PHONE_RE, confidence: 0.8 },
  { type: 'medicare', regex: MEDICARE_AU_RE, confidence: 0.75 },
  { type: 'drivers_license', regex: DRIVERS_LICENSE_US_RE, confidence: 0.75 },
];

function deduplicateDetections(sorted: PIIDetection[]): PIIDetection[] {
  if (sorted.length === 0) return sorted;
  const result: PIIDetection[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1]!;
    const curr = sorted[i]!;
    if (curr.start < prev.end) {
      if (curr.confidence > prev.confidence) {
        result[result.length - 1] = curr;
      }
    } else {
      result.push(curr);
    }
  }
  return result;
}

export function scanPII(text: string): PIIDetection[] {
  if (!text) return [];
  const detections: PIIDetection[] = [];

  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(text)) !== null) {
      const value = match[0];
      if (pattern.validate && !pattern.validate(value)) continue;
      detections.push({
        type: pattern.type,
        value,
        start: match.index,
        end: match.index + value.length,
        confidence: pattern.confidence,
      });
    }
  }

  detections.sort((a, b) => a.start - b.start || b.confidence - a.confidence);
  return deduplicateDetections(detections);
}

// ── Injection Detection ─────────────────────────────────────────────────────

export interface InjectionResult {
  riskScore: number;
  triggered: string[];
  action: 'allow' | 'warn' | 'block';
}

interface InjectionRule {
  category: string;
  patterns: RegExp[];
  weight: number;
}

const INJECTION_RULES: InjectionRule[] = [
  {
    category: 'instruction_override',
    patterns: [
      /ignore\s+(all\s+)?previous\s+instructions/i,
      /disregard\s+(all\s+)?(above|previous|prior)/i,
      /forget\s+(everything|all|your)\s+(above|rules|instructions|previous)/i,
      /override\s+(your|all|the)\s+(rules|instructions|guidelines)/i,
      /do\s+not\s+follow\s+(your|the|any)\s+(rules|instructions|guidelines)/i,
      /new\s+instructions?\s*:/i,
      /system\s*:\s*you\s+are/i,
    ],
    weight: 0.4,
  },
  {
    category: 'role_manipulation',
    patterns: [
      /you\s+are\s+now\s+(?:a|an|the)\s+/i,
      /(?:act|behave)\s+as\s+(?:if\s+)?(?:you\s+(?:are|were)\s+)?/i,
      /pretend\s+(?:you\s+are|to\s+be)/i,
      /(?:new|switch|change)\s+(?:your\s+)?(?:persona|personality|character|role)/i,
      /from\s+now\s+on\s+you\s+(?:are|will)/i,
      /jailbreak/i,
      /DAN\s+mode/i,
    ],
    weight: 0.35,
  },
  {
    category: 'delimiter_injection',
    patterns: [
      /(?:^|\n)-{3,}\s*(?:system|assistant|user)\s*-{3,}/im,
      /(?:^|\n)#{2,}\s*(?:system|new\s+instructions?|override)/im,
      /<\/?(?:system|instruction|prompt|override|admin|root)>/i,
      /\[(?:SYSTEM|INST|ADMIN|ROOT)\]/i,
      /```(?:system|instruction|override)/i,
    ],
    weight: 0.3,
  },
  {
    category: 'data_exfiltration',
    patterns: [
      /(?:repeat|print|show|display|output|reveal|tell)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?(?:above|everything|your\s+(?:prompt|instructions|system\s+(?:message|prompt)))/i,
      /what\s+(?:are|were)\s+your\s+(?:original\s+)?(?:instructions|rules|system\s+(?:prompt|message))/i,
      /(?:copy|paste|dump)\s+(?:your\s+)?(?:system|initial)\s+(?:prompt|message|instructions)/i,
      /(?:beginning|start)\s+of\s+(?:your|the)\s+(?:conversation|prompt|context)/i,
    ],
    weight: 0.3,
  },
  {
    category: 'encoding_evasion',
    patterns: [
      /[A-Za-z0-9+/=]{64,}/,
      /(?:\\u[0-9a-fA-F]{4}\s*){4,}/,
      /(?:rot13|decode|base64)\s*:\s*.{10,}/i,
      /(?:0x[0-9a-fA-F]{2}\s*){8,}/i,
      /1gn0r3\s+pr3v10us/i,
    ],
    weight: 0.25,
  },
];

export function scanInjection(text: string): InjectionResult {
  if (!text) return { riskScore: 0, triggered: [], action: 'allow' };

  const triggered: string[] = [];
  let totalScore = 0;

  for (const rule of INJECTION_RULES) {
    let ruleTriggered = false;
    let matchCount = 0;

    for (const pattern of rule.patterns) {
      if (pattern.global) pattern.lastIndex = 0;
      if (pattern.test(text)) {
        ruleTriggered = true;
        matchCount++;
      }
    }

    if (ruleTriggered) {
      triggered.push(rule.category);
      const categoryScore = Math.min(rule.weight * (1 + (matchCount - 1) * 0.15), rule.weight * 1.5);
      totalScore += categoryScore;
    }
  }

  const riskScore = Math.round(Math.min(totalScore, 1.0) * 100) / 100;

  let action: 'allow' | 'warn' | 'block';
  if (riskScore >= 0.7) action = 'block';
  else if (riskScore >= 0.3) action = 'warn';
  else action = 'allow';

  return { riskScore, triggered, action };
}

// ── Content Filter ──────────────────────────────────────────────────────────

export type ContentCategory = 'hate_speech' | 'sexual' | 'violence' | 'self_harm' | 'illegal';

export interface ContentViolation {
  category: string;
  matched: string;
  severity: 'warn' | 'block';
}

interface CategoryRule {
  category: ContentCategory;
  patterns: RegExp[];
  severity: 'warn' | 'block';
}

const CONTENT_RULES: CategoryRule[] = [
  {
    category: 'hate_speech',
    patterns: [
      /\b(?:kill|exterminate|eliminate)\s+all\s+\w+/i,
      /\b(?:racial|ethnic)\s+(?:cleansing|supremacy|genocide)\b/i,
      /\bgenocide\b/i,
      /\bhate\s+(?:crime|group)\b/i,
    ],
    severity: 'block',
  },
  {
    category: 'violence',
    patterns: [
      /\b(?:how\s+to\s+)?(?:make|build|create)\s+(?:a\s+)?(?:bomb|explosive|weapon)\b/i,
      /\b(?:how\s+to\s+)?(?:poison|assassinate|murder)\s+(?:someone|a\s+person)\b/i,
      /\bmass\s+(?:shooting|murder|violence)\b/i,
    ],
    severity: 'block',
  },
  {
    category: 'self_harm',
    patterns: [
      /\b(?:how\s+to\s+)?(?:commit|method(?:s)?\s+(?:of|for))\s+suicide\b/i,
      /\bways\s+to\s+(?:end\s+(?:my|your)\s+life|kill\s+(?:myself|yourself))\b/i,
    ],
    severity: 'block',
  },
  {
    category: 'illegal',
    patterns: [
      /\b(?:how\s+to\s+)?(?:hack|breach|exploit)\s+(?:into\s+)?(?:a\s+)?(?:bank|government|corporate)\s+(?:system|network|database)\b/i,
      /\b(?:how\s+to\s+)?(?:launder|counterfeit)\s+money\b/i,
      /\b(?:how\s+to\s+)?(?:cook|manufacture|synthesize)\s+(?:meth|drugs|fentanyl)\b/i,
    ],
    severity: 'block',
  },
];

export function scanContent(text: string): ContentViolation[] {
  if (!text) return [];
  const violations: ContentViolation[] = [];

  for (const rule of CONTENT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.global) pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match) {
        violations.push({
          category: rule.category,
          matched: match[0],
          severity: rule.severity,
        });
        break;
      }
    }
  }

  return violations;
}

// ── Display helpers ─────────────────────────────────────────────────────────

const PII_TYPE_LABELS: Record<PIIType, string> = {
  email: 'Email',
  phone: 'Phone',
  ssn: 'SSN',
  credit_card: 'Credit Card',
  ip_address: 'IP Address',
  api_key: 'API Key',
  date_of_birth: 'Date of Birth',
  us_address: 'US Address',
  iban: 'IBAN',
  nhs_number: 'NHS Number',
  uk_nino: 'UK NINO',
  passport: 'Passport',
  aadhaar: 'Aadhaar',
  eu_phone: 'EU Phone',
  medicare: 'Medicare',
  drivers_license: "Driver's License",
};

export function piiTypeLabel(type: PIIType): string {
  return PII_TYPE_LABELS[type] || type;
}

const CATEGORY_LABELS: Record<string, string> = {
  instruction_override: 'Instruction Override',
  role_manipulation: 'Role Manipulation',
  delimiter_injection: 'Delimiter Injection',
  data_exfiltration: 'Data Exfiltration',
  encoding_evasion: 'Encoding Evasion',
  hate_speech: 'Hate Speech',
  sexual: 'Sexual Content',
  violence: 'Violence',
  self_harm: 'Self Harm',
  illegal: 'Illegal Activity',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}
