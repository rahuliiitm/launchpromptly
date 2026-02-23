import type { TestAuth } from './auth';

const API_BASE = process.env.API_URL ?? 'http://localhost:3001';

export interface SeededPrompt {
  id: string;
  slug: string;
  name: string;
  versionId?: string;
}

/**
 * Creates a managed prompt with an initial version for testing.
 */
export async function seedPrompt(
  auth: TestAuth,
  slug: string,
  name: string,
  content: string,
): Promise<SeededPrompt> {
  const res = await fetch(`${API_BASE}/prompt/${auth.projectId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      slug,
      name,
      initialContent: content,
    }),
  });
  if (!res.ok) throw new Error(`Seed prompt failed: ${res.status}`);
  const data = await res.json();
  return {
    id: data.id,
    slug,
    name,
    versionId: data.versions?.[0]?.id,
  };
}

/**
 * Creates a new version for a prompt.
 */
export async function seedVersion(
  auth: TestAuth,
  promptId: string,
  content: string,
): Promise<{ id: string; version: number }> {
  const res = await fetch(`${API_BASE}/prompt/${auth.projectId}/${promptId}/versions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Seed version failed: ${res.status}`);
  return res.json();
}

/**
 * Deploys a version (sets it to active).
 */
export async function deployVersion(
  auth: TestAuth,
  promptId: string,
  versionId: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/prompt/${auth.projectId}/${promptId}/versions/${versionId}/deploy`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
    },
  );
  if (!res.ok) throw new Error(`Deploy version failed: ${res.status}`);
}
