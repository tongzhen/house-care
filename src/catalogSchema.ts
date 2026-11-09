import { z } from 'zod';
import type { MaintenanceAction } from './types';

const frequencySchema = z.object({
  interval: z.number().int().positive(),
  unit: z.enum(['day', 'week', 'month', 'year']),
}).strict();

const actionContentSchema = z.object({
  title: z.string().min(1),
  whyItMatters: z.string().min(1),
  delayConsequences: z.string().trim().min(1),
  priorityReason: z.string().trim().min(1),
  careGuidance: z.string().trim().min(1),
  steps: z.array(z.string().min(1)).min(1),
  normalSigns: z.array(z.string().min(1)).min(1),
  concerningSigns: z.array(z.string().min(1)).min(1),
  escalationGuidance: z.string().min(1),
  safetyRestrictions: z.array(z.string().min(1)).min(1),
  manualNote: z.string().min(1),
}).strict();

const maintenanceActionSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  target: z.string().min(1),
  estimatedMinutes: z.number().int().positive(),
  safetyLevel: z.enum(['DIY', 'DIY with caution', 'Professional required']),
  priority: z.enum(['low', 'medium', 'high']),
  profileConditions: z.object({
    appliances: z.array(z.string().min(1)).optional(),
    features: z.array(z.string().min(1)).optional(),
    systemVariants: z.array(z.string().min(1)).optional(),
  }).strict(),
  trigger: z.object({
    kind: z.enum(['recurring', 'seasonal', 'habit']),
    defaultFrequency: frequencySchema.optional(),
    seasons: z.array(z.enum(['spring', 'summer', 'autumn', 'winter'])).optional(),
    seasonalDates: z.array(z.object({
      season: z.enum(['spring', 'summer', 'autumn', 'winter']),
      month: z.number().int().min(1).max(12),
      day: z.number().int().min(1).max(31),
    }).strict()).min(1).optional(),
    weatherEvents: z.array(z.string().min(1)).optional(),
    frequencyNote: z.string().min(1).optional(),
  }).strict(),
  content: z.object({
    en: actionContentSchema,
    da: actionContentSchema,
  }).strict(),
  sources: z.array(z.object({
    url: z.string().url().refine((url) => /^https?:\/\//i.test(url), 'Expected an HTTP(S) source'),
    title: z.string().trim().min(1),
    publisher: z.string().trim().min(1),
  }).strict()).min(1),
}).strict();

export const catalogSchema = z.object({
  schemaVersion: z.string().min(1),
  contentVersion: z.string().min(1),
  canonicalLanguage: z.literal('en'),
  supportedLanguages: z.array(z.enum(['en', 'da'])).min(1),
  lastReviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date'),
  contentPolicy: z.string().min(1),
  actions: z.array(maintenanceActionSchema).min(1),
}).strict().superRefine((catalog, context) => {
  const actionIds = new Set<string>();

  for (const [index, action] of catalog.actions.entries()) {
    if (action.trigger.kind === 'seasonal' && !action.trigger.seasonalDates?.length) {
      context.addIssue({ code: 'custom', message: 'Seasonal actions need calendar dates.', path: ['actions', index, 'trigger'] });
    }
    const calendarKeys = new Set<string>();
    for (const date of action.trigger.seasonalDates ?? []) {
      const actual = new Date(2025, date.month - 1, date.day);
      const season = date.month >= 3 && date.month <= 5 ? 'spring' : date.month >= 6 && date.month <= 8 ? 'summer' : date.month >= 9 && date.month <= 11 ? 'autumn' : 'winter';
      const key = `${date.month}-${date.day}`;
      if (action.trigger.kind !== 'seasonal' || actual.getMonth() !== date.month - 1 || season !== date.season || !action.trigger.seasons?.includes(date.season) || calendarKeys.has(key)) {
        context.addIssue({ code: 'custom', message: 'Invalid or duplicate seasonal calendar date.', path: ['actions', index, 'trigger', 'seasonalDates'] });
      }
      calendarKeys.add(key);
    }
    if (actionIds.has(action.id)) {
      context.addIssue({
        code: 'custom',
        message: `Duplicate action ID: ${action.id}`,
        path: ['actions', index, 'id'],
      });
    }
    actionIds.add(action.id);
  }

  if (!catalog.supportedLanguages.includes(catalog.canonicalLanguage)) {
    context.addIssue({
      code: 'custom',
      message: 'The canonical language must be supported.',
      path: ['canonicalLanguage'],
    });
  }
});

export type MaintenanceCatalog = {
  actions: MaintenanceAction[];
};

export function parseCatalog(value: unknown): MaintenanceCatalog {
  return catalogSchema.parse(value) as MaintenanceCatalog;
}
