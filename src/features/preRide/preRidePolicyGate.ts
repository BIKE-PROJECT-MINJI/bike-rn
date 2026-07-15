import * as Location from 'expo-location';
import { evaluateRidePolicy } from '../../domain/ride/ridePolicyService';

export async function evaluatePreStart(courseId: number) {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new PreStartLocationError('출발 위치를 확인하려면 정확한 위치 권한이 필요합니다.');
  }
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const accuracyM = location.coords.accuracy;
  if (accuracyM === null || accuracyM < 0) {
    throw new PreStartLocationError('GPS 정확도를 확인하지 못했습니다. 잠시 뒤 다시 확인해 주세요.');
  }
  return evaluateRidePolicy(courseId, {
    phase: 'PRE_START',
    location: {
      lat: location.coords.latitude,
      lon: location.coords.longitude,
      accuracyM,
      capturedAt: new Date(location.timestamp).toISOString(),
    },
    trace: [],
  });
}

class PreStartLocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreStartLocationError';
  }
}
