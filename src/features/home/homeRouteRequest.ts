import type { AiRoutePlanRequest } from '../../domain/airoute/aiRouteModels';

export type HomeRouteDestination = {
  readonly label: string;
  readonly lat?: number;
  readonly lon?: number;
};

export type HomeRouteStart = {
  readonly lat: number;
  readonly lon: number;
};

export function buildHomeAiRouteRequest(
  start: HomeRouteStart,
  destination: HomeRouteDestination,
  routePrompt = '',
): AiRoutePlanRequest {
  const destinationCoordinates =
    destination.lat !== undefined && destination.lon !== undefined
      ? {
          destinationLat: destination.lat,
          destinationLon: destination.lon,
        }
      : {};
  const routePreference = resolveRoutePreference(routePrompt);
  const normalizedPrompt = routePrompt.trim();
  return {
    lat: start.lat,
    lon: start.lon,
    destinationLabel: destination.label,
    rideStyle: routePreference.rideStyle,
    elevationPreference: routePreference.elevationPreference,
    ...(normalizedPrompt.length > 0 ? { textIntent: normalizedPrompt } : {}),
    ...destinationCoordinates,
  };
}

export function destinationSelectionError(
  destinationQuery: string,
  destination: HomeRouteDestination | null,
): string | null {
  if (destination === null && destinationQuery.trim().length === 0) {
    return '현재 베타에서는 목적지를 먼저 선택해 주세요. 출발점으로 돌아오는 순환 코스는 준비 중입니다.';
  }
  if (destinationQuery.trim().length > 0 && destination === null) {
    return '검색 결과에서 목적지를 선택하거나 입력을 지워 주세요.';
  }
  return null;
}

function resolveRoutePreference(routePrompt: string): { readonly rideStyle: string; readonly elevationPreference: string } {
  const prompt = routePrompt.trim();
  if (containsAny(prompt, ['평지', '완만', '쉬운', '편한'])) {
    return { rideStyle: containsAny(prompt, ['한강', '풍경', '경치']) ? 'SCENERY_FIRST' : 'BIKE_PATH_FIRST', elevationPreference: 'FLAT_FIRST' };
  }
  if (containsAny(prompt, ['자전거도로', '자전거 도로', '안전'])) {
    return { rideStyle: 'BIKE_PATH_FIRST', elevationPreference: 'BALANCED_ELEVATION' };
  }
  if (containsAny(prompt, ['짧게', '최단', '빠른'])) {
    return { rideStyle: 'SHORTEST', elevationPreference: 'BALANCED_ELEVATION' };
  }
  if (containsAny(prompt, ['한강', '풍경', '경치', '강변'])) {
    return { rideStyle: 'SCENERY_FIRST', elevationPreference: 'BALANCED_ELEVATION' };
  }
  return { rideStyle: 'SCENIC', elevationPreference: 'BALANCED_ELEVATION' };
}

function containsAny(text: string, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => text.includes(candidate));
}
