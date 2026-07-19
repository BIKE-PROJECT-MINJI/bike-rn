import type { RideListItem } from '../../domain/ride/rideApi';
import type { RideDraftStatus } from '../../domain/ride/rideQueueModel';

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';

export type RideStatusPresentation = {
  readonly label: string;
  readonly tone: StatusTone;
};

export function presentRideDraftStatus(status: RideDraftStatus): RideStatusPresentation {
  switch (status) {
    case 'RECORDING':
      return { label: '기록 중', tone: 'success' };
    case 'PAUSED':
      return { label: '일시정지', tone: 'warning' };
    case 'QUEUED':
      return { label: '저장 대기', tone: 'warning' };
    case 'UPLOADING':
      return { label: '서버로 저장 중', tone: 'warning' };
    case 'RETRY_WAIT':
      return { label: '다시 저장 대기', tone: 'warning' };
    case 'FINALIZING':
      return { label: '경로 정리 중', tone: 'warning' };
    case 'FAILED_USER_ACTION':
      return { label: '확인 필요', tone: 'danger' };
    case 'FAILED_TERMINAL':
      return { label: '저장할 수 없음', tone: 'danger' };
    default:
      return assertNever(status);
  }
}

export function presentFinalizationStatus(
  status: RideListItem['finalizationStatus'],
): RideStatusPresentation {
  switch (status) {
    case 'FINALIZING':
      return { label: '경로 정리 중', tone: 'warning' };
    case 'READY':
      return { label: '저장 완료', tone: 'success' };
    case 'FAILED':
      return { label: '처리 실패', tone: 'danger' };
    default:
      return assertNever(status);
  }
}

function assertNever(status: never): never {
  throw new UnsupportedRideStatusError(status);
}

class UnsupportedRideStatusError extends Error {
  constructor(status: never) {
    super(`지원하지 않는 주행 상태입니다: ${String(status)}`);
    this.name = 'UnsupportedRideStatusError';
  }
}
