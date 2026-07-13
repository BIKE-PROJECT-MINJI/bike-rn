export type AiRoutePlanRequest = {
  readonly lat: number;
  readonly lon: number;
  readonly destinationLat?: number;
  readonly destinationLon?: number;
  readonly destinationLabel: string;
  readonly rideStyle: string;
  readonly elevationPreference?: string;
  readonly textIntent?: string;
};

export type AiRouteTextPlanRequest = {
  readonly lat: number;
  readonly lon: number;
  readonly text: string;
};

export type AiRoutePlanUiModel = {
  readonly summary: string;
  readonly uiState: AiRoutePlanUiState;
  readonly fallbackUsed: boolean;
  readonly fallbackReason: string | null;
  readonly confidence: string;
  readonly recommendationScore: AiRouteRecommendationScoreUiModel;
  readonly explanation: AiRouteExplanationUiModel;
  readonly evidenceBadges: readonly AiRouteEvidenceBadgeUiModel[];
  readonly routePoints: readonly AiRoutePointUiModel[];
  readonly risks: readonly AiRouteRiskUiModel[];
  readonly actions: readonly string[];
  readonly aiGenerated: boolean;
};

export type AiRoutePlanUiState = 'ready' | 'fallback';

export type AiRouteRecommendationScoreUiModel = {
  readonly total: number;
  readonly scenery: number;
  readonly bikePath: number;
  readonly safety: number;
  readonly condition: number;
  readonly preferenceFit: number;
  readonly distancePenalty: number;
  readonly unknownPenalty: number;
};

export type AiRouteExplanationUiModel = {
  readonly headline: string;
  readonly reason: string;
  readonly caution: string;
  readonly nextAction: string;
};

export type AiRouteEvidenceStatusUi = 'Verified' | 'Warning' | 'Failed' | 'Unknown';
export type AiRouteEvidenceSeverityUi = 'Info' | 'Low' | 'Medium' | 'High' | 'Unknown';

export type AiRouteEvidenceBadgeUiModel = {
  readonly source: string;
  readonly label: string;
  readonly status: AiRouteEvidenceStatusUi;
  readonly severity: AiRouteEvidenceSeverityUi;
  readonly summary: string;
  readonly statusLabel: string;
};

export type AiRoutePointUiModel = {
  readonly label: string;
  readonly lat: number;
  readonly lon: number;
};

export type AiRouteRiskUiModel = {
  readonly label: string;
  readonly severity: string;
  readonly summary: string;
};
