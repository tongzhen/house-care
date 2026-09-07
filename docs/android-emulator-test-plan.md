# House Care Android Device Test Plan

## Purpose

Validate the same critical local-first journeys defined by the iOS simulator plan on supported Android emulators and physical devices, plus Android-specific lifecycle, permission, date-picker, calendar-intent, storage, and system-Back behavior.

## Test environment

- Primary virtual device: Pixel 10
- Primary physical device: USB-connected Pixel 8
- Orientation: portrait
- Build type: native Expo development build
- Required JDK: Android Studio bundled JDK
- Data modes: clean install and upgraded existing database
- Network dependency: none for product functionality

## Entry and exit criteria

Entry criteria:

- Android SDK, emulator, ADB, and JDK are available.
- The native Android target builds and installs.
- The JavaScript regression suite, TypeScript, lint, and catalogue validation pass.

Exit criteria:

- No blocker or critical defect remains in launch, action updates, history, persistence, Android back behavior, or device integrations.
- Every skipped case and observed warning is documented in the execution report.

## Test suites and cases

### SUITE-01 — Build, installation, launch, and lifecycle

| ID | Test case | Expected result |
|---|---|---|
| AND-001 | Build the native Android debug APK | Gradle completes without errors. |
| AND-002 | Install and launch on Pixel emulator | App installs, starts, and becomes the visible activity. |
| AND-003 | Inspect application process | House Care remains alive after initial rendering. |
| AND-004 | Inspect startup logs | No fatal exception, crash, or uncaught House Care JavaScript error appears. |
| AND-005 | Reload the JavaScript bundle | App returns to a usable screen and retains local data. |
| AND-006 | Background and resume the app | App resumes to valid state without duplicating an outcome or losing edits. |

### SUITE-02 — Primary navigation and Android Back

| ID | Test case | Expected result |
|---|---|---|
| AND-010 | Open Home | Home content and bottom navigation render. |
| AND-011 | Open Actions | Action list and category filters render. |
| AND-012 | Open History | Outcome list and filters render. |
| AND-013 | Open Settings | Settings controls render. |
| AND-014 | Open an action and return | Correct action detail opens and Android Back returns to its source. |
| AND-015 | Open an action from Home and press Android Back | Returns to Home. |
| AND-016 | Open a settings sub-screen and press Android Back | Returns to Settings after saving any deferred changes. |
| AND-017 | Press Android Back from a root tab | Follows the documented root behavior without a blank screen or crash. |

### SUITE-03 — Action state transitions

| ID | Test case | Expected result |
|---|---|---|
| AND-020 | Mark a configured action as done | Completion is added to History and the next due date changes. |
| AND-021 | Postpone until tomorrow | Snooze is recorded and the due date becomes tomorrow. |
| AND-022 | Postpone for one week | Snooze is recorded and the due date advances seven days. |
| AND-023 | Choose a custom snooze date | Native Android date picker returns the selected future date. |
| AND-024 | Reset frequency to default | Bundled frequency is restored without an update error. |
| AND-025 | Enable a disabled action | Detail updates to show Disable action and the action becomes enabled. |
| AND-026 | Tap an outcome action repeatedly | Only one outcome is recorded while the mutation is pending. |
| AND-027 | Disable the action again | Detail updates to show Enable action and the action is excluded from active scheduling. |

### SUITE-04 — Catalogue and filtering

| ID | Test case | Expected result |
|---|---|---|
| AND-030 | Filter Actions by category | Only matching actions are visible. |
| AND-031 | Open Actions overview | Enabled, disabled, and unavailable states are distinguishable. |
| AND-032 | Filter overview to Disabled | Only disabled applicable actions are shown. |

### SUITE-05 — History and issues

| ID | Test case | Expected result |
|---|---|---|
| AND-040 | Filter History to Completed | Only completed outcomes are shown. |
| AND-041 | Filter History to Issues | Only issue outcomes are shown. |
| AND-042 | Open an issue detail | Title, note, safety guidance, and available cleanup actions render. |
| AND-043 | Open new issue with an empty title | Save remains disabled. |
| AND-044 | Select a related maintenance action | Selection returns to the form and updates safety guidance. |
| AND-045 | Save a valid issue | Issue is added to History without an error. |
| AND-046 | Reload after saving an issue | Saved issue remains in History. |
| AND-047 | Delete a stale/missing issue photo | No filesystem error appears and the database photo reference is cleared. |
| AND-048 | Delete an issue with a stale/missing photo | No filesystem error appears and the issue record is deleted. |
| AND-049 | Select and remove a valid issue photo | Re-encoded app-private photo is shown and removed without an exception. |

### SUITE-06 — Settings and localization

| ID | Test case | Expected result |
|---|---|---|
| AND-050 | Switch from English to Danish | Visible Settings and tab labels update to Danish. |
| AND-051 | Switch back to English | Visible labels return to English. |
| AND-052 | Open notification settings | Schedule controls load without requiring a permission prompt. |
| AND-053 | Save valid notification timing | Setting persists even if notification reconciliation is unavailable. |
| AND-054 | Enter an invalid notification range | Validation prevents saving and explains the problem. |
| AND-055 | Edit the home profile and press Android Back | Existing profile remains intact and deferred changes save safely. |

### SUITE-07 — Android device integrations

| ID | Test case | Expected result |
|---|---|---|
| AND-060 | Open calendar event editor | Android ACTION_INSERT opens an editable event with prefilled details. |
| AND-061 | Deny notification permission | App remains usable and action updates still succeed. |
| AND-062 | Allow notification permission | Eligible future actions are scheduled once. |
| AND-063 | Deny photo permission/access | App remains usable and presents a clear error. |
| AND-064 | Allow photo selection | Selected image is copied to app-private storage without metadata. |
| AND-065 | Notification API unavailable | Action and settings changes remain successful; reconciliation is deferred. |

### SUITE-08 — Reset, backup, and restore

| ID | Test case | Expected result |
|---|---|---|
| AND-070 | Cancel full reset | No data changes. |
| AND-071 | Confirm full reset | Profile, action state, history, settings, and owned photos are cleared. |
| AND-072 | Export local backup | Android share sheet opens with a versioned archive. |
| AND-073 | Cancel backup import | Existing data remains unchanged. |
| AND-074 | Import invalid backup | Validation error appears and existing data remains unchanged. |

## Evidence and result recording

Record the commit, device model and serial type, Android/API version, JDK, build/install result, process/activity state, filtered logs, per-case status, defects, and emulator/physical-device warnings in `docs/test-reports/YYYY-MM-DD-android-emulator.md`.
