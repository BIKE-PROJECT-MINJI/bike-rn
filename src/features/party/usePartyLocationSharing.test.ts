import { act, renderHook } from '@testing-library/react-native';

const mockIssueRidePartySocketToken = jest.fn();

jest.mock('../../domain/party/partyService', () => ({
  issueRidePartySocketToken: mockIssueRidePartySocketToken,
}));

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

const { usePartyLocationSharing } = require('./usePartyLocationSharing') as typeof import('./usePartyLocationSharing');

const originalWebSocket = globalThis.WebSocket;

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly instances: MockWebSocket[] = [];

  readonly url: string;
  readonly send = jest.fn();
  readonly close = jest.fn();
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { readonly data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { readonly code: number; readonly reason: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  emitClose(code: number, reason: string): void {
    this.onclose?.({ code, reason });
  }
}

describe('usePartyLocationSharing socket close policy', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: MockWebSocket });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: originalWebSocket });
  });

  beforeEach(() => {
    jest.useFakeTimers();
    MockWebSocket.instances.length = 0;
    mockIssueRidePartySocketToken.mockReset().mockResolvedValue({
      socketToken: 'socket-token',
      expiresAt: '2026-07-16T06:00:00Z',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not issue another token or reconnect after a 1008 member revocation', async () => {
    const { result, unmount } = renderHook(() => usePartyLocationSharing(20, 'access-token', true));
    await flushPromises();

    act(() => MockWebSocket.instances[0].emitClose(1008, 'member-left'));
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(result.current.status).toBe('ERROR');
    expect(result.current.errorMessage).toBe('파티 참여가 종료되어 위치 공유를 멈췄습니다.');
    expect(mockIssueRidePartySocketToken).toHaveBeenCalledTimes(1);
    expect(MockWebSocket.instances).toHaveLength(1);
    act(unmount);
  });

  it('issues a new token and reconnects with backoff after a 1006 network close', async () => {
    const { result, unmount } = renderHook(() => usePartyLocationSharing(20, 'access-token', true));
    await flushPromises();

    act(() => MockWebSocket.instances[0].emitClose(1006, ''));
    expect(result.current.status).toBe('RECONNECTING');
    await act(async () => {
      jest.advanceTimersByTime(1_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockIssueRidePartySocketToken).toHaveBeenCalledTimes(2);
    expect(MockWebSocket.instances).toHaveLength(2);
    act(unmount);
  });
});

async function flushPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
