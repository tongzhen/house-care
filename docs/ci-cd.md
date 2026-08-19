# CI/CD and pilot builds

GitHub Actions validates every pull request targeting `main` and every push to `main`. It uses
the Node.js version pinned in `.nvmrc` and installs dependencies exactly from `package-lock.json`.
The required `Quality checks` job runs TypeScript checking, linting, unit/component tests,
and maintenance-catalogue validation. Only a passing push to `main` starts an Android EAS preview
build. The workflow does not submit builds to Google Play.

## One-time Expo setup

The developer who owns the personal Expo account must configure EAS before the workflow can
run. From an authenticated local terminal, run the following commands in this repository:

```sh
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile preview
```

`eas init` adds the generated `extra.eas.projectId` to the Expo app configuration. The first
preview build creates or selects the required Android signing credentials. Commit the non-secret
project identifier after confirming it belongs to the intended personal Expo account.

Create a personal access token at the Expo dashboard, then add it in the GitHub repository as
the Actions secret named `EXPO_TOKEN`. Never place the token in `app.json`, `eas.json`, source
files, or local documentation.

## Pilot tester access

The `preview` EAS profile uses internal distribution. After a push to `main`, open the CI run's
summary and use its Android EAS build link to retrieve the install page. Android testers can
install the distributed APK. An Apple Developer account is not required for this pipeline.

## Branch rule and agent review

In GitHub repository settings, protect `main` by requiring the `Quality checks` status check and
requiring the branch to be current before merge. Do not require a human approving review. Use an
AI agent review as a manual pull-request step for implementation feedback, regression checks,
and test coverage before merging.

## Local checks

Run the same quality gates locally before opening a pull request:

```sh
npm run typecheck
npm run lint
npm test
npm run validate:catalog
```
