import { z } from 'zod';
import type {
  AiRouteEvidenceSeverityUi,
  AiRouteEvidenceStatusUi,
  AiRoutePlanRequest,
  AiRoutePlanUiModel,
} from './aiRouteModels';

const scoreBreakdownSchema = z.object({
  total: z.coerce.number().optional().default(0),
  scenery: z.coerce.number().optional().default(0),
  bikePath: z.coerce.number().optional().default(0),
  safety: z.coerce.number().optional().default(0),
  condition: z.coerce.number().optional().default(0),
  preferenceFit: z.coerce.number().optional().default(0),
  distancePenalty: z.coerce.number().optional().default(0),
  unknownPenalty: z.coerce.number().optional().default(0),
}).partial();

const explanationSchema = z.object({
  headline: z.string().optional().default('조건 기반 경로를 준비했습니다.'),
  reason: z.string().optional().default('경로 조건을 확인해 추천했어요.'),
  caution: z.string().optional().default('일부 조건은 정보 없음 상태라 출발 전 확인이 필요해요.'),
  nextAction: z.string().optional().default('이 경로로 출발'),
}).partial();

const evidenceBadgeSchema = z.object({
  source: z.string().optional().default(''),
  label: z.string().optional().default('근거'),
  status: z.string().optional().default('UNKNOWN'),
  severity: z.string().optional().default('UNKNOWN'),
  summary: z.string().optional().default(''),
});

const routePointSchema = z.object({
  label: z.string().optional().default('경유지'),
  lat: z.coerce.number().optional().default(0),
  lon: z.coerce.number().optional().default(0),
});

const riskSchema = z.object({
  label: z.string().optional().default('확인 필요'),
  severity: z.string().optional().default('unknown'),
  summary: z.string().optional().default(''),
});

const planSchema = z.object({
  summary: z.string().optional().default('조건 기반 경로를 준비했습니다.'),
  confidence: z.string().optional().default('low'),
  recommendationScore: z.coerce.number().optional(),
  scoreBreakdown: scoreBreakdownSchema.optional().default({}),
  explanation: explanationSchema.optional().default({}),
  evidenceBadges: z.array(evidenceBadgeSchema).optional().default([]),
  routePoints: z.array(routePointSchema).optional().default([]),
  risks: z.array(riskSchema).optional().default([]),
  actions: z.array(z.string()).optional().default([]),
  aiGenerated: z.boolean().optional().default(false),
  routingMetadata: z
    .object({
      fallbackUsed: z.boolean().optional().default(false),
      fallbackReason: z.string().nullable().optional().default(null),
    })
    .nullable()
    .optional(),
  aiWorkerMetadata: z
    .object({
      fallbackUsed: z.boolean().optional().default(false),
      fallbackReason: z.string().nullable().optional().default(null),
    })
    .nullable()
    .optional(),
});

const STATUS_LABEL: Record<AiRouteEvidenceStatusUi, string> = {
  Verified: '확인됨',
  Warning: '주의',
  Failed: '확인 실패',
  Unknown: '정보 없음',
};

export function mapAiRoutePlan(payload: unknown): AiRoutePlanUiModel {
  const plan = planSchema.parse(payload);
  const breakdown = plan.scoreBreakdown;
  const explanation = plan.explanation;
  const total = coerceScore(plan.recommendationScore ?? breakdown.total ?? 0);
  const fallbackReason = firstFallbackReason(
    plan.routingMetadata?.fallbackUsed === true ? plan.routingMetadata.fallbackReason : null,
    plan.aiWorkerMetadata?.fallbackUsed === true ? plan.aiWorkerMetadata.fallbackReason : null,
  );
  const fallbackUsed = fallbackReason !== null || plan.routingMetadata?.fallbackUsed === true || plan.aiWorkerMetadata?.fallbackUsed === true;
  return {
    summary: plan.summary,
    uiState: fallbackUsed ? 'fallback' : 'ready',
    fallbackUsed,
    fallbackReason,
    confidence: plan.confidence,
    recommendationScore: {
      total,
      scenery: coerceScore(breakdown.scenery ?? 0),
      bikePath: coerceScore(breakdown.bikePath ?? 0),
      safety: coerceScore(breakdown.safety ?? 0),
      condition: coerceScore(breakdown.condition ?? 0),
      preferenceFit: coerceScore(breakdown.preferenceFit ?? 0),
      distancePenalty: Math.max(0, breakdown.distancePenalty ?? 0),
      unknownPenalty: Math.max(0, breakdown.unknownPenalty ?? 0),
    },
    explanation: {
      headline: nonBlank(explanation.headline, '조건 기반 경로를 준비했습니다.'),
      reason: nonBlank(explanation.reason, '경로 조건을 확인해 추천했어요.'),
      caution: buildCaution(nonBlank(explanation.caution, '일부 조건은 정보 없음 상태라 출발 전 확인이 필요해요.'), fallbackUsed),
      nextAction: nonBlank(explanation.nextAction, '이 경로로 출발'),
    },
    evidenceBadges: plan.evidenceBadges.map((badge) => {
      const status = mapStatus(badge.status);
      return {
        source: badge.source,
        label: badge.label,
        status,
        severity: mapSeverity(badge.severity),
        summary: badge.summary,
        statusLabel: STATUS_LABEL[status],
      };
    }),
    routePoints: plan.routePoints,
    risks: plan.risks,
    actions: plan.actions.filter((action) => action.trim().length > 0),
    aiGenerated: plan.aiGenerated,
  };
}

export function toAiRoutePlanRequestBody(request: AiRoutePlanRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    lat: request.lat,
    lon: request.lon,
    destinationLabel: request.destinationLabel,
    rideStyle: request.rideStyle,
  };
  if (request.destinationLat !== undefined) {
    body.destinationLat = request.destinationLat;
  }
  if (request.destinationLon !== undefined) {
    body.destinationLon = request.destinationLon;
  }
  if (request.elevationPreference !== undefined && request.elevationPreference.trim().length > 0) {
    body.elevationPreference = request.elevationPreference;
  }
  if (request.textIntent !== undefined && request.textIntent.trim().length > 0) {
    body.textIntent = request.textIntent;
  }
  return body;
}

function coerceScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function nonBlank(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function firstFallbackReason(first: string | null | undefined, second: string | null | undefined): string | null {
  if (first !== null && first !== undefined && first.trim().length > 0) {
    return first;
  }
  if (second !== null && second !== undefined && second.trim().length > 0) {
    return second;
  }
  return null;
}

function buildCaution(caution: string, fallbackUsed: boolean): string {
  if (!fallbackUsed) {
    return caution;
  }
  return `대체 결과로 계산됐습니다. ${caution}`;
}

function mapStatus(value: string): AiRouteEvidenceStatusUi {
  switch (value.toUpperCase()) {
    case 'VERIFIED':
      return 'Verified';
    case 'WARNING':
      return 'Warning';
    case 'FAILED':
      return 'Failed';
    default:
      return 'Unknown';
  }
}

function mapSeverity(value: string): AiRouteEvidenceSeverityUi {
  switch (value.toUpperCase()) {
    case 'INFO':
      return 'Info';
    case 'LOW':
      return 'Low';
    case 'MEDIUM':
      return 'Medium';
    case 'HIGH':
      return 'High';
    default:
      return 'Unknown';
  }
}
