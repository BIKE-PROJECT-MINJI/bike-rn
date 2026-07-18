import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { CourseRoutePointUiModel } from '../../domain/course/courseModels';
import type { RidePartyLocation } from '../../domain/party/partyModels';
import type { RideDraft } from '../../domain/ride/rideQueueModel';
import { GajaColors } from '../../shared/design/tokens';
import { displayRideHeading, latestRidePoint } from './rideHudModel';

type RideHudMapProps = {
  readonly draft: RideDraft | null;
  readonly nowMs: number;
  readonly plannedRoute?: readonly CourseRoutePointUiModel[];
  readonly partyLocations?: readonly RidePartyLocation[];
};

const SEOUL_REGION = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.025,
  longitudeDelta: 0.025,
};

export function RideHudMap({ draft, nowMs, plannedRoute = [], partyLocations = [] }: RideHudMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const latestPoint = latestRidePoint(draft);
  const heading = displayRideHeading(draft, nowMs);
  const coordinates = draft?.routePoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude })) ?? [];
  const plannedCoordinates = plannedRoute.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));

  useEffect(() => {
    if (latestPoint === null) {
      return;
    }
    mapRef.current?.animateCamera(
      {
        center: { latitude: latestPoint.latitude, longitude: latestPoint.longitude },
        heading: 0,
        pitch: 0,
        zoom: 16,
      },
      { duration: 500 },
    );
  }, [latestPoint?.capturedAtIso, latestPoint?.latitude, latestPoint?.longitude]);

  return (
    <MapView
      ref={mapRef}
      initialRegion={latestPoint === null ? SEOUL_REGION : { ...SEOUL_REGION, latitude: latestPoint.latitude, longitude: latestPoint.longitude }}
      loadingEnabled
      pitchEnabled={false}
      rotateEnabled={false}
      showsCompass
      showsUserLocation={false}
      style={StyleSheet.absoluteFill}
      toolbarEnabled={false}
    >
      {plannedCoordinates.length > 1 ? <Polyline coordinates={plannedCoordinates} strokeColor={GajaColors.routeBlue} strokeWidth={7} /> : null}
      {coordinates.length > 1 ? <Polyline coordinates={coordinates} strokeColor="#1B9C68" strokeWidth={5} /> : null}
      {latestPoint ? (
        <Marker coordinate={{ latitude: latestPoint.latitude, longitude: latestPoint.longitude }} anchor={{ x: 0.5, y: 0.5 }} flat>
          <View style={[styles.marker, heading === null ? styles.markerUncertain : null]}>
            <Ionicons name="navigate" size={24} color="#FFFFFF" style={{ transform: [{ rotate: `${heading ?? 0}deg` }] }} />
          </View>
        </Marker>
      ) : null}
      {partyLocations.map((location) => (
        <Marker
          key={location.userId}
          coordinate={{ latitude: location.latitude, longitude: location.longitude }}
          title={`파티 멤버 ${location.userId}`}
        >
          <View style={styles.partyMarker}><Ionicons name="people" size={17} color="#FFFFFF" /></View>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GajaColors.routeBlue,
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  markerUncertain: { opacity: 0.58 },
  partyMarker: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6A4BBC', borderColor: '#FFFFFF', borderWidth: 2,
  },
});
