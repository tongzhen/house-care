# House Care maintenance knowledge base

`maintenance-actions-v0.1.json` is the app-ready English-canonical catalogue for the local MVP, with Danish translations included under the same action IDs.

## Structure

- Each record is one independently schedulable action.
- `id` is stable and must not change after release.
- `profileConditions` controls whether the action applies to a home.
- `trigger` contains the default schedule and seasonal calendar dates and weather metadata.
- `heavy-rain` weather metadata also selects eligible, enabled actions for the offline After heavy rain checklist. The homeowner decides when to open it; metadata does not trigger alerts or change routine schedules.
- `content.en` is the canonical content for early delivery.
- `content.da` contains the Danish localization and must preserve the English safety meaning.
- User frequency overrides must be stored outside this file.
- Completion and issue history must reference `id`, not the title.
- `sources` contains named `{ url, title, publisher }` references displayed in task details. At least one HTTP(S) reference is required. Titles retain the source publication's language.
- `lastReviewed` records the editorial source-review date, not a professional certification or an inspection of the user's home.
- `priority` is a curated `low`, `medium`, or `high` label. High addresses potential safety or significant property damage; medium addresses impaired operation or accumulating wear; low primarily addresses appearance or comfort. It does not change schedules, ordering, or reminders, and never establishes that a defect exists.
- Both languages require `whyItMatters`, `delayConsequences`, `priorityReason`, and `careGuidance`. Explain conditional risks without promising a safe delay period. Task details show these before safe steps, then existing warning signs, escalation guidance, every safety restriction, manual instructions, and source links.
- Explanatory content is bundled and works offline. External references open only on user request and require connectivity; failure leaves guidance available. No AI generates technical recommendations.

## Explanation source review — 9 November 2026

Schema 0.2 / content 0.3 adds explanations to all 21 tasks. Existing action IDs, steps, safety restrictions, concerning signs, escalation guidance and manual notes are preserved. Existing purpose explanations were reviewed and retained.

Named references were checked against their published content: Bolius guidance on dishwasher cleaning, washing-machine odours and appliance care; cooker-hood filters; gutters; soakaways and sewer maintenance; pump wells; frost protection; ventilation grilles and filters; drains; underfloor heating; floor maintenance and finishes. Bosch filter, drainage and dryer-care guidance and Electrolux burning-smell guidance support appliance handling and escalation. Dryer lint-filter and vent tasks additionally reference the U.S. Fire Administration's *Clothes Dryer Fire Safety* flyer for fire-risk statements. These references support general guidance, not applicability to every model.

The generic Danfoss support landing page is replaced with its specific article advising contact with the system installer when heating performance is uncertain. The Bosch washing-machine reference uses its current redirected URL. Secondary catalogue links not retained in this review were removed in favour of these reviewed references. Source titles remain in their original language; explanations and UI labels are available in English and Danish.

The app intentionally limits DIY guidance more narrowly than some source articles: no roof access, well entry, electrical work, fixed-installation dismantling or heating adjustments. Manufacturer and installer instructions take precedence. The trade-review flags below remain applicable before pilot release.

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

English is the canonical language. Danish translations populate `content.da` using the same action IDs and the same safety meaning. Translation must not create separate action records or separate scheduling logic. All 21 current actions have Danish content.

## Scheduling notes

Some records include explanatory ranges in `frequencyNote`, while `defaultFrequency` provides one deterministic schedule for the app. Users may override the schedule in local configuration without modifying this knowledge-base file.

## Seasonal schedules

The four existing seasonal actions have fixed Denmark calendar prompts: gutter
inspection on 1 March / 1 September, accessible gutter debris care on 1 March /
1 November, outdoor-tap preparation on 1 October, and underfloor-heating checks
on 1 September. These dates do not predict frost, leaf fall or heating demand;
manufacturer instructions and actual conditions still apply.

`seasons` supplies the four localized labels. `seasonalDates` supplies independently
recurring month/day occurrences. Default seasonal completion advances to the next
calendar date; custom interval overrides retain completion-based scheduling.
Unfinished tasks remain overdue with one outstanding occurrence per action.
The seasonal checklist and calendar reminders do not need weather or a postal code.
