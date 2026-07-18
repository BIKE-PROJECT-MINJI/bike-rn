import { apiRequest } from '../../shared/api/apiClient';
import { mapRideParty, mapRidePartyList, mapRidePartyMembers, mapRidePartySocketToken } from './partyMapper';
import type { RidePartyMember, RidePartySocketToken, RidePartyUiModel } from './partyModels';

export type RidePartyBrowseScope = 'ALL' | 'MINE';
export type RidePartyReportReason = 'SPAM_OR_COMMERCIAL' | 'HARASSMENT_OR_THREAT';

export async function fetchRideParties(courseId: number, accessToken?: string | null): Promise<readonly RidePartyUiModel[]> {
  const payload = await apiRequest<unknown>(`/api/v1/parties?courseId=${courseId}`, { accessToken });
  return mapRidePartyList(payload);
}

export async function fetchRidePartiesByScope(
  scope: RidePartyBrowseScope,
  accessToken: string,
): Promise<readonly RidePartyUiModel[]> {
  const payload = await apiRequest<unknown>(`/api/v1/parties?scope=${scope}`, { accessToken });
  return mapRidePartyList(payload);
}

export async function createRideParty(courseId: number, title: string, accessToken?: string | null): Promise<RidePartyUiModel> {
  const payload = await apiRequest<unknown>('/api/v1/parties', {
    method: 'POST',
    accessToken,
    body: { courseId, title, capacity: 6 },
  });
  return mapRideParty(payload);
}

export async function joinRideParty(partyId: number, accessToken?: string | null): Promise<RidePartyUiModel> {
  const payload = await apiRequest<unknown>(`/api/v1/parties/${partyId}/join`, { method: 'POST', accessToken });
  return mapRideParty(payload);
}

export async function leaveRideParty(partyId: number, accessToken?: string | null): Promise<RidePartyUiModel> {
  const payload = await apiRequest<unknown>(`/api/v1/parties/${partyId}/leave`, { method: 'POST', accessToken });
  return mapRideParty(payload);
}

export async function startRideParty(partyId: number, accessToken: string): Promise<RidePartyUiModel> {
  const payload = await apiRequest<unknown>(`/api/v1/parties/${partyId}/start`, { method: 'POST', accessToken });
  return mapRideParty(payload);
}

export async function fetchRidePartyMembers(partyId: number, accessToken: string): Promise<readonly RidePartyMember[]> {
  const payload = await apiRequest<unknown>(`/api/v1/parties/${partyId}/members`, { accessToken });
  return mapRidePartyMembers(payload);
}

export async function issueRidePartySocketToken(partyId: number, accessToken: string): Promise<RidePartySocketToken> {
  const payload = await apiRequest<unknown>(`/api/v1/parties/${partyId}/socket-token`, {
    method: 'POST',
    accessToken,
  });
  return mapRidePartySocketToken(payload);
}

export async function reportRideParty(
  partyId: number,
  reason: RidePartyReportReason,
  accessToken: string,
): Promise<void> {
  await apiRequest<unknown>(`/api/v1/parties/${partyId}/reports`, {
    method: 'POST',
    accessToken,
    body: { reason },
  });
}
