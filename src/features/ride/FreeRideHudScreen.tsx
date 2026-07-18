import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadAuthSession } from '../../domain/auth/authSessionStore';
import { formatHudDistance, formatHudDuration } from '../../domain/ride/rideTracking';
import { GajaColors } from '../../shared/design/tokens';
import { GajaFullScreen } from '../../shared/ui/GajaScreen';
import { PartyLocationSharingPanel } from '../party/PartyLocationSharingPanel';
import { usePartyLocationSharing } from '../party/usePartyLocationSharing';
import { RideEndConfirmation } from './RideEndConfirmation';
import { RideHudDock } from './RideHudDock';
import { RideHudMap } from './RideHudMap';
import { RideHudTopBar } from './RideHudTopBar';
import { RidePolicyBanner } from './RidePolicyBanner';
import { rideSpeedKmh } from './rideHudModel';
import { displayRideHeading } from './rideHudModel';
import { useCourseRidePolicy } from './useCourseRidePolicy';
import { useRideSession } from './useRideSession';
import { useRideWeather } from './useRideWeather';

export function FreeRideHudScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ courseId?: string; courseTitle?: string; partyId?: string }>();
  const parsedCourseId = Number(params.courseId ?? 0);
  const parsedPartyId = Number(params.partyId ?? 0);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const [partySharingEnabled, setPartySharingEnabled] = useState(false);
  const ride = useRideSession();
  const activeDraft = ride.pendingDrafts.find((draft) => draft.status === 'RECORDING' || draft.status === 'PAUSED') ?? null;
  const courseId = Number.isInteger(parsedCourseId) && parsedCourseId > 0 ? parsedCourseId : activeDraft?.courseId ?? null;
  const partyId = Number.isInteger(parsedPartyId) && parsedPartyId > 0 ? parsedPartyId : activeDraft?.partyId ?? null;
  const courseTitle = params.courseTitle ?? activeDraft?.courseTitle ?? '코스 따라가기';
  const authSessionQuery = useQuery({ queryKey: ['auth-session', 'party-hud'], queryFn: loadAuthSession });
  const partySharing = usePartyLocationSharing(
    partyId,
    authSessionQuery.data?.accessToken ?? null,
    partySharingEnabled && activeDraft !== null,
  );
  const weatherQuery = useRideWeather(activeDraft);
  const paused = activeDraft?.status === 'PAUSED';
  const elapsedMs = activeDraft === null ? 0 : ride.elapsedMs(activeDraft);
  const courseRide = useCourseRidePolicy(courseId, activeDraft, ride.nowMs);

  const start = () => {
    if (!ride.authenticated) {
      router.push('/(tabs)/profile');
      return;
    }
    void ride.start({
      mode: partyId !== null ? 'PARTY' : courseId !== null ? 'COURSE' : 'FREE',
      courseId,
      courseTitle: courseId === null ? null : courseTitle,
      partyId,
    });
  };

  return (
    <GajaFullScreen>
      <StatusBar style="dark" />
      <RideHudMap
        draft={activeDraft}
        nowMs={ride.nowMs}
        plannedRoute={courseRide.routePoints}
        partyLocations={[...partySharing.locations.values()]}
      />
      <RideHudTopBar
        draft={activeDraft}
        topInset={insets.top}
        title={courseId === null ? '자유주행' : courseTitle}
        weather={weatherQuery.data ?? null}
        weatherLoading={weatherQuery.isPending}
        weatherError={weatherQuery.error}
        headingDeg={displayRideHeading(activeDraft, ride.nowMs)}
      />
      <View pointerEvents="box-none" style={[styles.overlayStack, { top: insets.top + 132 }]}>
        {courseId === null ? (
          <RideStatusBanner message={ride.errorMessage ?? ride.message} error={ride.errorMessage !== null} />
        ) : (
          <RidePolicyBanner
            policy={courseRide.policy}
            loading={courseRide.routeLoading || courseRide.policyLoading}
            error={courseRide.routeError ?? courseRide.policyError}
            stale={courseRide.policyStale}
            topInset={0}
            embedded
          />
        )}
        {partyId !== null && activeDraft !== null ? (
          <PartyLocationSharingPanel
            enabled={partySharingEnabled}
            status={partySharing.status}
            visibleMemberCount={partySharing.locations.size}
            errorMessage={partySharing.errorMessage}
            topInset={0}
            embedded
            onEnabledChange={setPartySharingEnabled}
          />
        ) : null}
      </View>
      <RideHudDock
        active={activeDraft !== null}
        bottomInset={insets.bottom}
        busy={ride.busy}
        distance={formatHudDistance(activeDraft?.distanceMeters ?? 0)}
        duration={formatHudDuration(elapsedMs)}
        onEnd={() => setShowEndConfirmation(true)}
        onStart={start}
        onTogglePause={() => void ride.togglePause()}
        paused={paused}
        speedKmh={rideSpeedKmh(activeDraft)}
        startLabel={ride.authenticated ? (courseId === null ? '자유주행 시작' : '코스 주행 시작') : '로그인 후 시작'}
      />
      <RideEndConfirmation
        busy={ride.busy}
        onCancel={() => setShowEndConfirmation(false)}
        onConfirm={() => {
          void ride.finish().finally(() => setShowEndConfirmation(false));
        }}
        visible={showEndConfirmation}
      />
    </GajaFullScreen>
  );
}

function RideStatusBanner({ message, error }: { readonly message: string; readonly error: boolean }) {
  return (
    <View pointerEvents="none" style={[styles.banner, error ? styles.errorBanner : null]}>
      <Text numberOfLines={2} style={[styles.bannerText, error ? styles.errorText : null]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayStack: { position: 'absolute', left: 16, right: 16, gap: 8 },
  banner: {
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: GajaColors.border,
    borderWidth: 1,
  },
  errorBanner: { backgroundColor: '#FFF4F2', borderColor: '#F5B7AE' },
  bannerText: { color: GajaColors.textSecondary, fontSize: 12, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  errorText: { color: GajaColors.danger },
});
