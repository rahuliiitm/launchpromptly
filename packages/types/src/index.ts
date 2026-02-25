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

// ── Teams (prompt ownership & RBAC) ──
export type TeamRole = 'viewer' | 'editor' | 'lead';

export interface Team {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  createdAt: string;
}

export interface TeamWithMembers extends Team {
  members: TeamMemberDetail[];
  _count: { prompts: number };
}

export interface TeamMemberDetail {
  id: string;
  userId: string;
  email: string;
  role: TeamRole;
  createdAt: string;
}

// ── Org Members & Invitations ──
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
  environmentId: string | null;
  keyPrefix: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

// ── Environments ──
export interface Environment {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  color: string;
  sortOrder: number;
  isCritical: boolean;
  createdAt: string;
}

export interface EnvironmentWithKey extends Environment {
  sdkKey?: string;
  sdkKeyPrefix?: string;
}

export interface PromptDeploymentInfo {
  id: string;
  environmentId: string;
  environmentName: string;
  environmentSlug: string;
  environmentColor: string;
  promptVersionId: string;
  version: number;
  deployedAt: string;
  deployedBy: string | null;
}

export interface EnvironmentUsageStats {
  environmentId: string;
  environmentName: string;
  environmentColor: string;
  promptVersionId: string | null;
  version: number | null;
  callCount24h: number;
  callCount1h: number;
  totalCostUsd24h: number;
  avgLatencyMs: number;
  lastCalledAt: string | null;
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
  responseText?: string;
  traceId?: string;
  spanName?: string;
  environmentId?: string;
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
  traceId: string | null;
  spanName: string | null;
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
  faithfulnessScore: number | null;
  relevanceScore: number | null;
  contextRelevanceScore: number | null;
}

export interface RagTraceDetail extends RagTraceListItem {
  ragChunks: RagChunk[] | null;
  responseText: string | null;
  promptPreview: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  customerId: string | null;
  feature: string | null;
  evaluation: RagEvaluationResult | null;
}

// ── Platform: Observability Flows ──
export interface FlowListItem {
  traceId: string;
  ragPipelineId: string | null;
  ragQuery: string | null;
  responsePreview: string | null;
  spanCount: number;
  totalCostUsd: number;
  totalLatencyMs: number;
  models: string[];
  spanNames: string[];
  createdAt: string;
  faithfulnessScore: number | null;
  relevanceScore: number | null;
  contextRelevanceScore: number | null;
}

export interface FlowDetail {
  traceId: string;
  ragPipelineId: string | null;
  spans: FlowSpan[];
  totalCostUsd: number;
  totalTokens: number;
  evaluation: RagEvaluationResult | null;
}

export interface FlowSpan {
  id: string;
  spanName: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  createdAt: string;
  ragQuery: string | null;
  ragChunks: RagChunk[] | null;
  ragRetrievalMs: number | null;
  ragChunkCount: number | null;
  ragContextTokens: number | null;
  responseText: string | null;
  promptPreview: string | null;
  managedPromptId: string | null;
  managedPromptName: string | null;
  customerId: string | null;
  feature: string | null;
  evaluation: RagEvaluationResult | null;
}

// ── Platform: RAG Evaluation ──
export interface ChunkRelevanceScore {
  index: number;
  score: number;
  relevant: boolean;
}

export interface RagEvaluationResult {
  id: string;
  eventId: string;
  faithfulnessScore: number | null;
  faithfulnessReasoning: string | null;
  relevanceScore: number | null;
  relevanceReasoning: string | null;
  contextRelevanceScore: number | null;
  contextRelevanceReasoning: string | null;
  chunkRelevanceScores: ChunkRelevanceScore[] | null;
  evaluationModel: string;
  evaluationCostUsd: number;
  status: string;
  error: string | null;
  createdAt: string;
}

export interface RagQualityOverview {
  totalEvaluated: number;
  totalUnevaluated: number;
  avgFaithfulness: number | null;
  avgRelevance: number | null;
  avgContextRelevance: number | null;
  periodDays: number;
  pipelineBreakdown: RagQualityPipelineStats[];
  scoreDistribution: {
    good: number;   // > 0.8
    fair: number;   // 0.5–0.8
    poor: number;   // < 0.5
  };
}

export interface RagQualityPipelineStats {
  pipelineId: string;
  evaluatedCount: number;
  avgFaithfulness: number | null;
  avgRelevance: number | null;
  avgContextRelevance: number | null;
}

export interface RagQualityTimeSeriesPoint {
  date: string;
  evaluatedCount: number;
  avgFaithfulness: number | null;
  avgRelevance: number | null;
  avgContextRelevance: number | null;
}

// ── Platform: Prompt Management ──
export type PromptVersionStatus = 'draft' | 'active' | 'archived';
export type ABTestStatus = 'draft' | 'running' | 'completed';

export interface ManagedPrompt {
  id: string;
  projectId: string;
  teamId: string | null;
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
  deployments?: PromptDeploymentInfo[];
  team?: { id: string; name: string; slug: string; color: string } | null;
}

export interface CreateManagedPromptInput {
  slug: string;
  name: string;
  description?: string;
  initialContent?: string;
  teamId?: string;
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
  environment?: string;
  variables?: string[];
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

// ── Platform: Eval Gates ──
export type EvalRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface EvalDataset {
  id: string;
  managedPromptId: string;
  name: string;
  description: string;
  passThreshold: number;
  createdAt: string;
  _count?: { cases: number; runs: number };
}

export interface EvalCase {
  id: string;
  datasetId: string;
  input: string;
  expectedOutput: string | null;
  variables: Record<string, string> | null;
  criteria: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface EvalDatasetWithCases extends EvalDataset {
  cases: EvalCase[];
}

export interface EvalRun {
  id: string;
  datasetId: string;
  promptVersionId: string;
  status: EvalRunStatus;
  score: number | null;
  passed: boolean | null;
  createdAt: string;
  completedAt: string | null;
  _count?: { results: number };
}

export interface EvalResult {
  id: string;
  evalRunId: string;
  evalCaseId: string;
  score: number;
  reasoning: string;
  createdAt: string;
  evalCase?: EvalCase;
}

export interface EvalRunWithResults extends EvalRun {
  results: EvalResult[];
  dataset?: EvalDataset;
  promptVersion?: { version: number };
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
