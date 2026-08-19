/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '0.1.0', nativeBuildVersion: '42' }));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })), getLastNotificationResponseAsync: jest.fn(async () => null) }));
jest.mock('../../src/db', () => ({}));

import { fireEvent, render } from '@testing-library/react-native';
import '../../src/i18n';
import { About, LegalDocumentView } from '../index';

describe('About and legal', () => {
  it('shows native metadata and opens each legal document', async () => {
    const onOpenDocument = jest.fn();
    const screen = await render(<About language="en" onBack={jest.fn()} onOpenDocument={onOpenDocument} />);
    expect(screen.getByText('0.1.0')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    fireEvent.press(screen.getByText('Privacy Policy'));
    expect(onOpenDocument).toHaveBeenCalledWith('privacy');
  });

  it('renders Danish legal copy offline', async () => {
    const screen = await render(<LegalDocumentView language="da" documentId="privacy" onBack={jest.fn()} />);
    expect(screen.getByText('Privatlivspolitik')).toBeTruthy();
    expect(screen.getByText(/Lokal først/)).toBeTruthy();
  });
});
