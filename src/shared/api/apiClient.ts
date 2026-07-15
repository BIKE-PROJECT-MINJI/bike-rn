import { resolveApiBaseUrl } from '../config/env';
import { z } from 'zod';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string | null;
};

type ApiClientErrorOptions = {
  readonly message: string;
  readonly status: number | null;
  readonly errorCode?: string | null;
  readonly retryAfterSeconds?: number | null;
};

const errorEnvelopeSchema = z.object({
  message: z.string().optional(),
  data: z
    .object({
      errorCode: z.string().nullable().optional(),
      retryAfterSeconds: z.number().int().nonnegative().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const API_REQUEST_TIMEOUT_MS = 15_000;

export class ApiClientError extends Error {
  readonly status: number | null;
  readonly errorCode: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(options: ApiClientErrorOptions) {
    super(options.message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.errorCode = options.errorCode ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), API_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${resolveApiBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: abortController.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  const payload = parseResponsePayload(text, response);
  if (!response.ok) {
    const errorEnvelope = errorEnvelopeSchema.safeParse(payload);
    const retryAfterHeader = parseRetryAfterSeconds(response.headers.get('Retry-After'));
    throw new ApiClientError({
      message: extractMessage(payload),
      status: response.status,
      errorCode: errorEnvelope.success ? errorEnvelope.data.data?.errorCode ?? null : null,
      retryAfterSeconds:
        retryAfterHeader ?? (errorEnvelope.success ? errorEnvelope.data.data?.retryAfterSeconds ?? null : null),
    });
  }
  return payload as T;
}

function parseResponsePayload(text: string, response: Response): unknown {
  if (text.length === 0) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    if (!response.ok) {
      return null;
    }
    throw new ApiClientError({
      message: '서버 응답 형식이 올바르지 않습니다.',
      status: response.status,
      errorCode: 'INVALID_SERVER_RESPONSE',
    });
  }
}

function parseRetryAfterSeconds(value: string | null): number | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
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
