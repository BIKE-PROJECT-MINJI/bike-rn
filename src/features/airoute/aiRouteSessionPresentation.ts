import { ApiClientError } from '../../shared/api/apiClient';

export type AiRouteSessionErrorPresentation = {
  readonly title: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly retryAfterSeconds: number | null;
};

export function presentAiRouteSessionError(error: unknown): AiRouteSessionErrorPresentation {
  if (error instanceof ApiClientError) {
    switch (error.status) {
      case 422:
        return { title: '조건에 맞는 코스가 없습니다', message: '풍경이나 경사 조건을 조금 완화해 다시 만들어 주세요.', retryable: false, retryAfterSeconds: null };
      case 429:
        {
          const retryAfterSeconds = error.retryAfterSeconds ?? 30;
          return { title: '잠시 후 다시 시도해 주세요', message: `코스 생성 요청이 몰렸습니다. ${retryAfterSeconds}초 뒤 다시 시도할 수 있습니다.`, retryable: true, retryAfterSeconds };
        }
      case 503:
        return { title: '경로 서비스를 연결하지 못했습니다', message: '작성한 조건은 유지됩니다. 잠시 뒤 같은 조건으로 다시 시도해 주세요.', retryable: true, retryAfterSeconds: null };
      default:
        return { title: '코스를 만들지 못했습니다', message: error.message, retryable: false, retryAfterSeconds: null };
    }
  }
  return { title: '코스를 만들지 못했습니다', message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.', retryable: false, retryAfterSeconds: null };
}
