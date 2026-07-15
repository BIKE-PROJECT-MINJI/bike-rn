import { StyleSheet, Switch, Text, View } from 'react-native';
import { GajaColors } from '../../shared/design/tokens';
import type { PartySharingStatus } from './usePartyLocationSharing';

type PartyLocationSharingPanelProps = {
  readonly enabled: boolean;
  readonly status: PartySharingStatus;
  readonly visibleMemberCount: number;
  readonly errorMessage: string | null;
  readonly topInset: number;
  readonly embedded?: boolean;
  readonly onEnabledChange: (enabled: boolean) => void;
};

export function PartyLocationSharingPanel({
  enabled,
  status,
  visibleMemberCount,
  errorMessage,
  topInset,
  embedded = false,
  onEnabledChange,
}: PartyLocationSharingPanelProps) {
  return (
    <View style={[styles.panel, embedded ? styles.embedded : { top: topInset + 184 }]}>
      <View style={styles.row}>
        <View style={styles.textGroup}>
          <Text style={styles.title}>파티 위치 공유</Text>
          <Text numberOfLines={1} style={styles.meta}>{statusLabel(status, visibleMemberCount)}</Text>
        </View>
        <Switch
          accessibilityLabel="파티 위치 공유"
          accessibilityRole="switch"
          value={enabled}
          onValueChange={onEnabledChange}
          trackColor={{ false: '#CBD2D8', true: '#79B8F2' }}
          thumbColor={enabled ? GajaColors.routeBlue : '#FFFFFF'}
        />
      </View>
      {errorMessage ? <Text numberOfLines={2} style={styles.error}>{errorMessage}</Text> : null}
    </View>
  );
}

function statusLabel(status: PartySharingStatus, visibleMemberCount: number): string {
  switch (status) {
    case 'OFF':
      return '내가 켜야만 공유됩니다.';
    case 'CONNECTING':
      return '연결 중';
    case 'CONNECTED':
      return `위치 확인 ${visibleMemberCount}명`;
    case 'RECONNECTING':
      return '재연결 중';
    case 'ERROR':
      return '권한 확인 필요';
  }
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute', left: 16, right: 16, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.96)', borderColor: GajaColors.border, borderWidth: 1, gap: 6,
  },
  embedded: { position: 'relative', left: 0, right: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textGroup: { flex: 1, gap: 2 },
  title: { color: GajaColors.textPrimary, fontSize: 13, fontWeight: '900' },
  meta: { color: GajaColors.textSecondary, fontSize: 11 },
  error: { color: GajaColors.danger, fontSize: 11, lineHeight: 16 },
});
