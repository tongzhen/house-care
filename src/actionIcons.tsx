import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

// Static requires let Metro bundle the matching @2x/@3x image on both platforms.
export const actionIconImages: Readonly<Record<string, ImageSourcePropType>> = {
  'dishwasher-filter-check': require('../assets/action-icons/dishwasher-filter-check.png'),
  'dishwasher-filter-clean': require('../assets/action-icons/dishwasher-filter-clean.png'),
  'washing-machine-drawer-seal': require('../assets/action-icons/washing-machine-drawer-seal.png'),
  'washing-machine-maintenance-wash': require('../assets/action-icons/washing-machine-maintenance-wash.png'),
  'washing-machine-pump-filter': require('../assets/action-icons/washing-machine-pump-filter.png'),
  'dryer-lint-filter': require('../assets/action-icons/dryer-lint-filter.png'),
  'dryer-condenser-filter': require('../assets/action-icons/dryer-condenser-filter.png'),
  'dryer-external-vent': require('../assets/action-icons/dryer-external-vent.png'),
  'cooker-hood-grease-filter': require('../assets/action-icons/cooker-hood-grease-filter.png'),
  'cooker-hood-carbon-filter': require('../assets/action-icons/cooker-hood-carbon-filter.png'),
  'gutters-ground-check': require('../assets/action-icons/gutters-ground-check.png'),
  'gutters-accessible-clean': require('../assets/action-icons/gutters-accessible-clean.png'),
  'faskine-inlet-check': require('../assets/action-icons/faskine-inlet-check.png'),
  'pump-well-visual-check': require('../assets/action-icons/pump-well-visual-check.png'),
  'outdoor-tap-winter-check': require('../assets/action-icons/outdoor-tap-winter-check.png'),
  'ventilation-grilles': require('../assets/action-icons/ventilation-grilles.png'),
  'ventilation-filters': require('../assets/action-icons/ventilation-filters.png'),
  'floor-drain-clean': require('../assets/action-icons/floor-drain-clean.png'),
  'underfloor-heating-visual-check': require('../assets/action-icons/underfloor-heating-visual-check.png'),
  'wood-floor-routine-clean': require('../assets/action-icons/wood-floor-routine-clean.png'),
  'wood-floor-care-review': require('../assets/action-icons/wood-floor-care-review.png'),
};

export function ActionIcon({ actionId }: { actionId: string }) {
  const source = actionIconImages[actionId];
  if (!source) return <View accessible={false} style={styles.fallback} />;
  return <Image source={source} style={styles.icon} resizeMode="contain" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

const styles = StyleSheet.create({
  icon: { width: 40, height: 40, flexShrink: 0 },
  fallback: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E5EFE8', flexShrink: 0 },
});
