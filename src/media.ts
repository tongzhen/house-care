import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const draftPrefix = 'issue-draft-';
const storedPrefix = 'issue-';

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function selectIssuePhoto(previousDraftUri?: string) {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, exif: false });
  if (result.canceled) return previousDraftUri;

  const encoded = await ImageManipulator.manipulateAsync(result.assets[0].uri, [], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const destination = `${FileSystem.documentDirectory}${draftPrefix}${uniqueSuffix()}.jpg`;
  try {
    await FileSystem.copyAsync({ from: encoded.uri, to: destination });
  } catch (error) {
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
    throw error;
  } finally {
    if (encoded.uri !== result.assets[0].uri) await FileSystem.deleteAsync(encoded.uri, { idempotent: true }).catch(() => undefined);
  }

  if (previousDraftUri) await discardIssuePhoto(previousDraftUri);
  return destination;
}

export async function discardIssuePhoto(uri?: string) {
  if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function persistIssuePhoto(draftUri: string | undefined, outcomeId: string) {
  if (!draftUri) return undefined;
  const destination = `${FileSystem.documentDirectory}${storedPrefix}${outcomeId}.jpg`;
  await FileSystem.copyAsync({ from: draftUri, to: destination });
  return destination;
}

export async function finishIssuePhotoDraft(draftUri?: string) {
  await discardIssuePhoto(draftUri);
}

export async function removePersistedIssuePhoto(uri?: string) {
  await discardIssuePhoto(uri);
}
