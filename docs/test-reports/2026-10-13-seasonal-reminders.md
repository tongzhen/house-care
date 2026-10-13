# Seasonal scheduling and checklist — 13 October 2026

## Implemented behaviour

HouseCare now schedules the four existing seasonal actions on a fixed Denmark
calendar: gutter inspection on 1 March and 1 September, accessible gutter debris
care on 1 March and 1 November, outdoor-tap frost preparation on 1 October, and
underfloor-heating checks on 1 September. Calendar prompts do not predict frost
or leaf fall; task instructions and actual conditions still apply.

The Checklist layout is available from Home and Actions. Spring, Summer, Autumn
and Winter tabs show applicable tasks; the current season also includes unfinished
checks carried over from previous seasons. Completion moves the action to its next
calendar occurrence, and completed rows identify the last completion and next date.
Snooze moves the current reminder without shifting future seasonal dates. Reporting
an issue leaves the action outstanding. Interval overrides retain regular scheduling;
users can restore the seasonal default from task details.

Grouped local notifications open the checklist on warm or cold launch. The scheduler
queues up to twelve months of seasonal occurrences, respects notification preferences,
preserves unchanged pending notifications, and keeps a persisted attempt ledger to
avoid repeated catch-up alerts. Passed attempts are not proof of delivery or viewing.
There is one outstanding task row per action even when several calendar occurrences
have elapsed. Tasks remain usable without notifications, weather or a postal code.

Existing configurations migrate on load while preserving disabled state, overrides,
snooze and history. Backup version 5 includes seasonal state and reminder attempts;
version 3 and 4 imports remain accepted. Ledger writes update only reminder metadata,
so they cannot overwrite a task completion or snooze.

## Validation

- All 24 automated test suites passed: 174 tests.
- TypeScript, lint, catalogue validation (included in the suite), licence-notice
  verification and diff whitespace checks passed.
- iOS Debug simulator build passed, including a signed build for native validation.
- Android Debug build passed using the cached dependencies and arm64 target.
- The `08-seasonal-checklist.yaml` Maestro flow passed on iPhone 17 Pro / iOS 26.5:
  setup without a postal code; open the checklist from Actions; complete the outdoor
  tap task; verify the completed row; snooze underfloor heating; verify its snoozed row.
- Simulator persistence confirmed the outdoor-tap completion advances to 1 October
  2027, while unfinished September checks and future calendar reminder attempts remain.
- Automated cases cover migration, old/new backup manifests, late/early completion,
  year rollover, local-time reconstruction, custom intervals, disabled actions,
  notification permission denial, allowed time windows, grouped alerts, duplicate
  prevention, partial scheduling failure, missing future notifications after restore,
  and cold/warm notification navigation.

Initial native runs exposed an unsigned-simulator notification-keychain error and
incomplete accessibility labels on grouped rows. Simulator signing resolved the
former; explicit entry labels and completion-history labels resolved the latter.
The final native flow passed after both corrections.

## Limits

No Android emulator was running, so Android UI interactions were not exercised.
No physical-device notification delivery or tap was tested; notification routing is
covered by automated tests. Local reminders are queued for twelve months and are
replenished when the app opens. Device-local time matches existing reminder behaviour.
No backend, forecast-triggered alerts, repeated overdue nags or new maintenance actions
were added.
