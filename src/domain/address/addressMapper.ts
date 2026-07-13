import { z } from 'zod';
import type { AddressSearchStatus, AddressSearchUiModel, AddressSearchUiState } from './addressModels';

const apiResponseSchema = z.object({
  status: z.number().optional(),
  message: z.string().optional(),
  data: z.unknown().optional(),
});

const candidateSchema = z.object({
  label: z.string().optional().default(''),
  address: z.string().optional().default(''),
  lat: z.coerce.number().optional().default(0),
  lon: z.coerce.number().optional().default(0),
});

const dataSchema = z.object({
  status: z.string().optional().default('EMPTY'),
  provider: z.string().nullable().optional().default(null),
  primaryProvider: z.string().nullable().optional().default(null),
  fallbackUsed: z.boolean().optional().default(false),
  fallbackReason: z.string().nullable().optional().default(null),
  candidates: z.array(candidateSchema).optional().default([]),
});

const STATUS_TEXT: Record<AddressSearchStatus, string> = {
  SUCCESS: '검색 완료',
  AMBIGUOUS: '비슷한 후보가 여러 개 있습니다.',
  EMPTY: '검색 결과가 없습니다.',
  RATE_LIMITED: '검색 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
  PROVIDER_FAILURE: '주소 검색을 잠시 사용할 수 없습니다.',
};

export function mapAddressSearch(payload: unknown): AddressSearchUiModel {
  const root = apiResponseSchema.parse(payload);
  const data = dataSchema.parse(root.data ?? {});
  const status = normalizeStatus(data.status);
  const uiState = toAddressUiState(status, data.fallbackUsed);
  return {
    status,
    uiState,
    statusText: toAddressStatusText(status, uiState),
    provider: data.provider,
    primaryProvider: data.primaryProvider,
    fallbackUsed: data.fallbackUsed,
    fallbackReason: data.fallbackReason,
    candidates: data.candidates,
  };
}

function normalizeStatus(value: string): AddressSearchStatus {
  const normalized = value.toUpperCase();
  if (normalized === 'SUCCESS' || normalized === 'AMBIGUOUS' || normalized === 'EMPTY' || normalized === 'RATE_LIMITED' || normalized === 'PROVIDER_FAILURE') {
    return normalized;
  }
  return 'PROVIDER_FAILURE';
}

function toAddressUiState(status: AddressSearchStatus, fallbackUsed: boolean): AddressSearchUiState {
  if (fallbackUsed) {
    return 'fallback';
  }
  switch (status) {
    case 'SUCCESS':
    case 'AMBIGUOUS':
      return 'success';
    case 'EMPTY':
      return 'empty';
    case 'RATE_LIMITED':
      return 'retry_wait';
    case 'PROVIDER_FAILURE':
      return 'failed_retryable';
  }
}

function toAddressStatusText(status: AddressSearchStatus, uiState: AddressSearchUiState): string {
  if (uiState === 'fallback') {
    return '대체 주소 결과입니다.';
  }
  return STATUS_TEXT[status];
}
