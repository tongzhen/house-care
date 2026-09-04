# House Care iOS Simulator Test Report — 4 September 2026

## Summary

Result: **PASS WITH ONE OPEN UI DEFECT**

- Executed: 25 simulator cases
- Passed: 24
- Failed: 1
- Blocked/not executed from the full plan: 15
- Automated regression result: 97/97 tests passed
- Blocker or critical defects: 0
- Open defects: 1 medium-priority presentation defect

The original action-update regression did not reproduce after the database migration fix. Done, Postpone, Reset to default, Enable, and Disable completed successfully in the simulator.

## Environment

| Item | Value |
|---|---|
| Branch | `codex/deferred-settings-and-swipe-back` |
| Tested commit | `d5289af` plus test-plan/report documentation |
| Simulator | iPhone 17 Pro (`A2E79AC7-3437-4A8C-8E36-1F9EFFD7C297`) |
| Runtime | iOS 26.5 |
| Xcode | 26.6 (17F113) |
| App identifier | `com.housecare.app` |
| Date | 4 September 2026 |

## Execution results

| ID | Result | Observed result |
|---|---|---|
| IOS-001 | PASS | Native target built successfully after correcting EventKit delegate compatibility. |
| IOS-002 | PASS | App installed and opened on iPhone 17 Pro. |
| IOS-003 | PASS | Metro reload completed and returned to Home. |
| IOS-004 | PASS | No House Care uncaught promise/filesystem exception appeared after the corrected reload. Simulator UIKit/CoreHaptics warnings were non-application noise. |
| IOS-010 | PASS | Home rendered current/upcoming/habit sections and all four tabs. |
| IOS-011 | PASS | Actions rendered the catalogue and category filters. |
| IOS-012 | PASS | History rendered outcomes and filters. |
| IOS-013 | PASS | Settings rendered profile, actions, notifications, language, backup, reset, legal, and debug entries. |
| IOS-014 | PASS | Dishwasher and floor-drain details opened and returned to their source screens. |
| IOS-020 | PASS | Clean dishwasher filter was marked complete; History showed `Completed · 4 Sep 2026`. |
| IOS-021 | PASS | Clean dishwasher filter was postponed; Actions showed a due date of `5 Sep 2026` and History recorded the snooze. |
| IOS-022 | PASS | Reset to default completed without an error and showed the bundled one-month frequency. |
| IOS-023 | PASS | Disabled floor-drain action changed from `Enable action` to `Disable action`. |
| IOS-024 | PASS | Floor-drain action was restored to disabled and changed back to `Enable action`. |
| IOS-031 | PASS | Actions overview displayed enabled, disabled, and unavailable actions. |
| IOS-032 | PASS | Disabled filter displayed only the disabled floor-drain action. |
| IOS-040 | PASS | Completed filter displayed only completed outcomes. |
| IOS-041 | PASS | Issues filter displayed only issue outcomes. |
| IOS-042 | PASS | Existing issue detail displayed title, note, escalation guidance, Delete photo, and Delete issue. |
| IOS-043 | PASS | New issue Save control remained disabled with an empty title. |
| IOS-044 | FAIL | Related action selection worked, but all picker rows incorrectly displayed `After each use` instead of their actual schedule. See HC-IOS-001. |
| IOS-045 | PASS | Created `Simulator regression test`, related to Clean the dishwasher filter; it appeared in History. |
| IOS-046 | PASS | `Simulator regression test` remained in History after a full Metro reload. |
| IOS-050 | PASS | Settings and tab labels changed to Danish. |
| IOS-051 | PASS | Language returned to English successfully. |

## Cases not executed

The following cases remain for a dedicated integration pass:

- IOS-025 and IOS-030: require timed multi-input/category coverage.
- IOS-047 and IOS-048: destructive simulator actions were not confirmed; the stale-file behavior is covered by automated tests.
- IOS-052 and IOS-053: notification-settings UI was not exercised in this pass.
- IOS-060: calendar editor was compile-validated but not opened/saved through the system UI.
- IOS-061 and IOS-062: OS photo permission/selection states were not changed.
- IOS-063: notification unavailability is covered by application-service tests.
- IOS-070 through IOS-074: destructive reset and backup/import scenarios were not run in this data-bearing simulator.

## Defects

### HC-IOS-001 — Related-action picker shows incorrect schedule text

- Severity: Medium
- Status: Open
- Area: New issue → Related maintenance action
- Steps:
  1. Open Home.
  2. Tap Report an issue.
  3. Tap Related maintenance action.
- Actual: Recurring and seasonal action rows display `After each use`.
- Expected: Each row displays its configured due date/frequency, or schedule copy should be omitted from this picker.
- Impact: The selection succeeds, but schedule information is misleading.

## Automated verification

| Command | Result |
|---|---|
| `npm test` | PASS — 17 suites, 97 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| Native `npm run ios -- --device "iPhone 17 Pro"` | PASS — 0 errors, 1 duplicate-library warning |

## Changes validated during this run

- Legacy action configuration migration adds `notifications_enabled` before action upserts.
- EventKit editor delegate compiles on Xcode 26.
- Missing/stale issue photos no longer throw through persisted cleanup flows.
- Database cleanup continues even if physical photo cleanup cannot complete.
