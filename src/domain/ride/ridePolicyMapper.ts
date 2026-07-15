import { z } from 'zod';
import type { RidePolicyEvaluationUiModel } from './ridePolicyModels';

const apiResponseSchema = z.object({
  data: z.unknown().optional(),
});

const nullableNumberSchema = z.coerce.number().nullable().optional();

const policyDataSchema = z.object({
  phase: z.string().optional().default('UNKNOWN'),
  startGate: z
    .object({
      status: z.enum(['ELIGIBLE', 'BLOCKED', 'UNDETERMINED']),
    })
    .optional()
    .default({ status: 'UNDETERMINED' }),
  offRoute: z
    .object({
      status: z.enum(['ON_ROUTE', 'CANDIDATE', 'WARNING', 'UNDETERMINED']),
      distanceM: nullableNumberSchema,
    })
    .optional()
    .default({ status: 'UNDETERMINED' }),
  completion: z
    .object({
      status: z.enum(['IN_PROGRESS', 'ELIGIBLE', 'UNDETERMINED']),
      coveragePercent: nullableNumberSchema,
    })
    .optional()
    .default({ status: 'UNDETERMINED' }),
  progress: z
    .object({
      distanceAlongRouteM: nullableNumberSchema,
      remainingDistanceM: nullableNumberSchema,
      progressPercent: nullableNumberSchema,
    })
    .nullable()
    .optional(),
  overallState: z.string().optional().default('UNKNOWN'),
  defaultMessage: z.string().optional().default('코스 상태를 확인하는 중입니다.'),
});

export function mapRidePolicyEvaluation(payload: unknown): RidePolicyEvaluationUiModel {
  const root = apiResponseSchema.parse(payload);
  const data = policyDataSchema.parse(root.data ?? {});
  return {
    phase: data.phase,
    overallState: data.overallState,
    defaultMessage: data.defaultMessage,
    startGateStatus: data.startGate.status,
    offRouteStatus: data.offRoute.status,
    offRouteDistanceM: data.offRoute.distanceM ?? null,
    completionStatus: data.completion.status,
    completionCoveragePercent: data.completion.coveragePercent ?? null,
    progressPercent: data.progress?.progressPercent ?? null,
    remainingDistanceM: data.progress?.remainingDistanceM ?? null,
    distanceAlongRouteM: data.progress?.distanceAlongRouteM ?? null,
  };
}
