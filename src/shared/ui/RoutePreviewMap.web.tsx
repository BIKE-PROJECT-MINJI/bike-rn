import { StyleSheet, Text, View } from 'react-native';
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

type Bounds = {
  readonly minLatitude: number;
  readonly maxLatitude: number;
  readonly minLongitude: number;
  readonly maxLongitude: number;
};

const STROKE_COLOR_BY_TONE: Record<RoutePreviewTone, string> = {
  course: GajaColors.routeBlue,
  ai: GajaColors.routeOrange,
  recorded: GajaColors.primary,
};

const MAP_WIDTH = 320;
const MAP_HEIGHT = 180;
const MAP_PADDING = 18;

export function RoutePreviewMap({ series }: RoutePreviewMapProps) {
  const allPoints = series.flatMap((route) => route.points);
  const bounds = buildBounds(allPoints);
  if (bounds === null) {
    return <EmptyStateView title="경로 없음" message="표시할 경로 좌표가 없습니다." />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.map} testID="route-preview-map-web">
        {series.map((route) => (
          <View key={route.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
            {buildSegments(route.points, bounds).map((segment) => (
              <View
                key={`${route.id}-${segment.index}`}
                style={[
                  styles.segment,
                  {
                    backgroundColor: STROKE_COLOR_BY_TONE[route.tone],
                    left: segment.left,
                    top: segment.top,
                    transform: [{ rotateZ: `${segment.angle}rad` }],
                    width: segment.length,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        {series.map((route) => (
          <View key={route.id} style={styles.legendItem}>
            <StatusBadge label={route.label} tone={route.tone === 'ai' ? 'warning' : 'success'} />
            <View style={[styles.swatch, { backgroundColor: STROKE_COLOR_BY_TONE[route.tone] }]} />
            <Text style={styles.legendText}>{route.points.length} points</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function buildBounds(points: readonly RoutePreviewPoint[]): Bounds | null {
  const [firstPoint, ...restPoints] = points;
  if (firstPoint === undefined) {
    return null;
  }

  return restPoints.reduce(
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
}

function buildSegments(points: readonly RoutePreviewPoint[], bounds: Bounds) {
  return points.slice(1).map((point, index) => {
    const previousPoint = points[index];
    const start = normalizePoint(previousPoint, bounds);
    const end = normalizePoint(point, bounds);
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    return {
      index,
      angle: Math.atan2(dy, dx),
      left: start.x,
      length: Math.max(6, Math.sqrt(dx * dx + dy * dy)),
      top: start.y,
    };
  });
}

function normalizePoint(point: RoutePreviewPoint, bounds: Bounds) {
  const latitudeSpan = Math.max(0.000001, bounds.maxLatitude - bounds.minLatitude);
  const longitudeSpan = Math.max(0.000001, bounds.maxLongitude - bounds.minLongitude);
  const x = MAP_PADDING + ((point.longitude - bounds.minLongitude) / longitudeSpan) * (MAP_WIDTH - MAP_PADDING * 2);
  const y = MAP_PADDING + ((bounds.maxLatitude - point.latitude) / latitudeSpan) * (MAP_HEIGHT - MAP_PADDING * 2);

  return { x, y };
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  map: {
    backgroundColor: GajaColors.surfaceMuted,
    borderColor: GajaColors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: MAP_HEIGHT,
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
  segment: {
    borderRadius: 999,
    height: 5,
    position: 'absolute',
  },
  swatch: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
});
