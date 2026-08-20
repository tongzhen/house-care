/* eslint-disable import/first */

jest.mock('expo-localization', () => ({ getLocales: jest.fn(() => [{ languageCode: 'en' }]) }));

import { appLanguageFromSystem } from '../language';

describe('system language defaults', () => {
  it('uses Danish only for a Danish system language', () => {
    expect(appLanguageFromSystem([{ languageCode: 'da' }])).toBe('da');
    expect(appLanguageFromSystem([{ languageCode: 'DA' }])).toBe('da');
  });

  it('uses English for every other or unavailable system language', () => {
    expect(appLanguageFromSystem([{ languageCode: 'de' }])).toBe('en');
    expect(appLanguageFromSystem([])).toBe('en');
  });
});
