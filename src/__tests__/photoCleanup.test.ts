/* eslint-disable import/first */
jest.mock('../db', () => ({}));
jest.mock('../media', () => ({}));

import { processPendingPhotoDeletions, type PhotoCleanupDependencies } from '../photoCleanup';

function fixture() {
  const queue = new Set(['file:///documents/issue-one.jpg', 'file:///documents/issue-two.jpg']);
  const dependencies: PhotoCleanupDependencies = {
    pending: jest.fn(async () => [...queue]),
    referenced: jest.fn(async () => false),
    remove: jest.fn(async () => undefined),
    complete: jest.fn(async uri => { queue.delete(uri); }),
  };
  return { queue, dependencies };
}

it('acknowledges files only after successful removal', async () => {
  const { queue, dependencies } = fixture();
  jest.mocked(dependencies.remove).mockImplementation(async uri => {
    expect(queue.has(uri)).toBe(true);
  });
  await processPendingPhotoDeletions(dependencies);
  expect(queue.size).toBe(0);
});

it('retains failed deletions and retries them without blocking other photos', async () => {
  const { queue, dependencies } = fixture();
  jest.mocked(dependencies.remove).mockRejectedValueOnce(new Error('File locked'));
  await processPendingPhotoDeletions(dependencies);
  expect([...queue]).toEqual(['file:///documents/issue-one.jpg']);
  await processPendingPhotoDeletions(dependencies);
  expect(queue.size).toBe(0);
});

it('retries safely after a crash between removal and acknowledgement', async () => {
  const { queue, dependencies } = fixture();
  jest.mocked(dependencies.complete).mockRejectedValueOnce(new Error('Database unavailable'));
  await processPendingPhotoDeletions(dependencies);
  expect(queue.size).toBe(1);
  // The idempotent media adapter also succeeds when the file is already absent.
  await processPendingPhotoDeletions(dependencies);
  expect(queue.size).toBe(0);
});

it('never deletes a photo still referenced by a surviving record', async () => {
  const { queue, dependencies } = fixture();
  jest.mocked(dependencies.referenced).mockResolvedValue(true);
  await processPendingPhotoDeletions(dependencies);
  expect(dependencies.remove).not.toHaveBeenCalled();
  expect(queue.size).toBe(2);
});

it('serializes overlapping cleanup requests', async () => {
  const { dependencies } = fixture();
  await Promise.all([processPendingPhotoDeletions(dependencies), processPendingPhotoDeletions(dependencies)]);
  expect(dependencies.remove).toHaveBeenCalledTimes(2);
});
