import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CourseCardUiModel } from '../../domain/course/courseModels';
import { GajaColors } from '../../shared/design/tokens';
import { StatusBadge } from '../../shared/ui/GajaCard';

type FeaturedCourseRowProps = {
  readonly course: CourseCardUiModel;
  readonly onPress: () => void;
};

export function FeaturedCourseRow({ course, onPress }: FeaturedCourseRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${course.title}, ${course.distanceKm}킬로미터`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.preview}>
        <Ionicons name="map" size={34} color={GajaColors.routeBlue} />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={2} style={styles.title}>{course.title}</Text>
        <View style={styles.badges}>
          {course.difficulty ? <StatusBadge label={course.difficulty.label} tone={course.difficulty.level === 'HARD' ? 'warning' : 'success'} /> : null}
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{course.distanceKm} km</Text>
          <Text style={styles.separator}>|</Text>
          <Text style={styles.meta}>{course.estimatedDurationMin}분</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={22} color={GajaColors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 126,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GajaColors.border,
    backgroundColor: GajaColors.surface,
  },
  pressed: { opacity: 0.76 },
  preview: { width: 78, height: 94, borderRadius: 8, backgroundColor: '#EAF1FF', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 8 },
  title: { color: GajaColors.textPrimary, fontSize: 16, lineHeight: 21, fontWeight: '900' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { color: GajaColors.textSecondary, fontSize: 13, fontWeight: '700' },
  separator: { color: GajaColors.border },
});
