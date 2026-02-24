const API_BASE = process.env.API_URL ?? 'http://localhost:3001';

export interface TestAuth {
  token: string;
  userId: string;
  projectId: string;
  apiKey: string;
}

/**
 * Registers a test user, retrieves their project, and creates an API key.
 * Returns all credentials needed for E2E testing.
 */
export async function createTestAuth(): Promise<TestAuth> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;

  const password = 'testpassword123';

  // Register user — auto-provisions org + project
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!regRes.ok) throw new Error(`Registration failed: ${regRes.status}`);
  const { accessToken: token, userId } = await regRes.json();

  // Get project (auto-provisioned on registration)
  const projRes = await fetch(`${API_BASE}/project`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!projRes.ok) throw new Error(`Get projects failed: ${projRes.status}`);
  const projects = await projRes.json();
  const projectId = projects[0]?.id;
  if (!projectId) throw new Error('No project auto-provisioned');

  // Create API key
  const keyRes = await fetch(`${API_BASE}/project/${projectId}/api-keys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'e2e-test-key' }),
  });
  if (!keyRes.ok) throw new Error(`Create API key failed: ${keyRes.status}`);
  const { rawKey: apiKey } = await keyRes.json();

  return { token, userId, projectId, apiKey };
}
