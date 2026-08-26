import source from '../../knowledge-base/maintenance-actions-v0.1.json';
import { catalogSchema, parseCatalog } from '../catalogSchema';

describe('maintenance catalogue validation', () => {
  it('accepts the bundled maintenance catalogue', () => {
    const catalog = parseCatalog(source);

    expect(catalog.actions).toHaveLength(21);
    expect(catalog.actions.every((action) => action.content.da !== null)).toBe(true);
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
});
