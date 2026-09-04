# House Care iOS Simulator Test Plan

## Purpose

Validate the critical local-first user journeys on a supported iPhone simulator, with special emphasis on persistence and regressions affecting action updates.

## Test environment

- Platform: iOS Simulator
- Primary device: iPhone 17 Pro
- Orientation: portrait
- Build type: native Expo development build
- Data mode: existing upgraded local database, followed by reload checks
- Network dependency: none for product functionality

## Entry and exit criteria

Entry criteria:

- Dependencies install successfully.
- The native iOS target builds and launches.
- The bundled catalogue validates.

Exit criteria:

- No blocker or critical defect remains in launch, action update, history, or persistence flows.
- All automated tests, TypeScript checks, and lint checks pass.
- Any skipped simulator case and every observed defect is documented in the execution report.

## Test suites and cases

### SUITE-01 — Build, launch, and recovery

| ID | Test case | Expected result |
|---|---|---|
| IOS-001 | Build the native iOS target | Build completes without errors. |
| IOS-002 | Launch on iPhone simulator | App opens to a valid application screen without a fatal overlay. |
| IOS-003 | Reload the JavaScript bundle | App reloads and returns to a usable screen. |
| IOS-004 | Inspect runtime console after reload | No uncaught application promise or filesystem exception appears. |

### SUITE-02 — Primary navigation

| ID | Test case | Expected result |
|---|---|---|
| IOS-010 | Open Home | Home content and bottom navigation render. |
| IOS-011 | Open Actions | Action list and category filters render. |
| IOS-012 | Open History | Outcome list and filters render. |
| IOS-013 | Open Settings | Settings controls render. |
| IOS-014 | Open an action and return | Correct action detail opens and Back returns to its source. |

### SUITE-03 — Action state transitions

| ID | Test case | Expected result |
|---|---|---|
| IOS-020 | Mark a configured action as done | No error appears; completion is appended to History and next due date changes. |
| IOS-021 | Postpone an action until tomorrow | No error appears; snooze history is appended and due date becomes tomorrow. |
| IOS-022 | Reset frequency to default | No error appears; bundled frequency is restored. |
| IOS-023 | Enable a disabled action | Detail updates to show Disable action and the action becomes enabled. |
| IOS-024 | Disable the action again | Detail updates to show Enable action and the action is excluded from active scheduling. |
| IOS-025 | Prevent duplicate outcome submissions | Controls are disabled while an outcome mutation is pending. |

### SUITE-04 — Action catalogue and filtering

| ID | Test case | Expected result |
|---|---|---|
| IOS-030 | Filter Actions by category | Only matching actions remain visible. |
| IOS-031 | Open Actions overview | Applicable, unavailable, enabled, and disabled states are distinguishable. |
| IOS-032 | Filter overview to Disabled | Only disabled applicable actions are shown. |

### SUITE-05 — History and issues

| ID | Test case | Expected result |
|---|---|---|
| IOS-040 | Filter History to Completed | Only completed outcomes are shown. |
| IOS-041 | Filter History to Issues | Only issue outcomes are shown. |
| IOS-042 | Open an issue detail | Title, note, safety guidance, and available cleanup actions render. |
| IOS-043 | Open new issue form with an empty title | Save remains disabled. |
| IOS-044 | Select a related maintenance action | Selection returns to the form and updates safety guidance. |
| IOS-045 | Save a valid issue | Issue is added to History without an error. |
| IOS-046 | Reload after saving an issue | Saved issue remains in History. |
| IOS-047 | Delete a stale/missing issue photo | No filesystem error appears and the database photo reference is cleared. |
| IOS-048 | Delete an issue with a stale/missing photo | No filesystem error appears and the issue record is deleted. |

### SUITE-06 — Settings and localization

| ID | Test case | Expected result |
|---|---|---|
| IOS-050 | Switch from English to Danish | Visible Settings and tab labels update to Danish. |
| IOS-051 | Switch back to English | Visible labels return to English. |
| IOS-052 | Open notification settings | Schedule controls load without requiring notification permission. |
| IOS-053 | Save valid notification timing | Setting persists even if notification reconciliation is unavailable. |

### SUITE-07 — Device integrations

| ID | Test case | Expected result |
|---|---|---|
| IOS-060 | Open calendar event editor | Native EventKit editor opens with action title, time, duration, and notes. |
| IOS-061 | Deny photo permission | App remains usable and presents a clear failure state. |
| IOS-062 | Allow photo selection | Selected image is re-encoded into app-private storage without metadata. |
| IOS-063 | Notification API unavailable | Action and settings changes remain successful; reconciliation is deferred. |

### SUITE-08 — Reset, backup, and restore

| ID | Test case | Expected result |
|---|---|---|
| IOS-070 | Cancel full app reset | No data changes. |
| IOS-071 | Confirm full app reset | Profile, configurations, history, settings, and app-owned photos are cleared. |
| IOS-072 | Export local backup | Share sheet opens with a valid versioned archive. |
| IOS-073 | Cancel backup import | Existing data remains unchanged. |
| IOS-074 | Import an invalid backup | Validation error appears and existing data remains unchanged. |

## Evidence and result recording

For each run, record the commit, simulator/runtime, build result, case status, observed result, defect identifier, and any simulator-only warning. Use `docs/test-reports/YYYY-MM-DD-ios-simulator.md`.

