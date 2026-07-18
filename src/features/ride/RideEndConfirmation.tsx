import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GajaColors } from '../../shared/design/tokens';

type RideEndConfirmationProps = {
  readonly visible: boolean;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
};

export function RideEndConfirmation({ visible, busy, onCancel, onConfirm }: RideEndConfirmationProps) {
  return (
    <Modal animationType="slide" onRequestClose={onCancel} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.sheet}>
          <Text style={styles.title}>주행을 종료할까요?</Text>
          <Text style={styles.message}>현재까지 기록한 경로는 기기에 먼저 보관한 뒤 서버로 전송합니다.</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={[styles.button, styles.cancel]}>
              <Text style={styles.cancelLabel}>계속 주행</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={onConfirm} style={[styles.button, styles.confirm]}>
              <Text style={styles.confirmLabel}>{busy ? '저장 중' : '종료 및 저장'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  sheet: { padding: 24, paddingBottom: 32, gap: 14, backgroundColor: GajaColors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  title: { color: GajaColors.textPrimary, fontSize: 22, fontWeight: '900' },
  message: { color: GajaColors.textSecondary, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  button: { flex: 1, minHeight: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: GajaColors.surfaceMuted },
  confirm: { backgroundColor: GajaColors.danger },
  cancelLabel: { color: GajaColors.primary, fontSize: 15, fontWeight: '900' },
  confirmLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
