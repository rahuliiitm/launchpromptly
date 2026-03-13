/**
 * Display label maps for guardrail categories and PII types.
 * Shared between the playground page and security-viz components.
 */

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
  known_template: 'Known Template',
  persona_assignment: 'Persona Assignment',
  hypothetical_framing: 'Hypothetical Framing',
  constraint_removal: 'Constraint Removal',
  zero_width: 'Zero-Width Characters',
  bidi_override: 'Bidi Override',
  invisible_chars: 'Invisible Characters',
  homoglyph: 'Homoglyph Attack',
  tag_char: 'Tag Characters',
  variation_selector: 'Variation Selectors',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}
