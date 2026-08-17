# House Care maintenance knowledge base

`maintenance-actions-v0.1.json` is the app-ready English-first catalogue for the local MVP.

## Structure

- Each record is one independently schedulable action.
- `id` is stable and must not change after release.
- `profileConditions` controls whether the action applies to a home.
- `trigger` contains the default schedule and future seasonal/weather metadata.
- `content.en` is the canonical content for early delivery.
- `content.da` is reserved for the later Danish localization.
- User frequency overrides must be stored outside this file.
- Completion and issue history must reference `id`, not the title.
- `sources` and `lastReviewed` support content review and future source display.

## Current catalogue

The catalogue contains 21 atomic actions across appliances, exterior, drainage, ventilation, heating, and flooring.

Compound source sections were split where frequency, duration, or safety level differs. Examples include dishwasher filter checking versus cleaning, washing-machine drawer/seal care versus pump-filter care, and dryer lint-filter care versus condenser care.

## Safety review flags

Before pilot release, review the following entries with the relevant trade or manufacturer guidance:

- Washing-machine pump filter
- Dryer condenser/filter care
- Gutter access and cleaning
- Faskine inlet inspection
- Pump-well visual inspection
- Ventilation filter access
- Underfloor-heating visual inspection
- Wood-floor treatment and oily-rag disposal

The app should keep these as accessible inspection or user-maintenance actions only. It must not instruct users to climb roofs, enter wells, open electrical compartments, alter heating controls, or dismantle fixed installations.

## Localization

English is the canonical early-delivery language. Danish translations should populate `content.da` using the same action IDs and the same safety meaning. Translation must not create separate action records or separate scheduling logic.

## Scheduling notes

Some records include explanatory ranges in `frequencyNote`, while `defaultFrequency` provides one deterministic schedule for the app. Users may override the schedule in local configuration without modifying this knowledge-base file.
