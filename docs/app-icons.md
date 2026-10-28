# HouseCare app icons

`app.json` uses the exported HouseCare artwork in `assets/housecare-icons/`:

- `icon.png`: opaque, full-bleed 1024px icon shared by iOS and Android legacy launchers.
- `adaptive-foreground.png`: transparent house and checkmark for Android adaptive masks.
- `adaptive-monochrome.png`: alpha silhouette for Android themed launcher icons.
- `adaptive-background.png`: matching solid background for reuse; the Android configuration uses its equivalent color, `#135645`.

The source design is preserved in `assets/icon.png`. The new square version removes its baked white margin and rounded tile so the operating system can apply the appropriate mask. The adaptive mark fits within Android's central safe area.

Expo generates native icon resources from these settings. Build and reinstall a native binary to see the change; a JavaScript update cannot replace an installed launcher icon. Native `ios/` and `android/` output remains untracked.

The portable export is in `deliverables/HouseCare-App-Icons.zip`, with its unpacked source under `deliverables/housecare-app-icons/`. It includes Xcode All Sizes and Single Size catalog alternatives, Android density and adaptive resources, store icons, an image manifest, preview, export script, and installation instructions. Use only one Xcode catalog alternative.

## Verification and review

Local quality gates passed: TypeScript, lint, all 174 unit/component tests, maintenance-catalogue validation, and third-party notices. Expo configuration resolution and native resource generation passed. The export package records successful Xcode icon compilation and Android resource compilation/linking in `validation.json`.

AI implementation review checked the final configuration and asset paths, iOS opacity and square geometry, Android foreground/monochrome transparency and safe bounds, the background color match, and preservation of the existing identifiers, permissions, and EAS association. No blocking findings were identified. No application logic or dependencies changed, so no new behavioral tests were added.

Physical-device launcher rendering and installation have not been tested. Dedicated iOS dark/tinted artwork and layered Icon Composer assets are not included.
