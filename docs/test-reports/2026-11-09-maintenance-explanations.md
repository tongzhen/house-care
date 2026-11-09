# Maintenance explanations verification — 9 November 2026

## Change

All 21 catalogue actions have curated priority, priority reason, delay consequences,
and DIY/professional guidance in English and Danish. Task details expose all existing
safety restrictions and a named sources/manual section. No user-data migration,
scheduling change, automatic priority escalation, or generated technical advice.
Source review and editorial criteria are documented in `knowledge-base/README.md`.

## Automated verification

- `npm test`: 29 suites / 224 tests passed. Includes service outcomes, scheduling,
  persistence, backup/report compatibility, seasonal/weather routing and navigation.
- `npm run validate:catalog`: passed (8 tests). Both languages require complete new
  content; missing/invalid priorities, empty/malformed sources, unsafe URL schemes,
  and incomplete source attribution are rejected.
- `npm run typecheck`, `npm run lint`: passed.
- Prettier on the new component and component tests; `git diff --check`: passed.
- New component coverage: complete guidance in both languages; fixed priority for
  overdue/snoozed tasks; exact source URL opening only on request; localized link
  failure without losing guidance; no priority badges on Home or action cards.
- Compared the updated catalogue with main: all 21 IDs, schedules, eligibility,
  estimated durations, safety levels, and all previous bilingual content preserved.

## Device checks

- iPhone 17 Pro simulator, iOS 26.5: the new
  `maestro/flows/09-maintenance-explanations.yaml` passed in English and Danish.
- Pixel 10 emulator: the same bilingual detail flow passed using a temporary copy
  without `clearState` after clearing the test app and restoring its local debug
  server preference. The installed Android debug binary cannot locate Metro after
  its preferences are cleared; initial clean-install navigation runs failed at
  bundle loading, before the feature screen. No production networking was changed.
- Both flows check priority, purpose, delay consequences, DIY guidance, safety
  restrictions, source attribution, and reachable completion controls.
- A separate iOS gutter detail check passed for high priority, risk explanation,
  safety restrictions, named Bolius source and reachable completion control.
- English/Danish detail flows also passed at iOS `accessibility-medium` and Android
  font scale 1.3. Screenshots were inspected. The initial iOS English delay sentence
  exposed a line-breaking issue at accessibility size; the explanation body now
  adds a trailing line break on iOS to reserve room for the final rendered line.
  A fresh-launch screenshot confirmed the full English explanation at accessibility
  size after this fix; guidance has no line-count limit.

## Limits

Checks use existing development builds, not a fresh signed release or physical
hardware. External source success/failure is mocked in component tests; websites
were reviewed separately for content, not opened by the device flows. Professional
trade review flags in the catalogue documentation remain applicable before pilot
release. Text-size changes are restored after device checks.
