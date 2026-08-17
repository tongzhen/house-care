import source from '../knowledge-base/maintenance-actions-v0.1.json';
import type { MaintenanceAction } from './types';

export const actions = source.actions as MaintenanceAction[];
export const getAction = (actionId: string) => actions.find((action) => action.id === actionId);
export function actionApplies(action: MaintenanceAction, profile: { appliances: string[]; features: string[]; variants: Record<string, string> }) {
  const condition = action.profileConditions;
  const appliancesMatch = !condition.appliances || condition.appliances.some((item) => profile.appliances.includes(item));
  const featuresMatch = !condition.features || condition.features.some((item) => profile.features.includes(item));
  const variantsMatch = !condition.systemVariants || condition.systemVariants.some((variant) => Object.values(profile.variants).includes(variant));
  return appliancesMatch && featuresMatch && variantsMatch;
}
