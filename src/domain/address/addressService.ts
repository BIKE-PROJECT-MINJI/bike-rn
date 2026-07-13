import { apiRequest } from '../../shared/api/apiClient';
import { mapAddressSearch } from './addressMapper';
import type { AddressSearchUiModel } from './addressModels';

export async function searchAddress(query: string, accessToken?: string | null): Promise<AddressSearchUiModel> {
  const encodedQuery = encodeURIComponent(query.trim());
  const payload = await apiRequest<unknown>(`/api/v1/addresses/search?query=${encodedQuery}&page=1&size=3`, { accessToken });
  return mapAddressSearch(payload);
}
