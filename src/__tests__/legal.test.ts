import { legalDocuments, legalSiteUrl } from '../legal';

describe('offline legal documents', () => {
  it('provides every required document in English and Danish with canonical public URLs', () => {
    for (const language of ['en', 'da'] as const) {
      for (const id of ['privacy', 'terms', 'acknowledgements', 'permissions'] as const) {
        const document = legalDocuments[language][id];
        expect(document.version).toBeTruthy();
        expect(document.updated).toBeTruthy();
        expect(document.url.startsWith(legalSiteUrl)).toBe(true);
        expect(document.sections.length).toBeGreaterThan(0);
      }
    }
  });
});
