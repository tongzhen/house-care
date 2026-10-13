# Editor exit regression checks — 13 October 2026

## Findings and fixes

The root native stack could dismiss Home Profile with its own back gesture, bypassing the editor's save-on-exit handler. Notification Settings had the same gap. Native gestures are now disabled on those editors so their existing edge-swipe handlers control the exit. A shared route guard also sends system/router removal attempts through the editor's save handler and allows navigation only after a successful save. Failed or invalid saves keep the editor open. Repeated exit attempts during a pending save are ignored.

The review found related gaps in issue creation and custom frequency editing. Issue cancellation now runs photo cleanup and resets the draft before navigation on system-back as well as swipe/button exits. Issue and custom-frequency editors cannot exit during a pending save. Custom frequency still uses its explicit Save frequency button; backing out of an unsaved draft cancels it. Duplicate legacy swipe wrappers that bypassed editor handlers were removed.

Other reviewed screens either persist each change immediately (action settings and language), hold an intentional temporary selection (report export), or have no editable draft. First-time setup retains its existing step-back behavior.

## Automated checks

- All 19 Jest suites passed: 133 tests.
- TypeScript, lint, and diff whitespace checks passed.
- Navigation regression cases cover the latest profile draft, edge swipe, system-back, delayed saves, duplicate exit attempts, invalid drafts, save failure and retry, notification timing, issue-photo cleanup, and issue/custom-frequency exits during pending saves.

## Native checks

Device: iPhone 17 Pro simulator, iOS 26.5. The final related Maestro run passed all four flows in 1 minute 48 seconds:

- `04-navigation-and-catalogue.yaml`
- `05-history-and-issues.yaml`
- `06-settings-localization-and-reset.yaml`
- `08-editor-swipe-save.yaml`

The new flow edits the profile, swipes back, verifies the new washing-machine actions, relaunches the app, and verifies those actions again. It also changes Monday's notification preference and swipes back, then cancels an issue draft with an edge swipe while the keyboard is visible and verifies that reopening the form shows an empty draft.

A read of the simulator's test database after the final run confirmed dishwasher and washing machine in the saved profile, notifications enabled with Monday disabled, and no saved issue titled `Draft cancelled by swipe`.

Earlier attempts required corrections to test selectors (`washing-machine` in action titles) and the iOS keyboard-dismiss command. The final flow performs the swipe above the keyboard and passed.

No physical-device or Android emulator run was performed. System-back/removal behavior is covered by automated route tests. The local app server was stopped after testing.
