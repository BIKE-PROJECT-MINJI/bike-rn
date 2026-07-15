import * as Location from 'expo-location';
import { evaluateRidePolicy } from '../../domain/ride/ridePolicyService';
import { evaluatePreStart } from './preRidePolicyGate';

jest.mock('expo-location', () => ({
  Accuracy: { High: 6 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('../../domain/ride/ridePolicyService', () => ({ evaluateRidePolicy: jest.fn() }));

describe('pre-ride start gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks server evaluation when foreground location permission is denied', async () => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);

    await expect(evaluatePreStart(7)).rejects.toThrow('정확한 위치 권한');
    expect(evaluateRidePolicy).not.toHaveBeenCalled();
  });

  it('sends the measured location to the PRE_START server policy', async () => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ status: 'granted' } as never);
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
      coords: { latitude: 37.5, longitude: 127, accuracy: 7 },
      timestamp: Date.parse('2026-07-15T00:00:00.000Z'),
    } as never);
    jest.mocked(evaluateRidePolicy).mockResolvedValue({
      phase: 'PRE_START',
      overallState: 'PRE_START_ELIGIBLE',
      defaultMessage: '출발할 수 있습니다.',
      startGateStatus: 'ELIGIBLE',
      offRouteStatus: 'UNDETERMINED',
      offRouteDistanceM: null,
      completionStatus: 'UNDETERMINED',
      completionCoveragePercent: null,
      progressPercent: null,
      remainingDistanceM: null,
      distanceAlongRouteM: null,
    });

    await evaluatePreStart(7);

    expect(evaluateRidePolicy).toHaveBeenCalledWith(7, {
      phase: 'PRE_START',
      location: {
        lat: 37.5,
        lon: 127,
        accuracyM: 7,
        capturedAt: '2026-07-15T00:00:00.000Z',
      },
      trace: [],
    });
  });
});
