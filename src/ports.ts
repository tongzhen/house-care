import type { ActionConfiguration, AppSettings, MaintenanceAction, Profile, TaskOutcome } from './types';

export interface HomeRepository {
  initialiseDatabase(): Promise<void>;
  loadProfile(): Promise<Profile | null>;
  loadConfigurations(): Promise<ActionConfiguration[]>;
  loadOutcomes(): Promise<TaskOutcome[]>;
  getSettings(): Promise<AppSettings>;
  addOutcome(outcome: TaskOutcome): Promise<void>;
  upsertConfiguration(configuration: ActionConfiguration): Promise<void>;
  transaction<T>(work: (transaction: HomeRepositoryTransaction) => Promise<T>): Promise<T>;
}

export interface HomeRepositoryTransaction {
  saveProfile(profile: Omit<Profile, 'id'>): Promise<void>;
  deleteConfiguration(actionId: string): Promise<void>;
  addOutcome(outcome: TaskOutcome): Promise<void>;
  upsertConfiguration(configuration: ActionConfiguration): Promise<void>;
}

export interface NotificationScheduler {
  reconcile(configurations: ActionConfiguration[], actions: MaintenanceAction[], settings: AppSettings): Promise<void>;
}

export interface Clock { now(): Date; }
export interface IdGenerator { next(): string; }
