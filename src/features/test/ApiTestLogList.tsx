import { StyleSheet, Text, View } from 'react-native';
import { GajaColors } from '../../shared/design/tokens';
import { GajaCard, StatusBadge } from '../../shared/ui/GajaCard';
import type { ApiTestLog } from './apiTestActions';

type Props = {
  readonly logs: readonly ApiTestLog[];
};

export function ApiTestLogList({ logs }: Props) {
  return (
    <GajaCard title="결과 로그" subtitle="최근 8개 요청의 성공/실패와 원본 응답입니다.">
      {logs.length === 0 ? <Text style={styles.meta}>아직 실행한 API가 없습니다.</Text> : null}
      {logs.map((log) => (
        <View key={log.id} style={styles.logBox}>
          <View style={styles.logHeader}>
            <StatusBadge label={log.ok ? '성공' : '실패'} tone={log.ok ? 'success' : 'danger'} />
            <Text style={styles.logTitle}>{log.title}</Text>
          </View>
          <Text style={styles.meta}>{log.summary}</Text>
          <Text selectable style={styles.payload}>
            {log.payload}
          </Text>
        </View>
      ))}
    </GajaCard>
  );
}

const styles = StyleSheet.create({
  logBox: {
    backgroundColor: GajaColors.surfaceMuted,
    borderColor: GajaColors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  logHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  logTitle: {
    color: GajaColors.textPrimary,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  meta: {
    color: GajaColors.textSecondary,
    fontSize: 13,
  },
  payload: {
    color: GajaColors.textPrimary,
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
});
