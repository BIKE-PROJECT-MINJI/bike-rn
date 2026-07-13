import { resolveApiBaseUrl } from '../config/env';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string | null;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(extractMessage(payload));
  }
  return payload as T;
}

function extractMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }
  return '요청을 처리하지 못했습니다.';
}
