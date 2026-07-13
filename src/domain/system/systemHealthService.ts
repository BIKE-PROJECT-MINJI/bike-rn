import { z } from 'zod';
import { apiRequest } from '../../shared/api/apiClient';

const healthPayloadSchema = z.object({
  data: z.object({
    status: z.string(),
    service: z.string(),
  }),
});

export type SystemHealth = {
  readonly status: string;
  readonly service: string;
  readonly label: string;
};

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const payload = healthPayloadSchema.parse(await apiRequest<unknown>('/health'));
  return {
    status: payload.data.status,
    service: payload.data.service,
    label: payload.data.status === 'ok' ? '백엔드 연결 정상' : '백엔드 상태 확인 필요',
  };
}
