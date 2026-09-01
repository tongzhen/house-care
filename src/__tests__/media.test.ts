/* eslint-disable import/first */

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ manipulateAsync: jest.fn(), SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///documents/', copyAsync: jest.fn(), deleteAsync: jest.fn() }));

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { persistIssuePhoto, selectIssuePhoto } from '../media';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(FileSystem.copyAsync).mockResolvedValue();
  jest.mocked(FileSystem.deleteAsync).mockResolvedValue();
});

describe('issue media storage', () => {
  it('re-encodes a selected image before storing the draft and then removes the previous draft', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///picker/original.heic' }] } as never);
    jest.mocked(ImageManipulator.manipulateAsync).mockResolvedValue({ uri: 'file:///cache/reencoded.jpg', width: 1200, height: 900 });

    const result = await selectIssuePhoto('file:///documents/old-draft.jpg');

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith('file:///picker/original.heic', [], { compress: 0.8, format: 'jpeg' });
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({ from: 'file:///cache/reencoded.jpg', to: expect.stringContaining('issue-draft-') });
    expect(FileSystem.copyAsync).not.toHaveBeenCalledWith(expect.objectContaining({ from: 'file:///picker/original.heic' }));
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///documents/old-draft.jpg', { idempotent: true });
    expect(result).toContain('issue-draft-');
  });

  it('copies a draft to its permanent outcome path', async () => {
    await expect(persistIssuePhoto('file:///documents/issue-draft-1.jpg', 'outcome-1')).resolves.toBe('file:///documents/issue-outcome-1.jpg');
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({ from: 'file:///documents/issue-draft-1.jpg', to: 'file:///documents/issue-outcome-1.jpg' });
  });
});
