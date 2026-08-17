import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import { z } from 'zod';
import { clearOutcomePhoto, deleteOutcome, loadOutcomes, replaceLocalData, resetLocalData } from './db';
import type { AppState } from './service';
import type { TaskOutcome } from './types';

const backupVersion = 1;
const frequencySchema = z.object({ interval: z.number().int().positive(), unit: z.enum(['day', 'week', 'month', 'year']) });
const backupSchema = z.object({
  version: z.literal(backupVersion),
  profile: z.object({ houseType: z.enum(['detached', 'terraced']).optional(), ageBand: z.enum(['new-build', '0-2', '3-10', '10+']).optional(), features: z.array(z.string()), appliances: z.array(z.string()), variants: z.record(z.string(), z.string()) }),
  configurations: z.array(z.object({ actionId: z.string().min(1), enabled: z.boolean(), frequencyOverride: frequencySchema.optional(), nextDueAt: z.string().datetime().optional(), snoozedUntil: z.string().datetime().optional(), notificationsEnabled: z.boolean() })),
  outcomes: z.array(z.object({ id: z.string().min(1), actionId: z.string().min(1), type: z.enum(['done', 'snoozed', 'not_relevant', 'issue_reported']), occurredAt: z.string().datetime(), note: z.string().optional(), photoUri: z.string().optional() })),
  settings: z.object({ language: z.enum(['en', 'da']), notificationsEnabled: z.boolean() }),
});

async function removePhotos(outcomes: TaskOutcome[]) {
  await Promise.all(outcomes.flatMap((outcome) => outcome.photoUri ? [FileSystem.deleteAsync(outcome.photoUri, { idempotent: true })] : []));
}

export async function exportBackup(state: AppState) {
  const zip = new JSZip();
  const media: Record<string, string> = {};
  for (const outcome of state.outcomes) {
    if (outcome.photoUri) {
      const filename = `media/${outcome.id}.jpg`;
      media[outcome.id] = filename;
      zip.file(filename, await FileSystem.readAsStringAsync(outcome.photoUri, { encoding: FileSystem.EncodingType.Base64 }), { base64: true });
    }
  }
  zip.file('manifest.json', JSON.stringify({ version: backupVersion, exportedAt: new Date().toISOString(), profile: state.profile, configurations: state.configurations, outcomes: state.outcomes.map((outcome) => ({ ...outcome, photoUri: media[outcome.id] })), settings: state.settings }));
  const encoded = await zip.generateAsync({ type: 'base64' });
  const uri = `${FileSystem.documentDirectory}house-care-backup-${Date.now()}.zip`;
  await FileSystem.writeAsStringAsync(uri, encoded, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/zip' });
}

export async function importBackup() {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/zip', copyToCacheDirectory: true });
  if (result.canceled) return false;
  const encoded = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
  const zip = await JSZip.loadAsync(encoded, { base64: true });
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('Backup manifest is missing.');
  let manifest: z.infer<typeof backupSchema>;
  try {
    manifest = backupSchema.parse(JSON.parse(await manifestFile.async('text')));
  } catch {
    throw new Error('Backup is not compatible with House Care.');
  }

  const restoredOutcomes: TaskOutcome[] = [];
  const createdPhotos: string[] = [];
  try {
    for (const outcome of manifest.outcomes) {
      let photoUri: string | undefined;
      if (outcome.photoUri) {
        const file = zip.file(outcome.photoUri);
        if (!file) throw new Error('Backup photo is missing.');
        photoUri = `${FileSystem.documentDirectory}issue-import-${Date.now()}-${outcome.id}.jpg`;
        await FileSystem.writeAsStringAsync(photoUri, await file.async('base64'), { encoding: FileSystem.EncodingType.Base64 });
        createdPhotos.push(photoUri);
      }
      restoredOutcomes.push({ ...outcome, photoUri });
    }
    const existingOutcomes = await loadOutcomes();
    await replaceLocalData(manifest.profile, manifest.configurations, restoredOutcomes, manifest.settings);
    await removePhotos(existingOutcomes);
    return true;
  } catch (error) {
    await Promise.all(createdPhotos.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true })));
    throw error;
  }
}

export async function clearData() {
  const outcomes = await loadOutcomes();
  await removePhotos(outcomes);
  await resetLocalData();
}

export async function removeIssuePhoto(outcome: TaskOutcome) {
  if (outcome.photoUri) await FileSystem.deleteAsync(outcome.photoUri, { idempotent: true });
  await clearOutcomePhoto(outcome.id);
}

export async function removeIssue(outcome: TaskOutcome) {
  if (outcome.photoUri) await FileSystem.deleteAsync(outcome.photoUri, { idempotent: true });
  await deleteOutcome(outcome.id);
}
