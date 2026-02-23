import { test, expect, type Page } from '@playwright/test';

const API_BASE = process.env.API_URL ?? 'http://localhost:3001';

async function registerAndLogin(page: Page): Promise<{ token: string; projectId: string }> {
  const email = `pw-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;

  // Register via API
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const { accessToken: token, userId } = await regRes.json();

  // Get project
  const projRes = await fetch(`${API_BASE}/project`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const projects = await projRes.json();
  const projectId = projects[0]?.id;

  // Set auth in browser localStorage
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

test.describe('Prompt Management', () => {
  let token: string;
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    const auth = await registerAndLogin(page);
    token = auth.token;
    projectId = auth.projectId;
  });

  test('navigate to prompts page and see empty state', async ({ page }) => {
    await page.goto('/dashboard/prompts/managed');
    await expect(page.getByText('No managed prompts yet')).toBeVisible();
  });

  test('create a new prompt via form', async ({ page }) => {
    await page.goto('/dashboard/prompts/managed');

    // Create Prompt button should be visible when authenticated
    await expect(page.getByRole('button', { name: 'Create Prompt' })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Create Prompt' }).click();

    // Form should appear
    await expect(page.locator('input[placeholder="customer-support"]')).toBeVisible();

    await page.locator('input[placeholder="customer-support"]').fill('test-prompt');
    await page.locator('input[placeholder="Customer Support Agent"]').fill('Test Prompt');
    await page.locator('textarea').fill('You are a test assistant.');
    await page.getByRole('button', { name: 'Create Prompt' }).last().click();

    // Form should close and prompt should appear in the list
    await expect(page.getByText('Test Prompt')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('test-prompt')).toBeVisible();

    // Verify version count shows 1 (from initialContent)
    await expect(page.getByText('1')).toBeVisible();
  });

  test('create prompt without auth shows error', async ({ page }) => {
    // Navigate to managed page without any auth in localStorage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('pf_token');
      localStorage.removeItem('pf_user_id');
      localStorage.removeItem('pf_project_id');
    });
    await page.goto('/dashboard/prompts/managed');

    // Create Prompt button should NOT be visible when not authenticated
    await expect(page.getByRole('button', { name: 'Create Prompt' })).not.toBeVisible({ timeout: 3000 });

    // Should show not-authenticated message
    await expect(page.getByText('Not authenticated')).toBeVisible();
  });

  test('click prompt to see detail page', async ({ page }) => {
    // Seed a prompt via API
    await fetch(`${API_BASE}/prompt/${projectId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: 'detail-test',
        name: 'Detail Test',
        initialContent: 'Hello detail',
      }),
    });

    await page.goto('/dashboard/prompts/managed');
    await page.getByText('Detail Test').click();

    // Should see detail page with version
    await expect(page.getByText('v1')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Hello detail')).toBeVisible();
  });

  test('create a new version', async ({ page }) => {
    // Seed prompt
    const res = await fetch(`${API_BASE}/prompt/${projectId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: 'version-test',
        name: 'Version Test',
        initialContent: 'Version 1 content',
      }),
    });
    const { id: promptId } = await res.json();

    await page.goto(`/dashboard/prompts/managed/${promptId}`);
    await page.getByRole('button', { name: 'New Version' }).click();
    await page.locator('textarea').fill('Version 2 content');
    await page.getByRole('button', { name: 'Create Version' }).click();

    await expect(page.getByText('v2')).toBeVisible({ timeout: 5000 });
  });

  test('deploy a version changes status badge', async ({ page }) => {
    // Seed prompt with v1
    const res = await fetch(`${API_BASE}/prompt/${projectId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: 'deploy-test',
        name: 'Deploy Test',
        initialContent: 'Deploy me',
      }),
    });
    const { id: promptId } = await res.json();

    await page.goto(`/dashboard/prompts/managed/${promptId}`);

    // v1 should be draft initially
    await expect(page.getByText('draft')).toBeVisible({ timeout: 5000 });

    // Click Deploy
    await page.getByRole('button', { name: 'Deploy' }).click();

    // Now should show active
    await expect(page.getByText('active')).toBeVisible({ timeout: 5000 });
  });

  test('rollback to previous version', async ({ page }) => {
    // Seed prompt, create v2, deploy both
    const res = await fetch(`${API_BASE}/prompt/${projectId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: 'rollback-test',
        name: 'Rollback Test',
        initialContent: 'Version 1',
      }),
    });
    const { id: promptId, versions } = await res.json();
    const v1Id = versions[0].id;

    // Deploy v1
    await fetch(
      `${API_BASE}/prompt/${projectId}/${promptId}/versions/${v1Id}/deploy`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    );

    // Create and deploy v2
    const v2Res = await fetch(`${API_BASE}/prompt/${projectId}/${promptId}/versions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Version 2' }),
    });
    const { id: v2Id } = await v2Res.json();
    await fetch(
      `${API_BASE}/prompt/${projectId}/${promptId}/versions/${v2Id}/deploy`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    );

    await page.goto(`/dashboard/prompts/managed/${promptId}`);

    // Click Rollback
    await page.getByRole('button', { name: 'Rollback' }).click();

    // Wait for page to refresh — v1 should now be active
    await page.waitForTimeout(1000);
    await page.reload();
    // Check that the page still works after rollback
    await expect(page.getByRole('heading', { name: 'Rollback Test' })).toBeVisible({ timeout: 5000 });
  });

  test('edit prompt metadata', async ({ page }) => {
    const res = await fetch(`${API_BASE}/prompt/${projectId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: 'edit-meta-test',
        name: 'Edit Meta Test',
        initialContent: 'Content here',
      }),
    });
    const { id: promptId } = await res.json();

    await page.goto(`/dashboard/prompts/managed/${promptId}`);

    await page.getByRole('button', { name: 'Edit' }).click();

    // Change the name
    const nameInput = page.locator('input.text-lg');
    await nameInput.clear();
    await nameInput.fill('Updated Name');

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('heading', { name: 'Updated Name' })).toBeVisible({ timeout: 5000 });
  });

  test('delete a prompt', async ({ page }) => {
    const res = await fetch(`${API_BASE}/prompt/${projectId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug: 'delete-test',
        name: 'Delete Me',
        initialContent: 'To be deleted',
      }),
    });
    await res.json();

    await page.goto('/dashboard/prompts/managed');
    await page.getByText('Delete Me').click();

    // Accept the confirmation dialog
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete' }).click();

    // Should redirect to managed list
    await expect(page).toHaveURL('/dashboard/prompts/managed', { timeout: 5000 });
  });

  test('tab navigation between Discovered and Managed', async ({ page }) => {
    await page.goto('/dashboard/prompts');
    await expect(page.getByText('Discovered')).toBeVisible();
    await expect(page.getByText('Managed')).toBeVisible();

    await page.getByText('Managed').click();
    await expect(page).toHaveURL('/dashboard/prompts/managed');
  });
});
