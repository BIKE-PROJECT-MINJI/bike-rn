import type { RideSyncResult } from './rideSyncEngine';
import { RIDE_ROUTE_QUALITY_UNVERIFIED_ERROR_CODE } from './rideRouteQuality';

export function messageForRideSyncResult(result: RideSyncResult): string {
  switch (result.status) {
    case 'FINALIZING':
      return '서버 저장 완료. 주행 기록을 보정하고 있습니다.';
    case 'READY':
      return '주행 기록 보정이 완료됐습니다.';
    case 'RETRY_WAIT':
      return '로컬 기록은 안전합니다. 잠시 후 같은 ID로 다시 전송합니다.';
    case 'FAILED_USER_ACTION':
      if (result.errorCode === 'RIDE_RETRY_BUDGET_EXHAUSTED') {
        return '자동 재시도를 멈췄습니다. 원본은 기기에 보관되어 있으며 직접 다시 시도할 수 있습니다.';
      }
      if (result.errorCode === RIDE_ROUTE_QUALITY_UNVERIFIED_ERROR_CODE) {
        return '서버 품질 확인이 끝나지 않아 원본을 유지했습니다. 서버 업데이트 후 다시 확인해 주세요.';
      }
      return '로그인 상태를 확인한 뒤 같은 주행을 다시 전송합니다.';
    case 'FAILED_TERMINAL':
      return '서버가 주행 데이터를 처리하지 못했습니다. 로컬 기록은 유지됩니다.';
  }
}
