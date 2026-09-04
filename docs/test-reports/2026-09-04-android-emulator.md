# House Care Android Emulator Test Report — 4 September 2026

## Summary

Result: **PASS WITH ONE ANDROID TEST-LIFECYCLE DEFECT**

- Planned Android cases: 52
- Executed device/build cases: 23
- Passed: 21
- Failed: 1
- Partial: 1
- Blocked/not executed: 29
- Automated regression result: 97/97 tests passed on the same source revision
- Blocker or critical app defects observed: 0

The Android APK built, installed, launched, remained alive, and became the visible fullscreen activity. Maestro 2.10.0 executed six suites across the Pixel 10 emulator and USB Pixel 8. Action updates, navigation, catalogue filtering, localization, notification settings, and reset passed. The expanded issue flow exposed an Expo SQLite native-handle failure after repeated Maestro `clearState` operations; issue persistence after that condition remains unverified. See HC-AND-001.

## Environment

| Item | Value |
|---|---|
| Branch | `codex/deferred-settings-and-swipe-back` |
| Tested revision | `b8db88b` plus the Android-plan/flow changes in this report |
| AVD | Pixel 10 |
| Android version | Android 17 |
| API level | 37 |
| Physical device | Pixel 8 (`39031FDJH00206`, USB) |
| Physical Android/API | Android 16 / API 36 |
| Compile/target SDK | 36 / 36 |
| Emulator ABI | arm64-v8a |
| App identifier | `com.housecare.app` |
| JDK | Android Studio bundled JDK |
| Date | 4 September 2026 |

## Execution results

| ID | Result | Observed result |
|---|---|---|
| AND-001 | PASS | Gradle completed successfully: 361 tasks, 27 executed and 334 up-to-date. |
| AND-002 | PASS | Debug APK installed and House Care launched on Pixel 10 using Metro port 8082. |
| AND-003 | PASS | App process remained active (`pid 12280`) and its task was visible, fullscreen, and requested visible. |
| AND-004 | PASS WITH WARNING | No fatal crash or uncaught React Native JavaScript error appeared. One startup-only React Native soft exception occurred before context initialization; `Running "main"` followed normally. |
| AND-010 | PASS | Home content and bottom navigation rendered after clean onboarding. |
| AND-011 | PASS | Actions rendered its catalogue and category filters. |
| AND-012 | PASS | History rendered its outcome filters. |
| AND-013 | PASS | Settings rendered profile, actions, notifications, language, backup, reset, legal, and debug controls. |
| AND-014 | PASS | Floor-drain detail opened from Actions and Android Back returned to Actions. |
| AND-016 | PASS | Android Back returned from Actions overview and Notification settings to Settings. |
| AND-020 | PASS | Maestro marked Clean the dishwasher filter complete and verified the Completed record in History without an update error. |
| AND-021 | PASS | Maestro postponed Clean the dishwasher filter until tomorrow and verified the Snoozed record in History without an update error. |
| AND-024 | PASS | Maestro changed the action frequency to three months, reset it, and verified the one-month default without an update error. |
| AND-030 | PASS | Drainage filtering showed the floor-drain action and excluded the dishwasher action. |
| AND-031 | PASS | Actions overview rendered status controls and unavailable actions. |
| AND-040 | PASS | Completed history rendered the completed dishwasher outcome. |
| AND-043 | PARTIAL | Empty issue form rendered with required-title copy; Android accessibility did not expose the disabled Save control as an actionable node. |
| AND-045 | FAIL | A valid standalone issue reached Save, then displayed `The issue could not be saved` after Expo SQLite `NativeDatabase.execAsync` rejected with a native `NullPointerException`. See HC-AND-001. |
| AND-050 | PASS | Settings and tab labels switched to Danish. |
| AND-051 | PASS | Labels switched back to English. |
| AND-052 | PASS | Notification schedule and weekday controls opened without a new permission prompt. |
| AND-053 | PASS | Android Back saved the unchanged valid notification schedule and returned to Settings. |
| AND-070 | PASS | Cancelling Reset app data preserved Settings and the profile. |
| AND-071 | PASS | Confirming reset returned to fresh onboarding. |

## Remaining cases

The remaining 29 cases were not executed in this pass. Photo picker/permission, calendar, backup/share-sheet, invalid-import, custom date/time picker, duplicate-tap timing, legacy seeded database, and unavailable-device-service cases require dedicated device state or test fixtures.

- No Android instrumentation/UI test target exists.
- Device integrations and destructive file/import scenarios need controlled fixtures beyond the current Maestro flows.

The next pass should isolate each destructive `clearState` run at the process/device level before expanding photo, calendar, backup, and seeded legacy-database coverage.

## Defects

### HC-AND-001 — Expo SQLite handle fails after repeated Maestro clear-state cycles

- Severity: Medium for test reliability; production impact not established
- Status: Open
- Area: Android native SQLite lifecycle under external application-data clearing
- Evidence: Metro reported `NativeDatabase.execAsync` rejected with `java.lang.NullPointerException`; the valid issue was not inserted into `task_outcomes`.
- Reproduction context: USB Pixel 8 after several independent Maestro flows used `launchApp.clearState: true` against the same development process.
- Control evidence: Clean-start action mutations and SQLite transactions passed on both Pixel 10 and Pixel 8; database integrity remained `ok`.
- Impact: The issue suite cannot reliably validate AND-041 through AND-048 after repeated external data clears. A normal in-app reset uses SQL deletion rather than Android package-data clearing and passed AND-071.

## Observations

### ENV-ANDROID-001 — JDK is installed but not globally discoverable

- Severity: Environment setup
- The initial `npm run android` failed because no Java runtime was on the shell path.
- The build succeeded when `JAVA_HOME` pointed to `/Applications/Android Studio.app/Contents/jbr/Contents/Home`.
- Recommendation: document or configure the Android Studio JDK for local Android development.

### ENV-ANDROID-002 — Software graphics fallback

- Severity: Informational
- The emulator selected software GL due to host memory pressure.
- Impact: slower UI rendering; no correctness failure observed.

### ENV-ANDROID-003 — React Native startup soft exception

- Severity: Low/informational pending reproduction
- Log: `Tried to access onWindowFocusChange while context is not ready`.
- The exception was non-fatal and occurred before the JavaScript main application started.
- Recommendation: monitor on repeated cold launches and future React Native/Expo upgrades.

## Automated and build verification

| Command | Result |
|---|---|
| `npm test` | PASS — 17 suites, 97 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run android -- --port 8082` | PASS |
| ADB process/activity inspection | PASS |
| Filtered app log inspection | PASS WITH STARTUP WARNING |
| Pixel 10 `npm run e2e:android` | PASS — 3/3 action-regression flows |
| Pixel 8 action flows | PASS — 3/3 |
| Pixel 8 navigation/catalogue flow | PASS |
| Pixel 8 settings/localization/reset flow | PASS |
| Pixel 8 history/issues flow | FAIL at standalone issue persistence; earlier completion steps passed |

## Cross-platform regression risks to execute next

- Enable and Disable against a legacy upgraded database. The new clean-install Maestro flows cover Done, Postpone, and Reset to default; a seeded legacy-database flow remains to be added.
- Android custom-date picker behavior and system Back navigation.
- Android calendar ACTION_INSERT intent.
- Notification permission denied/allowed behavior.
- Photo selection, stale-photo cleanup, and issue deletion.
- HC-IOS-001 was fixed in shared React Native UI code and regression-tested on iOS; Android picker coverage remains to be added.
