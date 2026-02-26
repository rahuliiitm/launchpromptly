/**
 * LaunchPromptly SDK Demo — Full walkthrough
 *
 * Prerequisites:
 *   1. Start the API:   cd apps/api && npm run dev
 *   2. Create an account and a project via the web UI
 *   3. Go to Settings → Environments → copy an API key
 *   4. Set env:  export LAUNCHPROMPTLY_API_KEY=lp_live_...
 *   5. Create a prompt in the dashboard with slug "demo-prompt"
 *      Content example: "You are a helpful {{role}} assistant for {{company}}."
 *   6. Deploy the prompt to an environment
 *
 * Run:
 *   npm run demo
 */

import { LaunchPromptly, PromptNotFoundError } from 'launchpromptly';

const API_URL = process.env.LAUNCHPROMPTLY_API_URL || 'http://localhost:3001';
const PROMPT_SLUG = process.env.DEMO_PROMPT_SLUG || 'demo-prompt';

async function main() {
  console.log('=== LaunchPromptly SDK Demo ===\n');
  console.log(`API: ${API_URL}`);
  console.log(`Prompt slug: ${PROMPT_SLUG}\n`);

  // ── 1. Initialize ──
  console.log('1. Initializing LaunchPromptly client...');
  const pf = new LaunchPromptly({
    endpoint: API_URL,
    // apiKey is read from LAUNCHPROMPTLY_API_KEY env var
    promptCacheTtl: 30000, // 30s cache
    flushAt: 5,
    flushInterval: 3000,
  });
  console.log('   ✓ Client initialized\n');

  // ── 2. Fetch a prompt ──
  console.log('2. Fetching prompt...');
  try {
    const content = await pf.prompt(PROMPT_SLUG);
    console.log(`   ✓ Raw content: "${content}"\n`);
  } catch (err) {
    if (err instanceof PromptNotFoundError) {
      console.log(`   ✗ Prompt "${PROMPT_SLUG}" not found.`);
      console.log('     → Create it in the dashboard first.\n');
      pf.destroy();
      process.exit(1);
    }
    throw err;
  }

  // ── 3. Fetch with variables ──
  console.log('3. Fetching prompt with template variables...');
  const interpolated = await pf.prompt(PROMPT_SLUG, {
    variables: { role: 'support', company: 'Acme Corp' },
  });
  console.log(`   ✓ Interpolated: "${interpolated}"\n`);

  // ── 4. Cache hit ──
  console.log('4. Fetching again (should be cached)...');
  const start = Date.now();
  const cached = await pf.prompt(PROMPT_SLUG, {
    variables: { role: 'sales', company: 'BigCo' },
  });
  const elapsed = Date.now() - start;
  console.log(`   ✓ Cached result (${elapsed}ms): "${cached}"\n`);

  // ── 5. A/B testing with customerId ──
  console.log('5. Fetching with customerId (for A/B test resolution)...');
  try {
    const abContent = await pf.prompt(PROMPT_SLUG, {
      customerId: 'user-42',
      variables: { role: 'admin', company: 'TestCo' },
    });
    console.log(`   ✓ A/B resolved: "${abContent}"\n`);
  } catch {
    console.log('   ℹ No A/B test configured — got default version\n');
  }

  // ── 6. Error handling ──
  console.log('6. Fetching non-existent prompt (error handling)...');
  try {
    await pf.prompt('this-prompt-does-not-exist');
    console.log('   ✗ Should have thrown\n');
  } catch (err) {
    if (err instanceof PromptNotFoundError) {
      console.log(`   ✓ Caught PromptNotFoundError: ${(err as Error).message}\n`);
    } else {
      console.log(`   ✓ Caught error: ${(err as Error).message}\n`);
    }
  }

  // ── 7. Template utilities ──
  console.log('7. Using template utilities directly...');
  const { extractVariables, interpolate } = await import('launchpromptly');
  const template = 'Hello {{name}}, welcome to {{app}}!';
  const vars = extractVariables(template);
  console.log(`   Variables in template: ${JSON.stringify(vars)}`);
  const result = interpolate(template, { name: 'Alice', app: 'LaunchPromptly' });
  console.log(`   Interpolated: "${result}"\n`);

  // ── Cleanup ──
  console.log('Flushing events and cleaning up...');
  await pf.flush();
  pf.destroy();
  console.log('✓ Done!\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
