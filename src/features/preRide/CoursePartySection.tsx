import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import type { RidePartyUiModel } from '../../domain/party/partyModels';
import {
  createRideParty,
  fetchRideParties,
  joinRideParty,
  leaveRideParty,
  startRideParty,
} from '../../domain/party/partyService';
import { GajaColors } from '../../shared/design/tokens';
import { GajaButton } from '../../shared/ui/GajaButton';
import { GajaCard, StatusBadge } from '../../shared/ui/GajaCard';
import { LoadingStateView } from '../../shared/ui/StateViews';

type CoursePartySectionProps = {
  readonly courseId: number;
  readonly courseTitle: string | null;
  readonly accessToken: string | null;
  readonly userId: number | null;
  readonly onConfirmRide: (partyId: number) => void;
};

export function CoursePartySection({
  courseId,
  courseTitle,
  accessToken,
  userId,
  onConfirmRide,
}: CoursePartySectionProps) {
  const queryClient = useQueryClient();
  const partiesQuery = useQuery({
    queryKey: ['ride-parties', courseId, userId],
    queryFn: () => fetchRideParties(courseId, accessToken),
    enabled: courseId > 0 && accessToken !== null,
    refetchInterval: 3_000,
  });
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['ride-parties', courseId] });
  };
  const createMutation = useMutation({
    mutationFn: () => createRideParty(courseId, `${courseTitle ?? '코스'} 같이 타기`, accessToken),
    onSuccess: invalidate,
  });
  const joinMutation = useMutation({ mutationFn: (partyId: number) => joinRideParty(partyId, accessToken), onSuccess: invalidate });
  const leaveMutation = useMutation({ mutationFn: (partyId: number) => leaveRideParty(partyId, accessToken), onSuccess: invalidate });
  const startMutation = useMutation({
    mutationFn: (partyId: number) => {
      if (accessToken === null) {
        throw new PartyAuthenticationError();
      }
      return startRideParty(partyId, accessToken);
    },
    onSuccess: invalidate,
  });
  const error = createMutation.error ?? joinMutation.error ?? leaveMutation.error ?? startMutation.error ?? partiesQuery.error;
  const busy = createMutation.isPending || joinMutation.isPending || leaveMutation.isPending || startMutation.isPending;

  return (
    <GajaCard title="파티" subtitle="호스트가 파티 상태를 시작해도 각 멤버가 내 주행을 확인해야 기록됩니다.">
      {accessToken === null ? <StatusBadge label="로그인 필요" tone="warning" /> : null}
      {accessToken !== null ? (
        <>
          <GajaButton
            label={createMutation.isPending ? '파티 생성 중' : '파티 만들기'}
            variant="secondary"
            disabled={courseTitle === null || busy}
            onPress={() => createMutation.mutate()}
          />
          {partiesQuery.isPending ? <LoadingStateView message="파티를 확인하는 중입니다." /> : null}
          {partiesQuery.data?.length === 0 ? <Text style={styles.body}>아직 파티가 없습니다.</Text> : null}
          {partiesQuery.data?.map((party) => (
            <PartyRow
              key={party.id}
              party={party}
              busy={busy}
              onJoin={() => joinMutation.mutate(party.id)}
              onLeave={() => leaveMutation.mutate(party.id)}
              onStart={() => startMutation.mutate(party.id)}
              onConfirmRide={() => onConfirmRide(party.id)}
            />
          ))}
        </>
      ) : (
        <Text style={styles.body}>내 정보 탭에서 로그인하면 파티를 만들거나 참여할 수 있습니다.</Text>
      )}
      {error ? <Text style={styles.error}>{error.message}</Text> : null}
    </GajaCard>
  );
}

function PartyRow({
  party,
  busy,
  onJoin,
  onLeave,
  onStart,
  onConfirmRide,
}: {
  readonly party: RidePartyUiModel;
  readonly busy: boolean;
  readonly onJoin: () => void;
  readonly onLeave: () => void;
  readonly onStart: () => void;
  readonly onConfirmRide: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title}>{party.title}</Text>
        <Text style={styles.body}>{party.joinedCount}/{party.capacity}명</Text>
      </View>
      <StatusBadge label={party.status === 'RIDING' ? '주행 중' : '모집 중'} tone={party.status === 'RIDING' ? 'warning' : 'success'} />
      {party.currentUserHost ? <StatusBadge label="호스트" tone="success" /> : null}
      {party.status === 'OPEN' && !party.currentUserMember ? (
        <GajaButton label="참여" variant="secondary" disabled={busy || party.joinedCount >= party.capacity} onPress={onJoin} />
      ) : null}
      {party.status === 'OPEN' && party.currentUserHost ? (
        <GajaButton label="파티 출발 알림" disabled={busy} onPress={onStart} />
      ) : null}
      {party.status === 'OPEN' && party.currentUserMember && !party.currentUserHost ? (
        <GajaButton label="나가기" variant="secondary" disabled={busy} onPress={onLeave} />
      ) : null}
      {party.status === 'RIDING' && party.currentUserMember ? (
        <GajaButton label="내 주행 시작" disabled={busy} onPress={onConfirmRide} />
      ) : null}
    </View>
  );
}

class PartyAuthenticationError extends Error {
  constructor() {
    super('파티 주행을 시작하려면 로그인이 필요합니다.');
    this.name = 'PartyAuthenticationError';
  }
}

const styles = StyleSheet.create({
  row: { borderRadius: 8, borderWidth: 1, borderColor: GajaColors.border, padding: 12, gap: 8 },
  text: { gap: 4 },
  title: { color: GajaColors.textPrimary, fontSize: 14, fontWeight: '800' },
  body: { color: GajaColors.textSecondary, fontSize: 12, lineHeight: 18 },
  error: { color: GajaColors.danger, fontSize: 12, lineHeight: 18 },
});
