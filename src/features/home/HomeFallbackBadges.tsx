import { StyleSheet, Text, View } from 'react-native';
import type { AiRoutePlanUiModel } from '../../domain/airoute/aiRouteModels';
import type { AddressSearchUiModel } from '../../domain/address/addressModels';
import { GajaColors } from '../../shared/design/tokens';
import { StatusBadge } from '../../shared/ui/GajaCard';

type HomeFallbackBadgesProps = {
  readonly addressResult?: AddressSearchUiModel | null;
  readonly aiRouteResult?: AiRoutePlanUiModel | null;
};

export function HomeFallbackBadges({ addressResult, aiRouteResult }: HomeFallbackBadgesProps) {
  const showAddressFallback = addressResult?.uiState === 'fallback';
  const showAiFallback = aiRouteResult?.uiState === 'fallback';

  if (!showAddressFallback && !showAiFallback) {
    return null;
  }

  return (
    <View style={styles.stack}>
      {showAddressFallback ? (
        <View style={styles.item}>
          <StatusBadge label="대체 주소 결과" tone="warning" />
          <Text style={styles.text}>{addressResult.fallbackReason ?? '기본 주소 provider 대신 대체 provider 결과를 사용했습니다.'}</Text>
        </View>
      ) : null}
      {showAiFallback ? (
        <View style={styles.item}>
          <StatusBadge label="대체 코스 후보" tone="warning" />
          <Text style={styles.text}>{aiRouteResult.fallbackReason ?? '일부 외부 provider 결과를 대체해 후보를 만들었습니다.'}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8,
  },
  item: {
    gap: 6,
  },
  text: {
    color: GajaColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
