import { StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { GajaColors } from '../design/tokens';
import { StatusBadge } from './GajaCard';
import { EmptyStateView } from './StateViews';

export type RoutePreviewPoint = {
  readonly latitude: number;
  readonly longitude: number;
};

export type RoutePreviewTone = 'course' | 'ai' | 'recorded';

export type RoutePreviewSeries = {
  readonly id: string;
  readonly label: string;
  readonly tone: RoutePreviewTone;
  readonly points: readonly RoutePreviewPoint[];
};

type RoutePreviewMapProps = {
  readonly series: readonly RoutePreviewSeries[];
};

const STROKE_COLOR_BY_TONE: Record<RoutePreviewTone, string> = {
  course: GajaColors.routeBlue,
  ai: GajaColors.routeOrange,
  recorded: GajaColors.primary,
};

export function RoutePreviewMap({ series }: RoutePreviewMapProps) {
  const allPoints = series.flatMap((route) => route.points);
  const region = buildRegion(allPoints);
  if (region === null) {
    return <EmptyStateView title="경로 없음" message="표시할 경로 좌표가 없습니다." />;
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}>
        {series.map((route) =>
          route.points.length > 1 ? (
            <Polyline
              key={route.id}
              coordinates={route.points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }))}
              strokeColor={STROKE_COLOR_BY_TONE[route.tone]}
              strokeWidth={5}
            />
          ) : null,
        )}
      </MapView>
      <View style={styles.legend}>
        {series.map((route) => (
          <View key={route.id} style={styles.legendItem}>
            <StatusBadge label={route.label} tone={route.tone === 'ai' ? 'warning' : 'success'} />
            <Text style={styles.legendText}>{route.points.length} points</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function buildRegion(points: readonly RoutePreviewPoint[]) {
  const [firstPoint, ...restPoints] = points;
  if (firstPoint === undefined) {
    return null;
  }

  const bounds = restPoints.reduce(
    (current, point) => ({
      minLatitude: Math.min(current.minLatitude, point.latitude),
      maxLatitude: Math.max(current.maxLatitude, point.latitude),
      minLongitude: Math.min(current.minLongitude, point.longitude),
      maxLongitude: Math.max(current.maxLongitude, point.longitude),
    }),
    {
      minLatitude: firstPoint.latitude,
      maxLatitude: firstPoint.latitude,
      minLongitude: firstPoint.longitude,
      maxLongitude: firstPoint.longitude,
    },
  );

  return {
    latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
    longitude: (bounds.minLongitude + bounds.maxLongitude) / 2,
    latitudeDelta: Math.max(0.01, (bounds.maxLatitude - bounds.minLatitude) * 1.4),
    longitudeDelta: Math.max(0.01, (bounds.maxLongitude - bounds.minLongitude) * 1.4),
  };
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  map: {
    borderRadius: 8,
    height: 220,
    overflow: 'hidden',
    width: '100%',
  },
  legend: {
    gap: 8,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  legendText: {
    color: GajaColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
});
