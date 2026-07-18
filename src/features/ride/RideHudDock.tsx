import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GajaColors } from '../../shared/design/tokens';

type RideHudDockProps = {
  readonly bottomInset: number;
  readonly distance: string;
  readonly duration: string;
  readonly speedKmh: number;
  readonly paused: boolean;
  readonly active: boolean;
  readonly busy: boolean;
  readonly startLabel: string;
  readonly onStart: () => void;
  readonly onTogglePause: () => void;
  readonly onEnd: () => void;
};

export function RideHudDock(props: RideHudDockProps) {
  return (
    <View style={[styles.root, { paddingBottom: Math.max(props.bottomInset, 12) }]}>
      <View style={styles.metrics}>
        <Metric label="거리" value={props.distance} />
        <View style={styles.speedMetric}>
          <Text style={styles.speedLabel}>현재 속도</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.speedValue}>{props.speedKmh.toFixed(1)}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
        <Metric label="경과 시간" value={props.duration} />
      </View>
      {props.active ? (
        <View style={styles.actions}>
          <ControlButton
            accessibilityLabel={props.paused ? '주행 재개' : '주행 일시정지'}
            icon={props.paused ? 'play' : 'pause'}
            label={props.paused ? '재개' : '일시정지'}
            color={GajaColors.primary}
            disabled={props.busy}
            onPress={props.onTogglePause}
          />
          <ControlButton accessibilityLabel="주행 종료" icon="stop" label="종료" color={GajaColors.danger} disabled={props.busy} onPress={props.onEnd} />
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={props.startLabel} disabled={props.busy} onPress={props.onStart} style={styles.startButton}>
          <Ionicons name="play" size={22} color="#FFFFFF" />
          <Text style={styles.startLabel}>{props.startLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>{value}</Text>
    </View>
  );
}

type ControlButtonProps = {
  readonly accessibilityLabel: string;
  readonly icon: 'pause' | 'play' | 'stop';
  readonly label: string;
  readonly color: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
};

function ControlButton(props: ControlButtonProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={props.accessibilityLabel} disabled={props.disabled} onPress={props.onPress} style={({ pressed }) => [styles.control, pressed ? styles.pressed : null]}>
      <View style={[styles.controlIcon, { backgroundColor: props.color }]}>
        <Ionicons name={props.icon} size={22} color="#FFFFFF" />
      </View>
      <Text style={[styles.controlLabel, { color: props.color }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.98)', borderTopColor: GajaColors.border, borderTopWidth: 1 },
  metrics: { height: 100, flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8 },
  metricLabel: { color: GajaColors.textMuted, fontSize: 12, fontWeight: '700' },
  metricValue: { color: GajaColors.textPrimary, fontSize: 21, fontWeight: '800' },
  speedMetric: { flex: 1.25, minWidth: 0, alignItems: 'center' },
  speedLabel: { color: GajaColors.textSecondary, fontSize: 12, fontWeight: '800' },
  speedValue: { color: '#111111', fontSize: 54, lineHeight: 58, fontWeight: '900' },
  speedUnit: { color: GajaColors.textMuted, fontSize: 12, fontWeight: '700' },
  actions: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  control: { minWidth: 92, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  controlIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  controlLabel: { fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.7 },
  startButton: { minHeight: 54, borderRadius: 8, backgroundColor: GajaColors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
