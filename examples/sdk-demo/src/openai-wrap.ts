/**
 * LaunchPromptly SDK — OpenAI Wrap Demo
 *
 * Shows how to use LaunchPromptly with OpenAI to:
 *   1. Fetch a managed prompt
 *   2. Wrap the OpenAI client for automatic event tracking
 *   3. Make LLM calls with tracked cost/latency/tokens
 *
 * Prerequisites:
 *   - LAUNCHPROMPTLY_API_KEY set
 *   - OPENAI_API_KEY set
 *   - A prompt "demo-prompt" created and deployed
 *
 * Run: npm run demo:wrap
 */

import { LaunchPromptly } from 'launchpromptly';
import OpenAI from 'openai';

const API_URL = process.env.LAUNCHPROMPTLY_API_URL || 'http://localhost:3001';
const PROMPT_SLUG = process.env.DEMO_PROMPT_SLUG || 'demo-prompt';

async function main() {
  console.log('=== OpenAI + LaunchPromptly Wrap Demo ===\n');

  if (!process.env.OPENAI_API_KEY) {
    console.log('Set OPENAI_API_KEY to run this demo.');
    console.log('Example: export OPENAI_API_KEY=sk-...\n');
    process.exit(1);
  }

  // ── Initialize ──
  const pf = new LaunchPromptly({
    endpoint: API_URL,
    flushAt: 1, // Flush after every event for demo
  });

  const openai = new OpenAI();

  // ── Wrap the OpenAI client ──
  // This transparently tracks all chat.completions.create calls
  const trackedClient = pf.wrap(openai, {
    feature: 'sdk-demo',
    customer: () => ({ id: 'demo-user-1' }),
  });

  // ── Fetch managed prompt ──
  console.log(`Fetching prompt "${PROMPT_SLUG}"...`);
  let systemPrompt: string;
  try {
    systemPrompt = await pf.prompt(PROMPT_SLUG, {
      variables: { role: 'helpful assistant', company: 'LaunchPromptly' },
    });
    console.log(`System prompt: "${systemPrompt}"\n`);
  } catch {
    console.log('Could not fetch prompt — using fallback.\n');
    systemPrompt = 'You are a helpful assistant.';
  }

  // ── Make an LLM call ──
  console.log('Making OpenAI call...');
  const response = await trackedClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'What is LaunchPromptly in one sentence?' },
    ],
    max_tokens: 100,
  });

  console.log(`Response: ${response.choices[0]?.message?.content}`);
  console.log(`Tokens: ${response.usage?.total_tokens} (in: ${response.usage?.prompt_tokens}, out: ${response.usage?.completion_tokens})`);
  console.log();

  // ── Second call with different prompt ──
  console.log('Making a second call with traceId...');
  const traced = pf.wrap(openai, {
    feature: 'sdk-demo',
    traceId: 'demo-trace-001',
    spanName: 'summarize',
  });

  const response2 = await traced.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Summarize prompt management in 2 words.' },
    ],
    max_tokens: 20,
  });

  console.log(`Response: ${response2.choices[0]?.message?.content}`);
  console.log();

  // ── Flush and cleanup ──
  console.log('Flushing events to LaunchPromptly...');
  await pf.flush();
  pf.destroy();

  console.log('✓ Events sent! Check the Observability tab in your LaunchPromptly dashboard.');
  console.log('  You should see 2 tracked calls with cost, latency, and token data.\n');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
