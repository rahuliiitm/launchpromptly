const TOKEN_KEY = 'pf_token';
const USER_ID_KEY = 'pf_user_id';
const PROJECT_ID_KEY = 'pf_project_id';
const PLAN_KEY = 'pf_plan';

const isBrowser = typeof window !== 'undefined';

export function saveAuth(token: string, userId: string): void {
  if (!isBrowser) return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, userId);
}

export function getToken(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUserId(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem(USER_ID_KEY);
}

export function getProjectId(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem(PROJECT_ID_KEY);
}

export function saveProjectId(id: string): void {
  if (!isBrowser) return;
  localStorage.setItem(PROJECT_ID_KEY, id);
}

export function savePlan(plan: string): void {
  if (!isBrowser) return;
  localStorage.setItem(PLAN_KEY, plan);
}

export function getPlan(): string {
  if (!isBrowser) return 'free';
  return localStorage.getItem(PLAN_KEY) ?? 'free';
}

export function clearAuth(): void {
  if (!isBrowser) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(PROJECT_ID_KEY);
  localStorage.removeItem(PLAN_KEY);
}
