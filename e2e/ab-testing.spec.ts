import { test, expect, type Page } from '@playwright/test';

const API_BASE = process.env.API_URL ?? 'http://localhost:3001';

async function registerAndLogin(page: Page): Promise<{ token: string; projectId: string }> {
  const email = `pw-ab-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;

  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const { accessToken: token, userId } = await regRes.json();

  const projRes = await fetch(`${API_BASE}/project`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const projects = await projRes.json();
  const projectId = projects[0]?.id;

  await page.goto('/');
  await page.evaluate(
    ({ token, userId, projectId }: { token: string; userId: string; projectId: string }) => {
      localStorage.setItem('pf_token', token);
      localStorage.setItem('pf_user_id', userId);
      localStorage.setItem('pf_project_id', projectId);
    },
    { token, userId, projectId },
  );

  return { token, projectId };
}

async function seedPromptWithVersions(
  token: string,
  projectId: string,
): Promise<{ promptId: string; v1Id: string; v2Id: string }> {
  // Create prompt with v1
  const res = await fetch(`${API_BASE}/prompt/${projectId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      slug: `ab-test-${Date.now()}`,
      name: 'A/B Test Prompt',
      initialContent: 'Version A: concise prompt.',
    }),
  });
  const { id: promptId, versions } = await res.json();
  const v1Id = versions[0].id;

  // Create v2
  const v2Res = await fetch(`${API_BASE}/prompt/${projectId}/${promptId}/versions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: 'Version B: detailed and verbose prompt with examples.' }),
  });
  const { id: v2Id } = await v2Res.json();

  return { promptId, v1Id, v2Id };
}

test.describe('A/B Testing', () => {
  let token: string;
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    const auth = await registerAndLogin(page);
    token = auth.token;
    projectId = auth.projectId;
  });

  test('create an A/B test with two versions', async ({ page }) => {
    const { promptId, v1Id, v2Id } = await seedPromptWithVersions(token, projectId);

    await page.goto(`/dashboard/prompts/managed/${promptId}/ab-tests`);

    await page.getByRole('button', { name: 'New A/B Test' }).click();
    await page.locator('input[placeholder*="Concise"]').fill('A vs B test');

    // Select versions in dropdowns
    const selects = page.locator('select');
    await selects.nth(0).selectOption(v1Id);
    await selects.nth(1).selectOption(v2Id);

    await page.getByRole('button', { name: 'Create A/B Test' }).click();

    await expect(page.getByText('A vs B test')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('draft')).toBeVisible();
  });

  test('start an A/B test', async ({ page }) => {
    const { promptId, v1Id, v2Id } = await seedPromptWithVersions(token, projectId);

    // Create test via API
    const createRes = await fetch(
      `${API_BASE}/prompt/${projectId}/${promptId}/ab-tests`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Start Test',
          variants: [
            { promptVersionId: v1Id, trafficPercent: 50 },
            { promptVersionId: v2Id, trafficPercent: 50 },
          ],
        }),
      },
    );
    const { id: testId } = await createRes.json();

    await page.goto(`/dashboard/prompts/managed/${promptId}/ab-tests`);

    // The test list should include our test (loaded from API via getABTestResults or similar)
    // For now we just check the page loads and has the button
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Start' }).click();

    await expect(page.getByText('running')).toBeVisible({ timeout: 5000 });
  });

  test('view A/B test results', async ({ page }) => {
    const { promptId, v1Id, v2Id } = await seedPromptWithVersions(token, projectId);

    // Create and start test via API
    const createRes = await fetch(
      `${API_BASE}/prompt/${projectId}/${promptId}/ab-tests`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Results Test',
          variants: [
            { promptVersionId: v1Id, trafficPercent: 50 },
            { promptVersionId: v2Id, trafficPercent: 50 },
          ],
        }),
      },
    );
    const { id: testId } = await createRes.json();

    await fetch(
      `${API_BASE}/prompt/${projectId}/${promptId}/ab-tests/${testId}/start`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    );

    await page.goto(`/dashboard/prompts/managed/${promptId}/ab-tests`);
    await page.getByRole('button', { name: 'View Results' }).click();

    // Results table should appear (even if empty)
    await expect(page.getByText('Results')).toBeVisible({ timeout: 5000 });
  });

  test('stop an A/B test', async ({ page }) => {
    const { promptId, v1Id, v2Id } = await seedPromptWithVersions(token, projectId);

    // Create and start test via API
    const createRes = await fetch(
      `${API_BASE}/prompt/${projectId}/${promptId}/ab-tests`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Stop Test',
          variants: [
            { promptVersionId: v1Id, trafficPercent: 50 },
            { promptVersionId: v2Id, trafficPercent: 50 },
          ],
        }),
      },
    );
    const { id: testId } = await createRes.json();

    await fetch(
      `${API_BASE}/prompt/${projectId}/${promptId}/ab-tests/${testId}/start`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    );

    await page.goto(`/dashboard/prompts/managed/${promptId}/ab-tests`);
    await page.getByRole('button', { name: 'Stop' }).click();

    await expect(page.getByText('completed')).toBeVisible({ timeout: 5000 });
  });
});
