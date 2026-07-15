import { StyleSheet, Text, View } from 'react-native';
import type { RidePolicyEvaluationUiModel } from '../../domain/ride/ridePolicyModels';
import { GajaColors } from '../../shared/design/tokens';
import { presentRidePolicy } from './ridePolicyPresentation';

type RidePolicyBannerProps = {
  readonly policy: RidePolicyEvaluationUiModel | null;
  readonly loading: boolean;
  readonly error: Error | null;
  readonly topInset: number;
  readonly embedded?: boolean;
  readonly stale: boolean;
};

export function RidePolicyBanner({ policy, loading, error, topInset, stale, embedded = false }: RidePolicyBannerProps) {
  const presentation = presentRidePolicy(policy);
  const detail = stale
    ? '새 GPS 위치를 기다리는 중입니다. 위치 기록은 계속됩니다.'
    : error
      ? '판정 서버 연결이 불안정합니다. 위치 기록은 계속됩니다.'
      : presentation.detail;
  const tone = stale ? 'neutral' : error ? 'warning' : presentation.tone;
  return (
    <View pointerEvents="none" style={[styles.root, embedded ? styles.embedded : { top: topInset + 132 }, toneStyles[tone]]}>
      <Text style={styles.label}>{stale ? 'GPS 업데이트 대기' : loading && policy === null ? '경로 확인 중' : presentation.label}</Text>
      <Text numberOfLines={2} style={styles.detail}>{detail}</Text>
      {!stale && policy?.progressPercent !== null && policy?.progressPercent !== undefined ? (
        <Text style={styles.progress}>진행 {Math.round(policy.progressPercent)}%</Text>
      ) : null}
    </View>
  );
}

const toneStyles = StyleSheet.create({
  neutral: { borderColor: GajaColors.border },
  success: { borderColor: '#8DD6B1' },
  warning: { borderColor: '#F1C36D', backgroundColor: '#FFF9EB' },
  danger: { borderColor: '#F5A69B', backgroundColor: '#FFF2F0' },
});

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 16, right: 16, minHeight: 58, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.96)' },
  embedded: { position: 'relative', left: 0, right: 0 },
  label: { color: GajaColors.textPrimary, fontSize: 13, fontWeight: '900' },
  detail: { color: GajaColors.textSecondary, fontSize: 11, lineHeight: 16, fontWeight: '600', marginTop: 2 },
  progress: { color: GajaColors.primary, fontSize: 11, fontWeight: '800', marginTop: 4 },
});
