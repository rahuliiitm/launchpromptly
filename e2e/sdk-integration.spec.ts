import { test, expect } from '@playwright/test';
import { createTestAuth, type TestAuth } from './fixtures/auth';
import { seedPrompt, seedVersion, deployVersion } from './fixtures/seed';

const API_BASE = process.env.API_URL ?? 'http://localhost:3001';

test.describe('SDK Integration', () => {
  let auth: TestAuth;

  test.beforeAll(async () => {
    auth = await createTestAuth();
  });

  test('create prompt → deploy → resolve via API key returns content', async () => {
    const prompt = await seedPrompt(
      auth,
      'sdk-test',
      'SDK Test',
      'You are an SDK test agent.',
    );
    expect(prompt.versionId).toBeDefined();

    // Deploy the version
    await deployVersion(auth, prompt.id, prompt.versionId!);

    // Resolve via API key (SDK path)
    const resolveRes = await fetch(
      `${API_BASE}/v1/prompts/resolve/${prompt.slug}`,
      {
        headers: { Authorization: `Bearer ${auth.apiKey}` },
      },
    );
    expect(resolveRes.ok).toBe(true);
    const resolved = await resolveRes.json();
    expect(resolved.content).toBe('You are an SDK test agent.');
    expect(resolved.managedPromptId).toBe(prompt.id);
    expect(resolved.promptVersionId).toBe(prompt.versionId);
  });

  test('events with managedPromptId persist correctly', async () => {
    const prompt = await seedPrompt(
      auth,
      'event-test',
      'Event Test',
      'Event test prompt.',
    );
    await deployVersion(auth, prompt.id, prompt.versionId!);

    // Ingest an event with managedPromptId
    const ingestRes = await fetch(`${API_BASE}/v1/events/batch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        events: [
          {
            provider: 'openai',
            model: 'gpt-4o',
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            costUsd: 0.005,
            latencyMs: 200,
            statusCode: 200,
            managedPromptId: prompt.id,
            promptVersionId: prompt.versionId,
          },
        ],
      }),
    });
    expect(ingestRes.status).toBe(202);

    // Verify via analytics that the event is counted
    const analyticsRes = await fetch(
      `${API_BASE}/prompt/${auth.projectId}/${prompt.id}/analytics?days=1`,
      {
        headers: { Authorization: `Bearer ${auth.token}` },
      },
    );
    expect(analyticsRes.ok).toBe(true);
    const analytics = await analyticsRes.json();
    const versionAnalytics = analytics.find(
      (a: { promptVersionId: string }) => a.promptVersionId === prompt.versionId,
    );
    expect(versionAnalytics).toBeDefined();
    expect(versionAnalytics.callCount).toBeGreaterThanOrEqual(1);
  });

  test('revoked API key cannot resolve', async () => {
    // Create a second API key and revoke it
    const keyRes = await fetch(
      `${API_BASE}/project/${auth.projectId}/api-keys`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'revoke-test-key' }),
      },
    );
    const { rawKey, id: keyId } = await keyRes.json();

    // Revoke the key
    await fetch(`${API_BASE}/project/${auth.projectId}/api-keys/${keyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    // Try to resolve — should fail
    const resolveRes = await fetch(
      `${API_BASE}/v1/prompts/resolve/sdk-test`,
      {
        headers: { Authorization: `Bearer ${rawKey}` },
      },
    );
    expect(resolveRes.status).toBe(401);
  });
});
