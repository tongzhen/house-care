export type FrequencyUnit = 'day' | 'week' | 'month' | 'year';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type OutcomeType = 'done' | 'snoozed' | 'not_relevant' | 'issue_reported';
export type SafetyLevel = 'DIY' | 'DIY with caution' | 'Professional required';
export interface Frequency { interval: number; unit: FrequencyUnit; }
export interface ActionContent { title: string; whyItMatters: string; steps: string[]; normalSigns: string[]; concerningSigns: string[]; escalationGuidance: string; safetyRestrictions: string[]; manualNote: string; }
export interface MaintenanceAction {
  id: string; category: string; target: string; estimatedMinutes: number; safetyLevel: SafetyLevel;
  profileConditions: { appliances?: string[]; features?: string[]; systemVariants?: string[] };
  trigger: { kind: 'recurring' | 'seasonal' | 'habit'; defaultFrequency?: Frequency; seasons?: string[]; weatherEvents?: string[]; frequencyNote?: string; };
  content: { en: ActionContent; da: ActionContent | null }; sources: string[];
}
export interface Profile { id: string; houseType?: 'detached' | 'terraced'; ageBand?: 'new-build' | '0-2' | '3-10' | '10+'; features: string[]; appliances: string[]; variants: Record<string, string>; }
export interface ActionConfiguration { actionId: string; enabled: boolean; frequencyOverride?: Frequency; nextDueAt?: string; snoozedUntil?: string; notificationsEnabled: boolean; }
export interface TaskOutcome { id: string; actionId: string; type: OutcomeType; occurredAt: string; title?: string; note?: string; photoUri?: string; }
export interface NotificationDayPreference { enabled: boolean; startTime: string; endTime: string; }
export type NotificationSchedule = Record<Weekday, NotificationDayPreference>;
export interface AppSettings { language: 'en' | 'da'; notificationsEnabled: boolean; notificationsPermissionRequested?: boolean; notificationSchedule: NotificationSchedule; }
