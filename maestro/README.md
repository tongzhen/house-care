# Maestro end-to-end tests

These flows exercise House Care as a black-box app on an Android emulator or iOS simulator. Each action-regression flow clears application data, creates the default dishwasher profile, and independently verifies one of the mutations that previously showed `The action could not be updated`.

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

The flows use English visible text because English is the clean-install default. Prefer stable React Native `testID` selectors when flows begin covering localized screens or duplicate labels.

The current local setup intentionally does not alter GitHub Actions or EAS Workflows. CI device execution should be added separately after deciding whether builds will run on EAS Workflows or another emulator runner.
