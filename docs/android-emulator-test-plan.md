# House Care Android Emulator Test Plan

## Purpose

Validate the critical local-first House Care journeys on a supported Android emulator, including Android-specific lifecycle, permission, date-picker, notification, calendar-intent, storage, and back-navigation behavior.

## Test environment

- Primary virtual device: Pixel 10
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

### SUITE-02 — Primary navigation and Android back

| ID | Test case | Expected result |
|---|---|---|
| AND-010 | Open Home, Actions, History, and Settings | Each tab renders the correct content. |
| AND-011 | Open an action from Home and press system Back | Returns to Home. |
| AND-012 | Open an action from Actions and press system Back | Returns to Actions. |
| AND-013 | Open a settings sub-screen and press system Back | Returns to Settings. |
| AND-014 | Press system Back from a root tab | Follows the documented app/root behavior without showing a blank screen. |

### SUITE-03 — Action state transitions

| ID | Test case | Expected result |
|---|---|---|
| AND-020 | Mark a configured action as done | Completion is added to History and the next due date changes. |
| AND-021 | Postpone until tomorrow | Snooze is recorded and the due date becomes tomorrow. |
| AND-022 | Postpone for one week | Snooze is recorded and the due date advances seven days. |
| AND-023 | Choose a custom snooze date | Native Android date picker returns the selected future date. |
| AND-024 | Reset frequency to default | Bundled frequency is restored without an update error. |
| AND-025 | Enable and disable an action | State changes immediately and persists after reload. |
| AND-026 | Tap an outcome action repeatedly | Only one outcome is recorded while the mutation is pending. |

### SUITE-04 — Catalogue and filtering

| ID | Test case | Expected result |
|---|---|---|
| AND-030 | Filter Actions by category | Only matching actions are visible. |
| AND-031 | Open Actions overview | Enabled, disabled, and unavailable states are distinguishable. |
| AND-032 | Filter overview by enabled/disabled state | Only matching applicable actions remain visible. |

### SUITE-05 — History and issues

| ID | Test case | Expected result |
|---|---|---|
| AND-040 | Filter History to Completed, Snoozed, and Issues | Each filter shows only matching outcomes. |
| AND-041 | Open an issue detail | Title, note, safety guidance, and cleanup actions render. |
| AND-042 | Open new issue with empty title | Save remains disabled. |
| AND-043 | Select a related action | Selection and corresponding safety guidance update correctly. |
| AND-044 | Save a valid issue | Issue appears in History and survives reload. |
| AND-045 | Select and remove an issue photo | Re-encoded app-private photo is shown and removed without an exception. |
| AND-046 | Delete an issue whose photo is stale/missing | Record is deleted without a filesystem exception. |

### SUITE-06 — Settings and localization

| ID | Test case | Expected result |
|---|---|---|
| AND-050 | Switch English to Danish and back | Visible copy updates and the choice persists. |
| AND-051 | Open and save notification timing | Valid timing persists without requiring scheduler success. |
| AND-052 | Enter an invalid notification range | Validation prevents saving and explains the problem. |
| AND-053 | Edit the home profile and press system Back | Existing profile remains intact. |

### SUITE-07 — Android device integrations

| ID | Test case | Expected result |
|---|---|---|
| AND-060 | Open calendar event editor | Android ACTION_INSERT opens an editable event with prefilled details. |
| AND-061 | Deny notification permission | App remains usable and action updates still succeed. |
| AND-062 | Allow notification permission | Eligible future actions are scheduled once. |
| AND-063 | Deny photo permission/access | App remains usable and presents a clear error. |
| AND-064 | Allow photo selection | Selected image is copied to app-private storage without metadata. |

### SUITE-08 — Reset, backup, and restore

| ID | Test case | Expected result |
|---|---|---|
| AND-070 | Cancel full reset | No data changes. |
| AND-071 | Confirm full reset | Profile, action state, history, settings, and owned photos are cleared. |
| AND-072 | Export local backup | Android share sheet opens with a versioned archive. |
| AND-073 | Cancel backup import | Existing data remains unchanged. |
| AND-074 | Import invalid backup | Validation error appears and existing data remains unchanged. |

## Evidence and result recording

Record the commit, AVD, Android/API version, JDK, Gradle build result, application process/activity state, filtered log result, per-case status, defects, and emulator-only warnings in `docs/test-reports/YYYY-MM-DD-android-emulator.md`.

