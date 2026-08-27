# Release readiness

## About, legal, and privacy

The app bundles English and Danish versions of the Privacy Policy, Terms of Use & Safety, acknowledgements, and Data & permissions. They must remain usable offline. The canonical public copies are published from the separate public repository at `https://github.com/tongzhen/house-care-legal` and served at:

- `https://tongzhen.github.io/house-care-legal/privacy/`
- `https://tongzhen.github.io/house-care-legal/terms/`
- `https://tongzhen.github.io/house-care-legal/acknowledgements/`

Before any public release, replace every `*.example` contact and development-identity placeholder in both repositories with the legal entity name, postal address, support email, and privacy contact. Have the draft terms and privacy policy reviewed by qualified legal counsel.

## Data and permissions

House Care is local-first: it has no account, analytics, advertising, telemetry, backend, or server-side user-data processing. Profile information, settings, history, issue notes, and optional issue photos stay on the device. The only requested device permissions are:

- Notifications, when local reminders are enabled.
- Photos, only when the user adds an issue photo.
- No calendar access: the user’s calendar app owns the optional event editor and save decision.

`RECORD_AUDIO`, `READ_CALENDAR`, and `WRITE_CALENDAR` must not be present in Android permissions. Review the generated Expo configuration and the final Android manifest for every release. Reset app data deletes House Care-owned database and media data; exported backups, reports, and calendar events remain under the user’s chosen destination or calendar control.

## Versioning and builds

The About screen reads the installed version and build number through `expo-application`. `app.json` is the release source of truth: update `expo.version`, `ios.buildNumber`, and `android.versionCode` before submitting a new native build. `android.versionCode` must increase for every Play release; `ios.buildNumber` must increase for every App Store build of the same marketing version.

## Store submission checklist

### Apple App Store

- [ ] Replace legal/support placeholders and verify in-app legal links and the public privacy-policy URL.
- [ ] Complete App Store Connect privacy details, support URL, age rating, screenshots, accessibility review, and app-content details.
- [ ] Confirm the declaration matches local-only storage, optional photos, notifications, calendar export, backups, and PDF sharing.
- [ ] Test English and Danish layouts, permission denial, Reset deletion, timezone/DST reminder behavior, and a production build on iOS.

### Google Play

- [ ] Replace legal/support placeholders and verify the in-app and public privacy-policy links.
- [ ] Complete Data Safety, app-content declaration, screenshots, support contact, and age rating.
- [ ] Confirm Android permissions include only notification and calendar access required by implemented features; photo access is requested only by the image picker.
- [ ] Test English and Danish layouts, permission denial, Reset deletion, timezone/DST reminder behavior, and a production build on Android.

## Content and licence gates

- [ ] Recheck all 21 catalogue records against the current manufacturer manual or referenced Danish source before release; manufacturer and installer instructions override the app.
- [ ] Do not restore or publish Bolius citations.
- [ ] Run `npm run generate:notices` after dependency changes and commit the generated notices.
- [ ] Run `npm run notices:check`; CI rejects stale notices or dependencies without licence data.
- [ ] Verify all canonical public legal pages load and match the policy version bundled in the app.
