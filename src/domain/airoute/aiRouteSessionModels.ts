import type { AiRoutePlanRequest } from './aiRouteModels';

export type AiRouteSessionRequest = AiRoutePlanRequest;

export type AiRouteSessionUiModel = {
  readonly sessionId: number;
  readonly status: 'READY' | 'PARTIAL' | 'FALLBACK_READY';
  readonly fallbackUsed: boolean;
  readonly provider: string;
  readonly fallbackReason: string | null;
  readonly candidates: readonly AiRouteCandidateUiModel[];
};

export type AiRouteCandidateUiModel = {
  readonly candidateId: number;
  readonly title: string;
  readonly summary: string;
  readonly distanceKm: number;
  readonly estimatedDurationMin: number;
  readonly recommendationScore: number;
  readonly scoreBreakdown: AiRouteScoreBreakdown | null;
  readonly evidenceBadges: readonly AiRouteCandidateEvidenceBadge[];
  readonly totalAscentM: number | null;
  readonly routingProvider: string | null;
  readonly routingFallbackUsed: boolean;
  readonly preferenceSummary: string | null;
  readonly elevationStatus: string | null;
  readonly sceneryEvidenceStatus: string | null;
  readonly routePoints: readonly AiRouteSessionPointUiModel[];
  readonly routePointCount: number;
  readonly promotedCourseId: number | null;
};

export type AiRouteScoreBreakdown = {
  readonly total: number;
  readonly scenery: number;
  readonly bikePath: number;
  readonly safety: number;
  readonly condition: number;
  readonly elevation: number;
  readonly preferenceFit: number;
  readonly distancePenalty: number;
  readonly unknownPenalty: number;
};

export type AiRouteCandidateEvidenceBadge = {
  readonly source: string;
  readonly label: string;
  readonly status: string;
  readonly severity: string;
  readonly summary: string;
};

export type AiRouteSessionPointUiModel = {
  readonly lat: number;
  readonly lon: number;
  readonly label: string;
};

export type AiRoutePromoteResult = {
  readonly courseId: number;
  readonly routePointCount: number;
};
