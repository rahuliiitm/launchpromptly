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
