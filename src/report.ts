import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getAction } from './catalog';
import type { AppState } from './service';
import type { MaintenanceAction, TaskOutcome } from './types';

export interface ReportPeriod { start: Date; end: Date; }
export interface ReportStrings {
  title: string; generated: string; home: string; completed: string; issues: string; estimatedTime: string;
  completedMaintenance: string; reportedIssues: string; date: string; action: string; duration: string;
  relatedAction: string; note: string; noNote: string; profileSummary: (profile: AppState['profile']) => string;
  category: (id: string) => string; hours: (minutes: number) => string;
}
export interface ReportItem { outcome: TaskOutcome; action?: MaintenanceAction; title: string; category: string; durationMinutes?: number; }
export interface MaintenanceReportData {
  period: ReportPeriod; generatedAt: Date; profile: AppState['profile']; language: 'en' | 'da';
  completed: ReportItem[]; issues: ReportItem[]; totalMinutes: number;
}

function localStart(date: Date) { const result = new Date(date); result.setHours(0, 0, 0, 0); return result; }
function localEnd(date: Date) { const result = new Date(date); result.setHours(23, 59, 59, 999); return result; }
function localizedAction(action: MaintenanceAction, language: 'en' | 'da') { return language === 'da' && action.content.da ? action.content.da : action.content.en; }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!); }
function formattedDate(value: string | Date, language: 'en' | 'da') { return new Intl.DateTimeFormat(language === 'da' ? 'da-DK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value)); }

export function periodBounds(period: ReportPeriod) { return { start: localStart(period.start), end: localEnd(period.end) }; }

export function isValidReportPeriod(period: ReportPeriod) { const { start, end } = periodBounds(period); return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end; }

export function hasReportableOutcomes(outcomes: TaskOutcome[], period: ReportPeriod) {
  if (!isValidReportPeriod(period)) return false;
  const { start, end } = periodBounds(period);
  return outcomes.some((outcome) => (outcome.type === 'done' || outcome.type === 'issue_reported') && new Date(outcome.occurredAt) >= start && new Date(outcome.occurredAt) <= end);
}

export function buildMaintenanceReport(state: AppState, period: ReportPeriod, language: 'en' | 'da', generatedAt = new Date()): MaintenanceReportData {
  if (!isValidReportPeriod(period)) throw new Error('Invalid report period.');
  const { start, end } = periodBounds(period);
  const reportable = state.outcomes.filter((outcome) => {
    const occurredAt = new Date(outcome.occurredAt);
    return (outcome.type === 'done' || outcome.type === 'issue_reported') && occurredAt >= start && occurredAt <= end;
  });
  const toItem = (outcome: TaskOutcome): ReportItem => {
    const action = getAction(outcome.actionId);
    return { outcome, action, title: outcome.title ?? (action ? localizedAction(action, language).title : outcome.actionId), category: action?.category ?? 'other', durationMinutes: outcome.type === 'done' ? action?.estimatedMinutes : undefined };
  };
  const completed = reportable.filter((outcome) => outcome.type === 'done').map(toItem).sort((a, b) => a.outcome.occurredAt.localeCompare(b.outcome.occurredAt));
  const issues = reportable.filter((outcome) => outcome.type === 'issue_reported').map(toItem).sort((a, b) => a.outcome.occurredAt.localeCompare(b.outcome.occurredAt));
  return { period, generatedAt, profile: state.profile, language, completed, issues, totalMinutes: completed.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0) };
}

async function imageDataUri(uri?: string) {
  if (!uri) return undefined;
  try { return `data:image/jpeg;base64,${await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })}`; } catch { return undefined; }
}

export async function renderMaintenanceReportHtml(data: MaintenanceReportData, strings: ReportStrings) {
  const photos = new Map(await Promise.all(data.issues.map(async (item) => [item.outcome.id, await imageDataUri(item.outcome.photoUri)] as const)));
  const grouped = data.completed.reduce<Record<string, ReportItem[]>>((groups, item) => ({ ...groups, [item.category]: [...(groups[item.category] ?? []), item] }), {});
  const rows = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => `<section><h2>${escapeHtml(strings.category(category))}</h2><table><thead><tr><th>${escapeHtml(strings.date)}</th><th>${escapeHtml(strings.action)}</th><th>${escapeHtml(strings.duration)}</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHtml(formattedDate(item.outcome.occurredAt, data.language))}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(strings.hours(item.durationMinutes ?? 0))}</td></tr>`).join('')}</tbody></table></section>`).join('');
  const issueRows = data.issues.map((item) => `<article class="issue"><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(formattedDate(item.outcome.occurredAt, data.language))}${item.action ? ` · ${escapeHtml(strings.relatedAction)}: ${escapeHtml(localizedAction(item.action, data.language).title)}` : ''}</p><p><b>${escapeHtml(strings.note)}:</b> ${escapeHtml(item.outcome.note ?? strings.noNote)}</p></div>${photos.get(item.outcome.id) ? `<img src="${photos.get(item.outcome.id)}" alt="" />` : ''}</article>`).join('');
  const { start, end } = periodBounds(data.period);
  return `<!doctype html><html><head><meta charset="utf-8" /><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17352c;margin:34px;font-size:11px;line-height:1.45}h1{font-size:25px;margin:0 0 5px}h2{font-size:16px;margin:25px 0 8px;color:#1f5547}.muted{color:#687b72}.summary{display:flex;gap:10px;margin:22px 0}.metric{flex:1;background:#dceee4;border-radius:8px;padding:10px}.metric b{display:block;font-size:18px}table{width:100%;border-collapse:collapse}th{text-align:left;background:#f5f8f5}th,td{padding:8px;border-bottom:1px solid #dce7df;vertical-align:top}.issue{display:flex;gap:14px;border:1px solid #dce7df;border-radius:8px;padding:12px;margin:10px 0}.issue p{margin:4px 0}.issue img{width:120px;height:90px;object-fit:cover;border-radius:6px}@media print{body{margin:26px}section,.issue{break-inside:avoid}}</style></head><body><h1>${escapeHtml(strings.title)}</h1><p class="muted">${escapeHtml(formattedDate(start, data.language))} - ${escapeHtml(formattedDate(end, data.language))}<br/>${escapeHtml(strings.generated)}: ${escapeHtml(formattedDate(data.generatedAt, data.language))}</p><p><b>${escapeHtml(strings.home)}:</b> ${escapeHtml(strings.profileSummary(data.profile))}</p><div class="summary"><div class="metric"><b>${data.completed.length}</b>${escapeHtml(strings.completed)}</div><div class="metric"><b>${escapeHtml(strings.hours(data.totalMinutes))}</b>${escapeHtml(strings.estimatedTime)}</div><div class="metric"><b>${data.issues.length}</b>${escapeHtml(strings.issues)}</div></div>${data.completed.length ? `<h2>${escapeHtml(strings.completedMaintenance)}</h2>${rows}` : ''}${data.issues.length ? `<h2>${escapeHtml(strings.reportedIssues)}</h2>${issueRows}` : ''}</body></html>`;
}

export async function exportMaintenanceReport(state: AppState, period: ReportPeriod, language: 'en' | 'da', strings: ReportStrings) {
  const data = buildMaintenanceReport(state, period, language);
  if (data.completed.length + data.issues.length === 0) return { status: 'empty' as const };
  const html = await renderMaintenanceReportHtml(data, strings);
  const { uri } = await Print.printToFileAsync({ html });
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable.');
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: strings.title });
    return { status: 'shared' as const };
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }
}
