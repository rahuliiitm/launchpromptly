const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

interface ApiError {
  message?: string | string[];
  hint?: string;
  setup?: string;
  statusCode?: number;
}

function formatErrorMessage(error: ApiError, status: number): string {
  const messages = Array.isArray(error.message)
    ? error.message.join('. ')
    : error.message;

  let msg = messages ?? `Request failed (HTTP ${status})`;

  if (error.hint) {
    msg += ` — ${error.hint}`;
  }
  if (error.setup) {
    msg += ` — Setup: ${error.setup}`;
  }

  // Add user-friendly context for common status codes
  if (status === 401 && !error.hint) {
    msg += '. Please log in again.';
  } else if (status === 0 || msg.includes('fetch')) {
    msg = 'Cannot connect to the API server. Make sure the API is running (npm run dev in apps/api).';
  }

  return msg;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const { headers: customHeaders, ...restOptions } = options ?? {};

  let response: Response;
  try {
    response = await fetch(url, {
      ...restOptions,
      headers: {
        'Content-Type': 'application/json',
        ...(customHeaders as Record<string, string>),
      },
    });
  } catch (err) {
    throw new Error(
      `Cannot connect to the API at ${API_BASE}. ` +
      'Make sure the API server is running. ' +
      'Check NEXT_PUBLIC_API_URL in your .env file if the API is on a different port.',
    );
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' } as ApiError));
    throw new Error(formatErrorMessage(error as ApiError, response.status));
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
