import * as database from './db';
import { rescheduleNotifications } from './notifications';
import type { HomeRepository, Clock, IdGenerator, NotificationScheduler } from './ports';

export const sqliteHomeRepository: HomeRepository = database;

export const expoNotificationScheduler: NotificationScheduler = {
  reconcile: (configurations, actions, settings) => rescheduleNotifications(configurations, actions, settings.notificationsEnabled, settings.language, settings.notificationSchedule),
};

export const deviceClock: Clock = { now: () => new Date() };
export const localIdGenerator: IdGenerator = { next: () => `${Date.now()}-${Math.random().toString(16).slice(2)}` };
