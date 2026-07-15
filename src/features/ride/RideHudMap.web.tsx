import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { CourseRoutePointUiModel } from '../../domain/course/courseModels';
import type { RidePartyLocation } from '../../domain/party/partyModels';
import type { RideDraft } from '../../domain/ride/rideQueueModel';
import { GajaColors } from '../../shared/design/tokens';

type RideHudMapProps = {
  readonly draft: RideDraft | null;
  readonly nowMs: number;
  readonly plannedRoute?: readonly CourseRoutePointUiModel[];
  readonly partyLocations?: readonly RidePartyLocation[];
};

export function RideHudMap({ draft, plannedRoute = [], partyLocations = [] }: RideHudMapProps) {
  return (
    <View style={styles.map} testID="ride-hud-map-web">
      <Ionicons name="map-outline" size={52} color={GajaColors.routeBlue} />
      <Text style={styles.title}>주행 지도</Text>
      <Text style={styles.meta}>
        {plannedRoute.length > 0 ? `코스 ${plannedRoute.length}점 · ` : ''}
        {draft?.routePoints.length ?? 0}개 위치를 기기에 기록 중
        {partyLocations.length > 0 ? ` · 파티 ${partyLocations.length}명` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EAF2EC',
  },
  title: { color: GajaColors.textPrimary, fontSize: 20, fontWeight: '900' },
  meta: { color: GajaColors.textSecondary, fontSize: 13 },
});
