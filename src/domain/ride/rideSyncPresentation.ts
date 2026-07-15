import type { RideSyncResult } from './rideSyncEngine';

export function messageForRideSyncResult(result: RideSyncResult): string {
  switch (result.status) {
    case 'FINALIZING':
      return '서버 저장 완료. 주행 기록을 보정하고 있습니다.';
    case 'READY':
      return '주행 기록 보정이 완료됐습니다.';
    case 'RETRY_WAIT':
      return '로컬 기록은 안전합니다. 잠시 후 같은 ID로 다시 전송합니다.';
    case 'FAILED_USER_ACTION':
      return '로그인 상태를 확인한 뒤 다시 전송해 주세요.';
    case 'FAILED_TERMINAL':
      return '서버가 주행 데이터를 처리하지 못했습니다. 로컬 기록은 유지됩니다.';
  }
}
