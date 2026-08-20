import { getLocales, type Locale } from 'expo-localization';

export type AppLanguage = 'en' | 'da';

export function appLanguageFromSystem(locales: readonly Pick<Locale, 'languageCode'>[]): AppLanguage {
  return locales[0]?.languageCode?.toLowerCase() === 'da' ? 'da' : 'en';
}

export function defaultAppLanguage(): AppLanguage {
  return appLanguageFromSystem(getLocales());
}
