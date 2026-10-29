import { completePhotoDeletion, isPhotoReferenced, loadPendingPhotoDeletions } from './db';
import { removePersistedIssuePhoto } from './media';

export interface PhotoCleanupDependencies {
  pending(): Promise<string[]>;
  referenced(uri: string): Promise<boolean>;
  remove(uri: string): Promise<void>;
  complete(uri: string): Promise<void>;
}

const localDependencies: PhotoCleanupDependencies = {
  pending: loadPendingPhotoDeletions,
  referenced: isPhotoReferenced,
  remove: removePersistedIssuePhoto,
  complete: completePhotoDeletion,
};

// One worker at a time, including overlapping startup and deletion requests.
let cleanupOperation: Promise<void> = Promise.resolve();
export function processPendingPhotoDeletions(dependencies: PhotoCleanupDependencies = localDependencies): Promise<void> {
  const operation = cleanupOperation.catch(() => undefined).then(async () => {
    for (const uri of await dependencies.pending()) {
      try {
        if (await dependencies.referenced(uri)) continue;
        await dependencies.remove(uri);
        await dependencies.complete(uri);
      } catch {
        // Keep the durable entry for the next startup/foreground/deletion retry.
        // A missing file is handled as success by the media adapter.
      }
    }
  });
  cleanupOperation = operation;
  return operation;
}
