/**
 * LaunchPromptly SDK — Prompt Management Demo
 *
 * Shows how to use LaunchPromptly as a prompt management layer
 * in a real application. No LLM calls needed — this just
 * demonstrates fetching and managing prompts.
 *
 * Run: npm run demo:prompt
 */

import { LaunchPromptly, PromptNotFoundError, extractVariables } from 'launchpromptly';

const API_URL = process.env.LAUNCHPROMPTLY_API_URL || 'http://localhost:3001';

async function main() {
  console.log('=== Prompt Management Demo ===\n');

  const pf = new LaunchPromptly({
    endpoint: API_URL,
    promptCacheTtl: 5000, // Short TTL so we can see cache behavior
  });

  // ── Scenario 1: Basic prompt fetch ──
  console.log('--- Scenario 1: Basic Prompt Fetch ---');
  try {
    const systemPrompt = await pf.prompt('demo-prompt');
    console.log('Fetched prompt:', systemPrompt);

    // Show what variables are available
    const vars = extractVariables(systemPrompt);
    if (vars.length > 0) {
      console.log('Template variables found:', vars);
    } else {
      console.log('No template variables in this prompt.');
    }
  } catch (err) {
    if (err instanceof PromptNotFoundError) {
      console.log('Prompt not found — create "demo-prompt" in the dashboard first.');
      console.log('Example content: "You are a helpful {{role}} assistant for {{company}}."');
    } else {
      console.log('Error:', (err as Error).message);
    }
  }
  console.log();

  // ── Scenario 2: Multiple prompts for different features ──
  console.log('--- Scenario 2: Multi-Prompt Application ---');
  const prompts = ['demo-prompt', 'onboarding-assistant', 'code-reviewer'];
  for (const slug of prompts) {
    try {
      const content = await pf.prompt(slug, {
        variables: { role: 'AI', company: 'LaunchPromptly', userName: 'Demo User' },
      });
      console.log(`[${slug}] → "${content.slice(0, 80)}${content.length > 80 ? '...' : ''}"`);
    } catch (err) {
      if (err instanceof PromptNotFoundError) {
        console.log(`[${slug}] → (not found — skip)`);
      } else {
        console.log(`[${slug}] → Error: ${(err as Error).message}`);
      }
    }
  }
  console.log();

  // ── Scenario 3: Cache behavior ──
  console.log('--- Scenario 3: Cache Behavior ---');
  try {
    console.log('First fetch (network call)...');
    const t1 = Date.now();
    await pf.prompt('demo-prompt');
    console.log(`  Took ${Date.now() - t1}ms`);

    console.log('Second fetch (from cache)...');
    const t2 = Date.now();
    await pf.prompt('demo-prompt');
    console.log(`  Took ${Date.now() - t2}ms`);

    console.log('Waiting for cache to expire (5s)...');
    await new Promise((r) => setTimeout(r, 5500));

    console.log('Third fetch (cache expired, network call)...');
    const t3 = Date.now();
    await pf.prompt('demo-prompt');
    console.log(`  Took ${Date.now() - t3}ms`);
  } catch {
    console.log('  (prompt not available for cache demo)');
  }
  console.log();

  // ── Scenario 4: Different variable sets for the same prompt ──
  console.log('--- Scenario 4: Same Prompt, Different Variables ---');
  try {
    const users = [
      { name: 'Alice', role: 'admin', company: 'Acme' },
      { name: 'Bob', role: 'support', company: 'BigCo' },
      { name: 'Charlie', role: 'developer', company: 'StartupInc' },
    ];
    for (const user of users) {
      const content = await pf.prompt('demo-prompt', {
        variables: { role: user.role, company: user.company, userName: user.name },
      });
      console.log(`  ${user.name}: "${content.slice(0, 100)}"`);
    }
  } catch {
    console.log('  (prompt not available)');
  }
  console.log();

  await pf.flush();
  pf.destroy();
  console.log('Done!');
}

main().catch(console.error);
