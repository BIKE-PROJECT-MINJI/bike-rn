import { Pressable, StyleSheet, Text } from 'react-native';
import { GajaColors, GajaRadius } from '../design/tokens';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export function GajaButton({ label, onPress, variant = 'primary', disabled = false }: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        variant === 'primary' ? styles.primary : styles.secondary,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.label, variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: GajaRadius.button,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: GajaColors.primary,
  },
  secondary: {
    backgroundColor: GajaColors.surfaceMuted,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontWeight: '800',
    fontSize: 15,
  },
  primaryLabel: {
    color: '#FFFFFF',
  },
  secondaryLabel: {
    color: GajaColors.primary,
  },
});
