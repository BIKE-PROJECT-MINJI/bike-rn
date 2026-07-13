import { StyleSheet, Text, View } from 'react-native';
import { GajaColors } from '../design/tokens';
import { GajaButton } from './GajaButton';

export function LoadingStateView({ message }: { message: string }) {
  return <Text style={styles.message}>{message}</Text>;
}

export function EmptyStateView({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

export function ErrorStateView({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <GajaButton label="다시 시도" onPress={onRetry} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 10,
  },
  title: {
    color: GajaColors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  message: {
    color: GajaColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
