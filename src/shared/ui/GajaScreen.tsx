import { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GajaColors, GajaSpacing } from '../design/tokens';

export function GajaScreen({ children }: PropsWithChildren) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}

export function GajaFullScreen({ children }: PropsWithChildren) {
  return <View style={styles.full}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GajaColors.background,
  },
  content: {
    padding: GajaSpacing.screen,
    gap: GajaSpacing.section,
  },
  full: {
    flex: 1,
    backgroundColor: GajaColors.background,
  },
});
