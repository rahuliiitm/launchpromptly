// ── User ──
export interface User {
  id: string;
  email: string;
  createdAt: Date;
}

// ── Scenario ──
export interface Scenario {
  id: string;
  userId: string;
  name: string;
  model: string;
  avgInputTokens: number;
  avgOutputTokens: number;
  requestsPerUser: number;
  projectedUsers: number;
  subscriptionPrice: number;
  createdAt: Date;
}

export interface CreateScenarioInput {
  name: string;
  model: string;
  avgInputTokens: number;
  avgOutputTokens: number;
  requestsPerUser: number;
  projectedUsers: number;
  subscriptionPrice: number;
}

// ── Financial Calculations ──
export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface ModelPricing {
  input: number;
  output: number;
}

export interface FinancialResult {
  costPerRequest: number;
  costPerUser: number;
  monthlyCost: number;
  grossMargin: number;
  riskLevel: RiskLevel;
}

// ── Architecture Simulation ──
export interface SimulationResult {
  architectureName: string;
  costPerUser: number;
  monthlyCost: number;
  grossMargin: number;
  riskLevel: RiskLevel;
}

export interface SimulationInput {
  avgInputTokens: number;
  avgOutputTokens: number;
  requestsPerUser: number;
  projectedUsers: number;
  subscriptionPrice: number;
}

// ── Scenario with computed results ──
export interface ScenarioWithResults extends Scenario {
  financialResult: FinancialResult;
}

// ── Sensitivity Analysis ──
export type SensitivityParameter =
  | 'projectedUsers'
  | 'subscriptionPrice'
  | 'requestsPerUser'
  | 'avgInputTokens'
  | 'avgOutputTokens';

export interface SensitivityInput {
  baseScenario: SimulationInput;
  model: string;
  parameter: SensitivityParameter;
  steps: number;
  rangeMin: number;
  rangeMax: number;
}

export interface SensitivityDataPoint {
  parameterValue: number;
  costPerRequest: number;
  costPerUser: number;
  monthlyCost: number;
  grossMargin: number;
  riskLevel: RiskLevel;
}

export interface SensitivityResult {
  parameter: SensitivityParameter;
  dataPoints: SensitivityDataPoint[];
}

// ── Pricing Recommendation ──
export interface PricingRecommendationInput {
  model: string;
  avgInputTokens: number;
  avgOutputTokens: number;
  requestsPerUser: number;
  targetMargins: number[];
}

export interface PricingTier {
  targetMargin: number;
  recommendedPrice: number;
  costPerUser: number;
  riskLevel: RiskLevel;
}

export interface PricingRecommendationResult {
  costPerUser: number;
  tiers: PricingTier[];
}

// ── Snapshot ──
export interface Snapshot {
  id: string;
  scenarioId: string;
  label: string;
  model: string;
  avgInputTokens: number;
  avgOutputTokens: number;
  requestsPerUser: number;
  projectedUsers: number;
  subscriptionPrice: number;
  createdAt: Date;
}

export interface CreateSnapshotInput {
  label: string;
}

export interface SnapshotWithFinancials extends Snapshot {
  financialResult: FinancialResult;
}

export interface SnapshotComparison {
  snapshots: SnapshotWithFinancials[];
}

// ── AI Advisory ──
export interface AdvisoryResponse {
  insight: string;
  generatedAt: Date;
}
