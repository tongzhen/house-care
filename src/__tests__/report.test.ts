/* eslint-disable import/first */

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ readAsStringAsync: jest.fn(), deleteAsync: jest.fn(), EncodingType: { Base64: 'base64' } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('../catalog', () => ({ getAction: (id: string) => id === 'dishwasher-filter-clean' ? { id, category: 'appliance', estimatedMinutes: 20, content: { en: { title: 'Clean filter' }, da: { title: 'Rens filter' } } } : undefined }));

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { buildMaintenanceReport, exportMaintenanceReport, hasReportableOutcomes, isValidReportPeriod, renderMaintenanceReportHtml } from '../report';

const strings = {
  title: 'Maintenance report', generated: 'Generated', home: 'Home', completed: 'Completed', issues: 'Issues', estimatedTime: 'Estimated time', completedMaintenance: 'Completed maintenance', reportedIssues: 'Reported issues', date: 'Date', action: 'Action', duration: 'Duration', relatedAction: 'Related action', note: 'Note', noNote: 'No note', profileSummary: () => 'Detached home', category: (id: string) => id, hours: (minutes: number) => `${minutes} min`,
};
const state = {
  profile: { id: 'home', appliances: ['dishwasher'], features: [], variants: {} }, configurations: [], settings: { language: 'en' as const, notificationsEnabled: true, notificationSchedule: {} as never }, outcomes: [
    { id: 'done', actionId: 'dishwasher-filter-clean', type: 'done' as const, occurredAt: '2026-08-10T10:00:00.000Z' },
    { id: 'issue', actionId: 'dishwasher-filter-clean', type: 'issue_reported' as const, occurredAt: '2026-08-11T10:00:00.000Z', title: 'Leak <risk>', note: 'Needs & attention', photoUri: 'file:///issue.jpg' },
    { id: 'snooze', actionId: 'dishwasher-filter-clean', type: 'snoozed' as const, occurredAt: '2026-08-12T10:00:00.000Z' },
    { id: 'rain', actionId: 'dishwasher-filter-clean', type: 'event_checked' as const, eventKey: 'heavy-rain', occurredAt: '2026-08-13T10:00:00.000Z' },
  ],
};
const period = { start: new Date('2026-08-01T12:00:00'), end: new Date('2026-08-31T12:00:00') };

beforeEach(() => { jest.clearAllMocks(); jest.mocked(FileSystem.deleteAsync).mockResolvedValue(); });

describe('maintenance report', () => {
  it('uses inclusive local calendar-day bounds and ignores non-reportable outcomes', () => {
    expect(isValidReportPeriod(period)).toBe(true);
    expect(hasReportableOutcomes(state.outcomes, period)).toBe(true);
    expect(hasReportableOutcomes(state.outcomes, { start: new Date('2026-09-01'), end: new Date('2026-08-31') })).toBe(false);
    const report = buildMaintenanceReport(state, period, 'en', new Date('2026-08-31T12:00:00Z'));
    expect(report.completed).toHaveLength(1);
    expect(report.issues).toHaveLength(1);
    expect(report.totalMinutes).toBe(20);
  });

  it('renders localized content, escaped notes, categories, and available photos', async () => {
    jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue('photo-data');
    const report = buildMaintenanceReport(state, period, 'da');
    const html = await renderMaintenanceReportHtml(report, { ...strings, category: () => 'Apparater' });
    expect(html).toContain('Rens filter');
    expect(html).toContain('Leak &lt;risk&gt;');
    expect(html).toContain('Needs &amp; attention');
    expect(html).toContain('data:image/jpeg;base64,photo-data');
  });

  it('shares a generated PDF and removes the temporary file without changing app data', async () => {
    jest.mocked(Print.printToFileAsync).mockResolvedValue({ uri: 'file:///report.pdf', numberOfPages: 1 });
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    await expect(exportMaintenanceReport(state, period, 'en', strings)).resolves.toEqual({ status: 'shared' });
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///report.pdf', expect.objectContaining({ mimeType: 'application/pdf' }));
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///report.pdf', { idempotent: true });
  });

  it('returns an empty status before invoking device APIs for an empty period', async () => {
    await expect(exportMaintenanceReport(state, { start: new Date('2026-09-01'), end: new Date('2026-09-30') }, 'en', strings)).resolves.toEqual({ status: 'empty' });
    expect(Print.printToFileAsync).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('cleans up the temporary PDF when sharing fails', async () => {
    jest.mocked(Print.printToFileAsync).mockResolvedValue({ uri: 'file:///report.pdf', numberOfPages: 1 });
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    jest.mocked(Sharing.shareAsync).mockRejectedValue(new Error('share failed'));
    await expect(exportMaintenanceReport(state, period, 'en', strings)).rejects.toThrow('share failed');
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///report.pdf', { idempotent: true });
  });
});
