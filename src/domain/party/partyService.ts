import { apiRequest } from '../../shared/api/apiClient';
import { mapRideParty, mapRidePartyList } from './partyMapper';
import type { RidePartyUiModel } from './partyModels';

export async function fetchRideParties(courseId: number, accessToken?: string | null): Promise<readonly RidePartyUiModel[]> {
  const payload = await apiRequest<unknown>(`/api/v1/parties?courseId=${courseId}`, { accessToken });
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
