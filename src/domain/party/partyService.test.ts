import { fetchRidePartiesByScope, reportRideParty } from './partyService';

describe('party service browse contract', () => {
  afterEach(() => jest.restoreAllMocks());

  it('loads the current user party scope without a course fan-out', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(responseOf({ data: { items: [] } }));

    await fetchRidePartiesByScope('MINE', 'token');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.gajabike.shop/api/v1/parties?scope=MINE',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sends an explicit report reason', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(responseOf({
      data: { partyId: 20, reportCount: 1, status: 'OPEN' },
    }));

    await reportRideParty(20, 'SPAM_OR_COMMERCIAL', 'token');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.gajabike.shop/api/v1/parties/20/reports',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ reason: 'SPAM_OR_COMMERCIAL' }) }),
    );
  });
});

function responseOf(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
