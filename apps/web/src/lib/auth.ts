const TOKEN_KEY = 'pf_token';
const USER_ID_KEY = 'pf_user_id';
const PROJECT_ID_KEY = 'pf_project_id';

export function saveAuth(token: string, userId: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, userId);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getProjectId(): string | null {
  return localStorage.getItem(PROJECT_ID_KEY);
}

export function saveProjectId(id: string): void {
  localStorage.setItem(PROJECT_ID_KEY, id);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(PROJECT_ID_KEY);
}
