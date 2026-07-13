import { StyleSheet, Text, View } from 'react-native';
import { GajaColors } from '../../shared/design/tokens';
import { GajaButton } from '../../shared/ui/GajaButton';
import { GajaCard } from '../../shared/ui/GajaCard';
import type { ApiTestAction } from './apiTestActions';

type ActionGroup = {
  readonly title: string;
  readonly actions: readonly ApiTestAction[];
};

type Props = {
  readonly groupedActions: readonly ActionGroup[];
  readonly runningId: string | null;
  readonly hasAccessToken: boolean;
  readonly onRun: (action: ApiTestAction) => void;
};

export function ApiTestActionPanel({ groupedActions, runningId, hasAccessToken, onRun }: Props) {
  return (
    <GajaCard title="실행">
      {groupedActions.map((group) => (
        <View key={group.title} style={styles.groupBox}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View style={styles.actionGrid}>
            {group.actions.map((action) => (
              <View key={action.id} style={styles.actionCell}>
                <GajaButton
                  label={runningId === action.id ? '실행 중' : action.title}
                  variant={action.needsAuth ? 'primary' : 'secondary'}
                  disabled={runningId !== null || Boolean(action.needsAuth && !hasAccessToken)}
                  onPress={() => onRun(action)}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </GajaCard>
  );
}

const styles = StyleSheet.create({
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  groupBox: {
    gap: 8,
  },
  groupTitle: {
    color: GajaColors.textSecondary,
    fontSize: 13,
    fontWeight: '900',
  },
  actionCell: {
    minWidth: '47%',
    flexGrow: 1,
  },
});
