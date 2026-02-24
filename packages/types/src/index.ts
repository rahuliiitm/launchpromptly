// ── Billing ──
export type PlanTier = 'free' | 'pro' | 'business';

// ── Roles ──
export type UserRole = 'admin' | 'member';

// ── User ──
export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  organizationId: string | null;
  plan: PlanTier;
  projectId: string | null;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  userId: string;
  plan: PlanTier;
}

// ── Team & Invitations ──
export interface TeamMember {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export interface InvitationInfo {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
}

export interface CreateInvitationInput {
  email: string;
  role?: UserRole;
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

// ── Platform: Providers ──
export type LLMProvider = 'openai' | 'anthropic';

// ── Platform: Multi-tenancy ──
export interface Organization {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  createdAt: Date;
}

export interface ApiKey {
  id: string;
  projectId: string;
  keyPrefix: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

// ── Platform: Events ──
export interface LLMEvent {
  id: string;
  projectId: string;
  customerId: string | null;
  feature: string | null;
  provider: LLMProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  systemHash: string | null;
  fullHash: string | null;
  promptPreview: string | null;
  statusCode: number;
  createdAt: Date;
}

// ── Platform: SDK Event Payloads ──
export interface IngestEventPayload {
  provider: LLMProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  customerId?: string;
  feature?: string;
  systemHash?: string;
  fullHash?: string;
  promptPreview?: string;
  statusCode?: number;
  managedPromptId?: string;
  promptVersionId?: string;
  ragPipelineId?: string;
  ragQuery?: string;
  ragRetrievalMs?: number;
  ragChunkCount?: number;
  ragContextTokens?: number;
  ragChunks?: RagChunk[];
}

export interface IngestBatchPayload {
  events: IngestEventPayload[];
}

// ── Platform: Analytics Responses ──
export interface ModelBreakdownItem {
  model: string;
  totalCostUsd: number;
  callCount: number;
  avgLatencyMs: number;
}

export interface OverviewAnalytics {
  totalCostUsd: number;
  totalCalls: number;
  avgLatencyMs: number;
  modelBreakdown: ModelBreakdownItem[];
  periodDays: number;
}

export interface CustomerAnalyticsItem {
  customerId: string;
  totalCostUsd: number;
  callCount: number;
  avgCostPerCall: number;
}

export interface FeatureAnalyticsItem {
  feature: string;
  totalCostUsd: number;
  callCount: number;
}

export interface TimeSeriesPoint {
  date: string;
  costUsd: number;
  callCount: number;
}

// ── Platform: Optimization ──
export type OptimizationType = 'model_downgrade' | 'verbose_prompt' | 'caching_opportunity';

export interface OptimizationRecommendation {
  type: OptimizationType;
  title: string;
  description: string;
  estimatedSavingsUsd: number;
  affectedTemplateHash: string | null;
  currentModel: string | null;
  suggestedModel: string | null;
}

// ── Platform: RAG Observability ──
export interface RagChunk {
  content: string;
  source: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface RagOverview {
  totalRagCalls: number;
  avgRetrievalMs: number;
  avgChunkCount: number;
  avgContextTokens: number;
  totalCostUsd: number;
  periodDays: number;
  pipelineBreakdown: RagPipelineStats[];
}

export interface RagPipelineStats {
  pipelineId: string;
  callCount: number;
  avgRetrievalMs: number;
  avgChunkCount: number;
  totalCostUsd: number;
}

export interface RagTimeSeriesPoint {
  date: string;
  ragCalls: number;
  avgRetrievalMs: number;
  avgChunkCount: number;
  costUsd: number;
}

export interface RagTraceListItem {
  id: string;
  ragPipelineId: string | null;
  ragQuery: string | null;
  ragRetrievalMs: number | null;
  ragChunkCount: number | null;
  ragContextTokens: number | null;
  model: string;
  provider: string;
  costUsd: number;
  latencyMs: number;
  createdAt: string;
}

export interface RagTraceDetail extends RagTraceListItem {
  ragChunks: RagChunk[] | null;
  promptPreview: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  customerId: string | null;
  feature: string | null;
}

// ── Platform: Prompt Management ──
export type PromptVersionStatus = 'draft' | 'active' | 'archived';
export type ABTestStatus = 'draft' | 'running' | 'completed';

export interface ManagedPrompt {
  id: string;
  projectId: string;
  slug: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptVersion {
  id: string;
  managedPromptId: string;
  version: number;
  content: string;
  status: PromptVersionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManagedPromptWithVersions extends ManagedPrompt {
  versions: PromptVersion[];
  _count?: { versions: number };
  activeVersion?: PromptVersion | null;
}

export interface CreateManagedPromptInput {
  slug: string;
  name: string;
  description?: string;
  initialContent?: string;
}

export interface UpdateManagedPromptInput {
  slug?: string;
  name?: string;
  description?: string;
}

export interface CreatePromptVersionInput {
  content: string;
}

export interface ResolvedPrompt {
  content: string;
  managedPromptId: string;
  promptVersionId: string;
  version: number;
}

export interface ABTest {
  id: string;
  managedPromptId: string;
  name: string;
  status: ABTestStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  variants: ABTestVariant[];
}

export interface ABTestVariant {
  id: string;
  abTestId: string;
  promptVersionId: string;
  trafficPercent: number;
}

export interface PromptVersionAnalytics {
  promptVersionId: string;
  version: number;
  callCount: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  avgCostPerCall: number;
}

// ── Platform: Prompt Analytics (per-prompt cost) ──
export interface PromptAnalyticsItem {
  promptId: string;
  promptName: string;
  promptSlug: string;
  totalCostUsd: number;
  callCount: number;
  avgLatencyMs: number;
}

// ── Platform: Provider Keys ──
export interface OrgProviderKey {
  id: string;
  organizationId: string;
  provider: LLMProvider;
  label: string;
  createdAt: Date;
}

// ── Platform: Playground ──
export interface PlaygroundRequest {
  systemPrompt: string;
  userMessage: string;
  models: string[];
}

export interface PlaygroundModelResult {
  model: string;
  provider: LLMProvider;
  response: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  error?: string;
}

export interface PlaygroundResponse {
  results: PlaygroundModelResult[];
}

// ── Platform: Prompt Analysis ──
export interface PromptAnalysis {
  originalTokenEstimate: number;
  originalCostPerCall: number;
  optimizedContent: string | null;
  analysis: string | null;
  optimizedTokenEstimate: number | null;
  optimizedCostPerCall: number | null;
  tokenSavings: number | null;
  costSavings: number | null;
  model: string;
}
