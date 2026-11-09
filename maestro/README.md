# Maestro end-to-end tests

These flows exercise House Care as a black-box app on an Android emulator, physical Android device, or iOS simulator. They cover action mutations, primary navigation, catalogue filtering, history and issues, localization, notification settings, and reset behavior. Each flow clears only House Care application data and creates its own profile.

## Prerequisites

- Maestro CLI 2.10 or newer.
- Java 17 or newer. The project runner automatically uses Android Studio's bundled JDK or Homebrew OpenJDK when `JAVA_HOME` is unset.
- A running emulator/simulator with a current `com.housecare.app` development build installed.
- Metro running for a development build.

Install Maestro on macOS with:

```sh
brew tap mobile-dev-inc/tap
brew install mobile-dev-inc/tap/maestro
```

## Run

```sh
npm run e2e:android
npm run e2e:ios
```

Use `npm run e2e:maestro` when only one supported device is connected. Run a single flow while developing with:

```sh
./scripts/run-maestro.sh --platform android test maestro/flows/01-reset-frequency.yaml
```

When multiple Android devices are connected, target one by ADB serial:

```sh
./scripts/run-maestro.sh --device DEVICE_SERIAL --platform android test maestro/flows
```

The flows use English visible text because English is the clean-install default. Prefer stable React Native `testID` selectors when flows begin covering localized screens or duplicate labels.

The current local setup intentionally does not alter GitHub Actions or EAS Workflows. CI device execution should be added separately after deciding whether builds will run on EAS Workflows or another emulator runner.

`09-maintenance-explanations.yaml` checks the task-detail priority, purpose, delay
consequences, DIY guidance, safety restrictions, sources and completion control
in English and Danish. It returns the test installation to English. External
source-opening success and failure are covered in component tests so the device
flow does not depend on a third-party website.
