export type AddressSearchStatus = 'SUCCESS' | 'AMBIGUOUS' | 'EMPTY' | 'RATE_LIMITED' | 'PROVIDER_FAILURE';
export type AddressSearchUiState = 'success' | 'fallback' | 'empty' | 'retry_wait' | 'failed_retryable';

export type AddressCandidateUiModel = {
  readonly label: string;
  readonly address: string;
  readonly lat: number;
  readonly lon: number;
};

export type AddressSearchUiModel = {
  readonly status: AddressSearchStatus;
  readonly uiState: AddressSearchUiState;
  readonly statusText: string;
  readonly provider: string | null;
  readonly primaryProvider: string | null;
  readonly fallbackUsed: boolean;
  readonly fallbackReason: string | null;
  readonly candidates: readonly AddressCandidateUiModel[];
};
