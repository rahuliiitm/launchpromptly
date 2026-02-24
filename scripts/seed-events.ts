/**
 * Seed script: generates realistic LLM events simulating a SaaS company
 * using PlanForge over the last 14 days.
 *
 * Usage: npx ts-node scripts/seed-events.ts
 */

const API_KEY = process.env.PF_API_KEY!;
const ENDPOINT = process.env.PF_ENDPOINT || 'http://localhost:3001';

// ── Prompt IDs (from the managed prompts we created) ──
const PROMPTS = {
  'customer-support': {
    managedPromptId: 'a20e6c02-50a7-450a-aeb0-eb51101af73b',
    promptVersionId: 'cb3b814f-a6c5-476d-bc56-7d82be2f935d',
  },
  'doc-summarizer': {
    managedPromptId: '3498b8f7-4c79-4c48-86d7-b7a597acd38a',
    promptVersionId: 'a3a7b069-445e-476b-8373-56fa2a3f6257',
  },
  'code-review': {
    managedPromptId: '18721603-0457-4408-ab76-983cc808f9f3',
    promptVersionId: '048e509b-fe5d-4188-9063-b2492ae2fa21',
  },
  'content-generator': {
    managedPromptId: 'ff317b78-3214-4411-ae4c-05f93af6acda',
    promptVersionId: '3cb27476-3204-4c10-bff4-fd5e62526bd0',
  },
};

// ── Customer personas ──
const CUSTOMERS = [
  'cust_acme_corp',
  'cust_globex',
  'cust_initech',
  'cust_umbrella',
  'cust_wayne_ent',
  'cust_stark_ind',
  'cust_hooli',
  'cust_piedpiper',
];

// ── Feature tags ──
const FEATURES = [
  'chat-widget',
  'ticket-summarize',
  'pr-review',
  'blog-writer',
  'email-campaign',
  'onboarding-guide',
  'knowledge-base',
  'slack-bot',
];

// ── Model configs with realistic pricing ──
interface ModelConfig {
  model: string;
  provider: 'openai' | 'anthropic';
  inputCostPer1k: number;
  outputCostPer1k: number;
  avgInputTokens: [number, number]; // [min, max]
  avgOutputTokens: [number, number];
  avgLatencyMs: [number, number];
}

const MODELS: ModelConfig[] = [
  {
    model: 'gpt-4o',
    provider: 'openai',
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    avgInputTokens: [200, 2000],
    avgOutputTokens: [100, 1500],
    avgLatencyMs: [800, 4000],
  },
  {
    model: 'gpt-4o-mini',
    provider: 'openai',
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
    avgInputTokens: [150, 1200],
    avgOutputTokens: [80, 800],
    avgLatencyMs: [300, 1500],
  },
  {
    model: 'gpt-3.5-turbo',
    provider: 'openai',
    inputCostPer1k: 0.0005,
    outputCostPer1k: 0.0015,
    avgInputTokens: [100, 800],
    avgOutputTokens: [50, 500],
    avgLatencyMs: [200, 1000],
  },
  {
    model: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    avgInputTokens: [300, 2500],
    avgOutputTokens: [150, 2000],
    avgLatencyMs: [1000, 5000],
  },
  {
    model: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    inputCostPer1k: 0.00025,
    outputCostPer1k: 0.00125,
    avgInputTokens: [100, 1000],
    avgOutputTokens: [50, 600],
    avgLatencyMs: [200, 800],
  },
];

// ── RAG pipeline configs ──
const RAG_PIPELINES = ['knowledge-base-v1', 'docs-search', 'faq-retrieval'];

const RAG_QUERIES = [
  'How do I reset my password?',
  'What are the pricing tiers?',
  'How to integrate with Slack?',
  'API rate limits documentation',
  'How to export data as CSV?',
  'What SSO providers are supported?',
  'How to set up webhooks?',
  'Billing and invoice questions',
  'How to add team members?',
  'Data retention policy',
];

const RAG_SOURCES = [
  'docs/getting-started.md',
  'docs/api-reference.md',
  'docs/billing.md',
  'docs/integrations/slack.md',
  'docs/security/sso.md',
  'docs/admin/team-management.md',
  'faq/general.md',
  'faq/pricing.md',
  'kb/troubleshooting.md',
  'kb/best-practices.md',
];

// ── Helpers ──
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomDate(daysBack: number): Date {
  const now = Date.now();
  const past = now - daysBack * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past));
}

function generateHash(): string {
  const chars = 'abcdef0123456789';
  let hash = '';
  for (let i = 0; i < 16; i++) hash += chars[Math.floor(Math.random() * chars.length)];
  return hash;
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Event generators by use case ──

interface EventPayload {
  provider: string;
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
  ragChunks?: Array<{ content: string; source: string; score: number }>;
  responseText?: string;
  traceId?: string;
  spanName?: string;
}

function generateSupportEvent(): EventPayload {
  // Customer support: mostly fast models, with some complex queries on GPT-4o
  const isComplex = Math.random() < 0.3;
  const m = isComplex
    ? MODELS.find((x) => x.model === 'gpt-4o')!
    : pick([MODELS[1]!, MODELS[4]!]); // gpt-4o-mini or haiku

  const inputTokens = rand(...m.avgInputTokens);
  const outputTokens = rand(...m.avgOutputTokens);
  const prompt = PROMPTS['customer-support'];

  return {
    provider: m.provider,
    model: m.model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: +(
      (inputTokens / 1000) * m.inputCostPer1k +
      (outputTokens / 1000) * m.outputCostPer1k
    ).toFixed(6),
    latencyMs: rand(...m.avgLatencyMs),
    customerId: pick(CUSTOMERS),
    feature: pick(['chat-widget', 'slack-bot', 'ticket-summarize']),
    systemHash: generateHash(),
    fullHash: generateHash(),
    promptPreview: 'You are a helpful customer support agent...',
    statusCode: Math.random() < 0.02 ? 500 : 200,
    managedPromptId: prompt.managedPromptId,
    promptVersionId: prompt.promptVersionId,
  };
}

function generateSummarizerEvent(): EventPayload {
  // Doc summarizer: medium-sized inputs, used by a few power customers
  const m = pick([MODELS[0]!, MODELS[3]!]); // gpt-4o or claude-3.5-sonnet
  const inputTokens = rand(800, 4000); // longer docs
  const outputTokens = rand(100, 400);
  const prompt = PROMPTS['doc-summarizer'];

  return {
    provider: m.provider,
    model: m.model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: +(
      (inputTokens / 1000) * m.inputCostPer1k +
      (outputTokens / 1000) * m.outputCostPer1k
    ).toFixed(6),
    latencyMs: rand(1500, 6000),
    customerId: pick(CUSTOMERS.slice(0, 4)), // fewer customers use this
    feature: 'ticket-summarize',
    systemHash: generateHash(),
    fullHash: generateHash(),
    promptPreview: 'You are a document summarization assistant...',
    statusCode: 200,
    managedPromptId: prompt.managedPromptId,
    promptVersionId: prompt.promptVersionId,
  };
}

function generateCodeReviewEvent(): EventPayload {
  // Code review: heavy on GPT-4o / Sonnet, large token counts
  const m = pick([MODELS[0]!, MODELS[3]!]); // gpt-4o or sonnet
  const inputTokens = rand(500, 3000);
  const outputTokens = rand(200, 1200);
  const prompt = PROMPTS['code-review'];

  return {
    provider: m.provider,
    model: m.model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: +(
      (inputTokens / 1000) * m.inputCostPer1k +
      (outputTokens / 1000) * m.outputCostPer1k
    ).toFixed(6),
    latencyMs: rand(2000, 8000),
    customerId: pick(CUSTOMERS.slice(2, 6)),
    feature: 'pr-review',
    systemHash: generateHash(),
    fullHash: generateHash(),
    promptPreview: 'You are a senior software engineer reviewing code...',
    statusCode: Math.random() < 0.01 ? 429 : 200,
    managedPromptId: prompt.managedPromptId,
    promptVersionId: prompt.promptVersionId,
  };
}

function generateContentEvent(): EventPayload {
  // Content gen: varied models, marketing team customers
  const m = pick(MODELS);
  const inputTokens = rand(...m.avgInputTokens);
  const outputTokens = rand(200, 2000); // longer outputs for content
  const prompt = PROMPTS['content-generator'];

  return {
    provider: m.provider,
    model: m.model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: +(
      (inputTokens / 1000) * m.inputCostPer1k +
      (outputTokens / 1000) * m.outputCostPer1k
    ).toFixed(6),
    latencyMs: rand(...m.avgLatencyMs),
    customerId: pick(CUSTOMERS),
    feature: pick(['blog-writer', 'email-campaign']),
    systemHash: generateHash(),
    fullHash: generateHash(),
    promptPreview: 'You are a marketing content specialist...',
    statusCode: 200,
    managedPromptId: prompt.managedPromptId,
    promptVersionId: prompt.promptVersionId,
  };
}

function generateRagFlow(): EventPayload[] {
  // Multi-span RAG flow: rerank → generate → guardrail (optional)
  const traceId = uuid();
  const pipeline = pick(RAG_PIPELINES);
  const query = pick(RAG_QUERIES);
  const customer = pick(CUSTOMERS);
  const events: EventPayload[] = [];

  // Span 1: Rerank — cheap model, short latency
  const rerankModel = pick([MODELS[1]!, MODELS[4]!]); // gpt-4o-mini or haiku
  const rerankInput = rand(100, 400);
  const rerankOutput = rand(20, 80);
  events.push({
    provider: rerankModel.provider,
    model: rerankModel.model,
    inputTokens: rerankInput,
    outputTokens: rerankOutput,
    totalTokens: rerankInput + rerankOutput,
    costUsd: +(
      (rerankInput / 1000) * rerankModel.inputCostPer1k +
      (rerankOutput / 1000) * rerankModel.outputCostPer1k
    ).toFixed(6),
    latencyMs: rand(80, 300),
    customerId: customer,
    feature: 'knowledge-base',
    systemHash: generateHash(),
    fullHash: generateHash(),
    promptPreview: `[rerank] Score relevance of chunks for: ${query}`,
    statusCode: 200,
    ragPipelineId: pipeline,
    traceId,
    spanName: 'rerank',
  });

  // Span 2: Generate — powerful model, RAG chunks + query + response
  const genModel = pick([MODELS[0]!, MODELS[3]!]); // gpt-4o or sonnet
  const ragChunkCount = rand(2, 6);
  const ragContextTokens = rand(300, 1500);
  const genInput = rand(200, 800) + ragContextTokens;
  const genOutput = rand(100, 600);

  const chunks = Array.from({ length: ragChunkCount }, () => ({
    content: `Relevant documentation excerpt about ${query.toLowerCase().slice(0, 30)}...`,
    source: pick(RAG_SOURCES),
    score: +(Math.random() * 0.5 + 0.5).toFixed(3),
  }));

  const prompt = PROMPTS['customer-support'];
  events.push({
    provider: genModel.provider,
    model: genModel.model,
    inputTokens: genInput,
    outputTokens: genOutput,
    totalTokens: genInput + genOutput,
    costUsd: +(
      (genInput / 1000) * genModel.inputCostPer1k +
      (genOutput / 1000) * genModel.outputCostPer1k
    ).toFixed(6),
    latencyMs: rand(...genModel.avgLatencyMs),
    customerId: customer,
    feature: 'knowledge-base',
    systemHash: generateHash(),
    fullHash: generateHash(),
    promptPreview: `[generate] ${query}`,
    statusCode: 200,
    ragPipelineId: pipeline,
    ragQuery: query,
    ragRetrievalMs: rand(50, 400),
    ragChunkCount,
    ragContextTokens,
    ragChunks: chunks,
    responseText: `Based on our documentation, here is the answer to "${query}": ...`,
    managedPromptId: prompt.managedPromptId,
    promptVersionId: prompt.promptVersionId,
    traceId,
    spanName: 'generate',
  });

  // Span 3: Guardrail (40% chance) — cheap model, checking output
  if (Math.random() < 0.4) {
    const guardModel = pick([MODELS[1]!, MODELS[4]!]); // mini or haiku
    const guardInput = rand(100, 300);
    const guardOutput = rand(10, 50);
    events.push({
      provider: guardModel.provider,
      model: guardModel.model,
      inputTokens: guardInput,
      outputTokens: guardOutput,
      totalTokens: guardInput + guardOutput,
      costUsd: +(
        (guardInput / 1000) * guardModel.inputCostPer1k +
        (guardOutput / 1000) * guardModel.outputCostPer1k
      ).toFixed(6),
      latencyMs: rand(50, 200),
      customerId: customer,
      feature: 'knowledge-base',
      systemHash: generateHash(),
      fullHash: generateHash(),
      promptPreview: '[guardrail] Check response for policy compliance',
      statusCode: 200,
      ragPipelineId: pipeline,
      traceId,
      spanName: 'guardrail',
    });
  }

  return events;
}

function generateGenericEvent(): EventPayload {
  // Ad-hoc LLM calls not tied to managed prompts (direct SDK usage)
  const m = pick(MODELS);
  const inputTokens = rand(...m.avgInputTokens);
  const outputTokens = rand(...m.avgOutputTokens);

  return {
    provider: m.provider,
    model: m.model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: +(
      (inputTokens / 1000) * m.inputCostPer1k +
      (outputTokens / 1000) * m.outputCostPer1k
    ).toFixed(6),
    latencyMs: rand(...m.avgLatencyMs),
    customerId: pick(CUSTOMERS),
    feature: pick(FEATURES),
    systemHash: generateHash(),
    fullHash: generateHash(),
    promptPreview: 'You are a helpful assistant...',
    statusCode: Math.random() < 0.03 ? pick([429, 500, 503]) : 200,
  };
}

// ── Main ──
async function main() {
  if (!API_KEY) {
    console.error('Set PF_API_KEY environment variable');
    process.exit(1);
  }

  console.log(`Seeding events to ${ENDPOINT}...`);

  // Generate events with realistic distribution over 14 days
  // Single-event generators (non-RAG)
  const singleGenerators = [
    { fn: generateSupportEvent, weight: 30 },   // support is #1 use case
    { fn: generateContentEvent, weight: 15 },    // content generation
    { fn: generateCodeReviewEvent, weight: 10 }, // code review
    { fn: generateSummarizerEvent, weight: 10 }, // doc summarization
    { fn: generateGenericEvent, weight: 10 },    // ad-hoc calls
  ];

  const singleWeight = singleGenerators.reduce((s, g) => s + g.weight, 0);
  const allEvents: EventPayload[] = [];

  // Generate ~220 single-span events
  const SINGLE_TARGET = 220;
  for (let i = 0; i < SINGLE_TARGET; i++) {
    let r = Math.random() * singleWeight;
    let gen = singleGenerators[0]!.fn;
    for (const g of singleGenerators) {
      r -= g.weight;
      if (r <= 0) {
        gen = g.fn;
        break;
      }
    }
    allEvents.push(gen());
  }

  // Generate ~30 multi-span RAG flows (60-90 individual events)
  const RAG_FLOW_TARGET = 30;
  let ragFlowCount = 0;
  for (let i = 0; i < RAG_FLOW_TARGET; i++) {
    const flowEvents = generateRagFlow();
    ragFlowCount++;
    allEvents.push(...flowEvents);
  }

  // Send in batches of 50
  const BATCH_SIZE = 50;
  let totalAccepted = 0;

  for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
    const batch = allEvents.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${ENDPOINT}/v1/events/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ events: batch }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Batch ${i / BATCH_SIZE + 1} failed (${res.status}): ${body}`);
      continue;
    }

    const result = (await res.json()) as { accepted: number };
    totalAccepted += result.accepted;
    console.log(
      `  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allEvents.length / BATCH_SIZE)}: ${result.accepted} events accepted`,
    );
  }

  console.log(`\nDone! ${totalAccepted}/${allEvents.length} events ingested.`);

  // Print summary
  const modelCounts: Record<string, number> = {};
  const featureCounts: Record<string, number> = {};
  const traceIds = new Set<string>();
  let totalCost = 0;
  let ragCount = 0;

  for (const e of allEvents) {
    modelCounts[e.model] = (modelCounts[e.model] || 0) + 1;
    if (e.feature) featureCounts[e.feature] = (featureCounts[e.feature] || 0) + 1;
    totalCost += e.costUsd;
    if (e.ragPipelineId) ragCount++;
    if (e.traceId) traceIds.add(e.traceId);
  }

  console.log('\n── Summary ──');
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  console.log(`RAG events: ${ragCount}`);
  console.log(`RAG flows: ${ragFlowCount} (${traceIds.size} unique traceIds)`);
  console.log('\nBy model:');
  for (const [m, c] of Object.entries(modelCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${m}: ${c}`);
  }
  console.log('\nBy feature:');
  for (const [f, c] of Object.entries(featureCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${f}: ${c}`);
  }
}

main().catch(console.error);
