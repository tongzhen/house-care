import { actionApplies, actions } from './catalog';
import { actionNeedsAttention } from './date';
import type { AppState } from './service';
import type { ActionConfiguration, MaintenanceAction } from './types';

export function configurationMap(state: AppState) { return new Map(state.configurations.map((configuration) => [configuration.actionId, configuration])); }

export function activeActions(state: AppState, configurations = configurationMap(state)) {
  if (!state.profile) return [];
  return actions.filter((action) => configurations.get(action.id)?.enabled && actionApplies(action, state.profile!));
}

export function dueFor(action: MaintenanceAction, configuration?: ActionConfiguration) {
  return new Date(configuration?.snoozedUntil ?? configuration?.nextDueAt ?? (action.trigger.kind === 'habit' ? '9999-01-01' : new Date().toISOString())).getTime();
}

export function orderedActiveActions(state: AppState, configurations = configurationMap(state)) {
  return [...activeActions(state, configurations)].sort((left, right) => dueFor(left, configurations.get(left.id)) - dueFor(right, configurations.get(right.id)));
}

export function attentionCount(state: AppState, now = Date.now(), configurations = configurationMap(state)) {
  return activeActions(state, configurations).filter((action) => actionNeedsAttention(action, configurations.get(action.id), now)).length;
}
