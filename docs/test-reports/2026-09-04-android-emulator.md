# House Care Android Emulator Test Report — 4 September 2026

## Summary

Result: **NATIVE BUILD AND LAUNCH PASS; UI EXECUTION BLOCKED BY CONTROL SURFACE**

- Planned emulator cases: 42
- Executed emulator/build cases: 4
- Passed: 4
- Failed: 0
- Blocked/not executed: 38
- Automated regression result: 97/97 tests passed on the same source revision
- Blocker or critical app defects observed: 0

The Android APK built, installed, launched, remained alive, and became the visible fullscreen activity. The standalone Android emulator window was not exposed to the available desktop accessibility controller, and the repository has no Maestro or Android instrumentation suite. UI cases are therefore marked Blocked rather than reported as unverified passes.

## Environment

| Item | Value |
|---|---|
| Branch | `codex/deferred-settings-and-swipe-back` |
| Tested commit | `d5289af` plus Android test documentation |
| AVD | Pixel 10 |
| Android version | Android 17 |
| API level | 37 |
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

## Blocked cases

The remaining 38 cases were not executed. The reason is test-control infrastructure, not an observed application failure:

- The standalone Android emulator is not available through the desktop accessibility automation surface.
- No Maestro executable or checked-in Maestro flow exists.
- No Android instrumentation/UI test target exists.

The next complete Android UI pass should first add a reproducible Maestro suite for the critical journeys, then execute it against this AVD. Destructive reset/delete cases and OS permission changes should run on a disposable seeded emulator snapshot.

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

## Cross-platform regression risks to execute next

- Done, Postpone, Reset to default, Enable, and Disable against a legacy upgraded database.
- Android custom-date picker behavior and system Back navigation.
- Android calendar ACTION_INSERT intent.
- Notification permission denied/allowed behavior.
- Photo selection, stale-photo cleanup, and issue deletion.
- The iOS-discovered related-action picker schedule-label defect (HC-IOS-001) is shared React Native UI code and is expected to affect Android until corrected.
