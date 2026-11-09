import source from '../../knowledge-base/maintenance-actions-v0.1.json';
import { catalogSchema, parseCatalog } from '../catalogSchema';

describe('maintenance catalogue validation', () => {
  it('accepts the bundled maintenance catalogue', () => {
    const catalog = parseCatalog(source);

    expect(catalog.actions).toHaveLength(21);
    expect(catalog.actions.every((action) => action.content.da !== null)).toBe(true);
  });

  it('rejects missing seasonal schedules, invalid dates and mismatched seasons', () => {
    const original = source.actions.find((action) => action.id === 'gutters-ground-check')!;
    for (const seasonalDates of [undefined, [{ season: 'spring', month: 2, day: 31 }], [{ season: 'winter', month: 3, day: 1 }]]) {
      const invalid = { ...source, actions: [{ ...original, trigger: { ...original.trigger, seasonalDates } }] };
      expect(catalogSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it('rejects duplicate action IDs', () => {
    const duplicateIdCatalog = {
      ...source,
      actions: [source.actions[0], { ...source.actions[1], id: source.actions[0].id }],
    };

    expect(catalogSchema.safeParse(duplicateIdCatalog).success).toBe(false);
  });

  it('rejects incomplete action content', () => {
    const incompleteCatalog = {
      ...source,
      actions: [{ ...source.actions[0], content: { ...source.actions[0].content, en: { ...source.actions[0].content.en, title: '' } } }],
    };

    expect(catalogSchema.safeParse(incompleteCatalog).success).toBe(false);
  });

  it('rejects an action without Danish localization', () => {
    const untranslatedCatalog = {
      ...source,
      actions: [{ ...source.actions[0], content: { ...source.actions[0].content, da: null } }],
    };

    expect(catalogSchema.safeParse(untranslatedCatalog).success).toBe(false);
  });

  it.each(['en', 'da'] as const)('rejects incomplete explanation fields in %s', (language) => {
    for (const field of ['delayConsequences', 'priorityReason', 'careGuidance']) {
      for (const value of [undefined, '', '   ']) {
        const action = source.actions[0];
        const invalid = { ...action, content: { ...action.content, [language]: { ...action.content[language], [field]: value } } };
        expect(catalogSchema.safeParse({ ...source, actions: [invalid] }).success).toBe(false);
      }
    }
  });

  it('rejects missing or unsupported priorities and incomplete sources', () => {
    const action = source.actions[0];
    const reference = action.sources[0];
    for (const patch of [
      { priority: undefined }, { priority: 'urgent' }, { sources: [] },
      { sources: [reference.url] }, { sources: [{ ...reference, url: 'invalid' }] },
      { sources: [{ ...reference, url: 'javascript:alert(1)' }] },
      { sources: [{ ...reference, title: ' ' }] }, { sources: [{ ...reference, publisher: '' }] },
    ]) {
      expect(catalogSchema.safeParse({ ...source, actions: [{ ...action, ...patch }] }).success).toBe(false);
    }
  });
});
