# House Care agent guide

Read [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) before making product or architecture decisions. It is the source of truth for the approved MVP scope, delivery order, and acceptance criteria.

## Product boundary

House Care is a local-first iOS/Android app for safe, routine home-maintenance guidance.

- The core loop is: home profile → applicable action → safe guidance → outcome → next due date/history.
- The MVP works offline and has no authentication, backend, cloud sync, weather API, remote content updates, or push notifications.
- User-facing content is English first; Danish localization is required before the pilot.
- Do not add diagnosis, repair instructions, contractor recommendations, insurance/warranty claims, advertising, affiliate links, or sponsored content.

## Technology and architecture

- Use Expo React Native with TypeScript and Expo Router.
- Use SQLite for durable local user data, app-private file storage for issue photos/exports, and local device notifications only.
- Keep the dependency direction: UI → feature hooks/services → repository/device-service interfaces → SQLite/Expo adapters.
- Domain and application code must not import React, Expo, SQLite, HTTP, or platform APIs.
- Screens must not query SQLite, schedule notifications, or calculate due dates directly.
- Keep durable data in repositories; use client state only for transient presentation state.
- Preserve cloud portability through stable UUIDs, UTC ISO-8601 timestamps, migrations, repository contracts, soft deletes where needed, and versioned exports.

## Knowledge base

The bundled action catalogue is [knowledge-base/maintenance-actions-v0.1.json](knowledge-base/maintenance-actions-v0.1.json).

- Never change a published action ID.
- Store user frequency overrides, action enablement, and history outside the knowledge-base file.
- Validate knowledge-base content with a runtime schema before use.
- Keep English as canonical content and add Danish translations under the same action IDs.
- Manufacturer and installer instructions override generic guidance.
- Preserve every action’s safety restrictions, concerning signs, and escalation guidance.
- Do not schedule `habit`/after-use actions as local notifications.

## Functional rules

- Support one home profile per installation in the MVP.
- Home shows at most one current action and two upcoming actions.
- User outcomes are Done, Snooze, Not relevant, and I noticed an issue.
- Done appends history, clears a snooze, calculates the next due date, and reschedules the notification.
- Snooze changes only the current due date; it never changes frequency.
- Not relevant disables an action until the user re-enables it in Settings.
- Frequency overrides take precedence over knowledge-base defaults and never rewrite history.
- Monthly schedules use the same calendar day where possible; otherwise use the final valid day of the month.
- Local notifications fire once at 09:00 device-local time; do not repeat overdue notifications.
- Do not collect postcode until there is an approved, consented product use for it.

## Privacy and safety

- Store user data and issue photos in app-private storage only.
- Request photo permission only when the user chooses to attach an image.
- Support one optional image per issue in the MVP; copy it into app storage and remove metadata before persisting it.
- Do not log free-text notes, image paths, or user-entered content.
- Export is explicit and user initiated; import must validate before changing data.
- Reset requires confirmation and deletes app-owned database/media data only.
- Never tell users to climb roofs, enter wells, open electrical covers, change heating/manifold settings, or dismantle fixed installations.

## Implementation discipline

- Work in the delivery order in `IMPLEMENTATION_PLAN.md` unless the user explicitly changes priorities.
- Prefer small vertical slices that end in a testable UI flow.
- Add database migrations before changing persisted schemas.
- Use parameterized SQLite statements and transactions for multi-record writes.
- Keep external dependencies minimal and justify any new native module.
- Add translation keys with every user-visible string; do not hard-code UI copy.
- Keep action-detail safety content visible and separate from optional source/manual information.

## Engineering rules
- Use TypeScript. Do not introduce `any`.
- Prefer existing components, hooks, tokens, and patterns.
- Keep platform-specific code in `.ios.tsx`, `.android.tsx`, or documented platform branches only when necessary.
- Avoid new native dependencies unless explicitly approved.
- Never modify generated native files, app signing, EAS credentials, or CI/CD configuration without approval.
- Do not log tokens, user data, or production API payloads.
- Ensure touch targets, labels, and loading/error states remain accessible.
- Preserve deep links, navigation params, and existing back behavior.

## Testing and completion
Before reporting complete:
1. Run formatter, lint, TypeScript checking, and relevant tests.
2. Add/update tests for behavior changes.
3. Review the final diff for iOS/Android differences and accidental unrelated changes.
4. Report files changed, commands executed, results, untested paths, and any platform-specific limitations.

## Verification

Before considering a change complete:

- Run type-checking, linting, knowledge-base validation, and relevant unit/component tests once the project tooling exists.
- Test persistence after app restart for any change that modifies local data.
- Test both allowed and denied permission states for notification/photo work.
- Add or update unit tests for date calculations, eligibility, persistence, and state transitions.
- Add or update UI/end-to-end coverage for changed critical flows.
- Test English copy immediately; test Danish copy and layout once localization is introduced.

The project has not yet been scaffolded, so do not invent commands. Add the actual install, test, lint, type-check, build, and end-to-end commands here when Delivery 0 creates them.
