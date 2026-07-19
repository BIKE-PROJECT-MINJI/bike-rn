import type { RideDraftStatus } from '../../domain/ride/rideQueueModel';
import { presentFinalizationStatus, presentRideDraftStatus } from './rideStatusPresentation';

describe('ride status presentation', () => {
  it.each<readonly [RideDraftStatus, string]>([
    ['RECORDING', '기록 중'],
    ['PAUSED', '일시정지'],
    ['QUEUED', '저장 대기'],
    ['UPLOADING', '서버로 저장 중'],
    ['RETRY_WAIT', '다시 저장 대기'],
    ['FINALIZING', '경로 정리 중'],
    ['FAILED_USER_ACTION', '확인 필요'],
    ['FAILED_TERMINAL', '저장할 수 없음'],
  ])('내부 주행 상태 %s를 사용자 문구로 표시한다', (status, expectedLabel) => {
    // Given / When
    const result = presentRideDraftStatus(status);

    // Then
    expect(result.label).toBe(expectedLabel);
    expect(result.label).not.toBe(status);
  });

  it.each([
    ['FINALIZING', '경로 정리 중'],
    ['READY', '저장 완료'],
    ['FAILED', '처리 실패'],
  ] as const)('서버 후처리 상태 %s를 사용자 문구로 표시한다', (status, expectedLabel) => {
    // Given / When
    const result = presentFinalizationStatus(status);

    // Then
    expect(result.label).toBe(expectedLabel);
    expect(result.label).not.toBe(status);
  });
});
