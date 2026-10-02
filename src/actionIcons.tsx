import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

// Drawings are deliberately limited to a few bold strokes so they remain
// distinguishable in the 40-point action-list tile.
export const actionIconIds = [
  'dishwasher-filter-check',
  'dishwasher-filter-clean',
  'washing-machine-drawer-seal',
  'washing-machine-maintenance-wash',
  'washing-machine-pump-filter',
  'dryer-lint-filter',
  'dryer-condenser-filter',
  'dryer-external-vent',
  'cooker-hood-grease-filter',
  'cooker-hood-carbon-filter',
  'gutters-ground-check',
  'gutters-accessible-clean',
  'faskine-inlet-check',
  'pump-well-visual-check',
  'outdoor-tap-winter-check',
  'ventilation-grilles',
  'ventilation-filters',
  'floor-drain-clean',
  'underfloor-heating-visual-check',
  'wood-floor-routine-clean',
  'wood-floor-care-review',
] as const;

type ActionIconId = typeof actionIconIds[number];

const drawings: Record<ActionIconId, ReactNode> = {
  'dishwasher-filter-check': <>
    <Ellipse cx="16" cy="8" rx="10" ry="3" /><Path d="M6 8 8 25c4 3 12 3 16 0l2-17M11 13v9M16 13v10M21 13v9" />
  </>,
  'dishwasher-filter-clean': <>
    <Ellipse cx="16" cy="7" rx="11" ry="3.5" /><Circle cx="11" cy="7" r=".7" /><Circle cx="16" cy="7" r=".7" /><Circle cx="21" cy="7" r=".7" />
    <Path d="M10 16c3-2 9-2 12 0M10 16l1 10c3 2 7 2 10 0l1-10M13 20v4M19 20v4" />
  </>,
  'washing-machine-drawer-seal': <>
    <Rect x="6" y="4" width="21" height="24" rx="2" /><Path d="M6 10h21M3 7h9v5H3zM9 7l2-2" />
    <Circle cx="16.5" cy="19" r="6" /><Circle cx="16.5" cy="19" r="3.5" />
  </>,
  'washing-machine-maintenance-wash': <>
    <Rect x="5" y="4" width="22" height="24" rx="2" /><Path d="M5 10h22" /><Circle cx="16" cy="19" r="7" />
    <Path d="M12 18a4.2 4.2 0 0 1 7-2l1 2M20 15v3h-3" />
  </>,
  'washing-machine-pump-filter': <>
    <Rect x="4" y="3" width="24" height="26" rx="2" /><Path d="M4 9h24" /><Circle cx="15" cy="18" r="6" />
    <Path d="M21 24h5v5h-5zM26 24l3-2v6l-3 1" /><Circle cx="23.5" cy="26.5" r=".7" />
  </>,
  'dryer-lint-filter': <>
    <Rect x="5" y="8" width="22" height="18" rx="2" /><Path d="M13 8V5h6v3M9 13h14M9 17h14M9 21h14" />
  </>,
  'dryer-condenser-filter': <>
    <Rect x="4" y="6" width="24" height="20" rx="2" /><Rect x="7" y="9" width="5" height="14" rx="1" />
    <Rect x="14" y="9" width="5" height="14" rx="1" /><Rect x="21" y="9" width="4" height="14" rx="1" />
  </>,
  'dryer-external-vent': <>
    <Path d="M4 7h13l2 17H4zM7 11h8M7 15h8M7 19h8M21 16h8m-3-3 3 3-3 3" />
  </>,
  'cooker-hood-grease-filter': <>
    <Path d="M13 3h6v5l8 8H5l8-8V3M5 16h22v4H5zM9 21l1 4M14 21l1 4M19 21l1 4M24 21l1 4" />
  </>,
  'cooker-hood-carbon-filter': <>
    <Path d="M13 3h6v5l8 8H5l8-8V3M5 16h22" /><Ellipse cx="16" cy="24" rx="8" ry="4" />
    <Circle cx="13" cy="24" r=".7" /><Circle cx="19" cy="24" r=".7" />
  </>,
  'gutters-ground-check': <>
    <Path d="m4 6 8 8h16M7 15h17v4H7zM24 19v9h4M5 26c3-4 7-4 10 0-3 4-7 4-10 0Z" /><Circle cx="10" cy="26" r=".8" />
  </>,
  'gutters-accessible-clean': <>
    <Path d="m3 8 8 7h17M6 16h21v6H6zM15 19l2-2 2 2-2 2zM21 12l2-3 2 3-2 3z" />
  </>,
  'faskine-inlet-check': <>
    <Path d="M5 9h22M8 5h16l2 4H6zM13 9v7h6V9M10 17h12v11H10z" />
    <Circle cx="13" cy="21" r=".8" /><Circle cx="18" cy="24" r=".8" />
  </>,
  'pump-well-visual-check': <>
    <Ellipse cx="14" cy="8" rx="10" ry="3" /><Path d="M4 8v15c4 4 16 4 20 0V8M5 18c3-2 5 2 8 0s5 2 8 0" />
    <Path d="M25 19c0-2 4-2 4 0v5h-4zM24 24h6" />
  </>,
  'outdoor-tap-winter-check': <>
    <Path d="M3 10h6V7h10v3h4v5c0 2 3 2 3 4v2h-7v-3H9v-4H3zM14 7V4M11 4h6" />
    <Path d="M26 5v8M22 9h8M23 6l6 6M29 6l-6 6" />
  </>,
  'ventilation-grilles': <>
    <Rect x="4" y="6" width="24" height="20" rx="2" /><Path d="M8 11h15M8 15h15M8 19h15M8 23h15M26 2v6M23 5h6" />
  </>,
  'ventilation-filters': <>
    <Rect x="4" y="5" width="23" height="22" rx="2" /><Path d="m7 9 5 5 5-5 5 5 3-3M7 20l5 5 5-5 5 5M28 19a4 4 0 1 1-5 5m0-3v3h3" />
  </>,
  'floor-drain-clean': <>
    <Ellipse cx="13" cy="8" rx="10" ry="4" /><Circle cx="9" cy="8" r=".7" /><Circle cx="13" cy="8" r=".7" /><Circle cx="17" cy="8" r=".7" />
    <Path d="M10 12v10c0 4 7 4 7 0v-3h7v-4h-7" />
  </>,
  'underfloor-heating-visual-check': <>
    <Path d="M3 13h26M3 16h26M6 23h19c3 0 3 4 0 4H8c-3 0-3-4 0-4h16c3 0 3-4 0-4H7M9 10V4m-2 2 2-2 2 2M16 10V4m-2 2 2-2 2 2M23 10V4m-2 2 2-2 2 2" />
  </>,
  'wood-floor-routine-clean': <>
    <Path d="m4 22 7-14h6l-7 14H4zm8 0 7-14h6l-7 14h-6zM21 17l3-3 5 5-5 5-5-4 2-3z" />
  </>,
  'wood-floor-care-review': <>
    <Path d="m4 22 7-14h6l-7 14H4zm8 0 7-14h6l-3 6" /><Circle cx="23" cy="20" r="5" /><Path d="m27 24 3 4" />
  </>,
};

const iconStyle = { color: '#176B60', backgroundColor: '#E5EFE8' };

export function ActionIcon({ actionId }: { actionId: string }) {
  return <View
    accessible={false}
    testID={`action-icon-${actionId}`}
    style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: iconStyle.backgroundColor }}
  >
    <Svg width={28} height={28} viewBox="0 0 32 32" fill="none" stroke={iconStyle.color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden>
      {drawings[actionId as ActionIconId] ?? <Circle cx="16" cy="16" r="9" />}
    </Svg>
  </View>;
}
