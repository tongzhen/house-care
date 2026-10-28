# HouseCare app icons

Generated from the project's existing `assets/icon.png` (1024 × 1024). The original file is preserved in `source/original-icon.png`. The house and checkmark were extracted from that raster, retaining their existing geometry and colors. The baked white border and rounded green tile were replaced with a full-bleed sampled green background (#135645), so each platform can apply its own mask. This is a raster-derived export, not a vector redraw.

## Included files

- `ios/AppIcon.appiconset/`: Xcode All Sizes catalog with 18 assigned entries, including iPhone notification, Settings, Spotlight, Home Screen, iPad sizes, and the 1024 × 1024 App Store icon. PNGs are opaque RGB with embedded sRGB profiles and no baked rounded corners. iPad sizes are included for reuse even though this project's Expo config currently disables tablet support.
- `ios-single-size/AppIcon.appiconset/`: alternative modern Xcode single-size catalog with a 1024 × 1024 universal iOS icon. Use one catalog, not both in the same asset catalog. Dedicated dark/tinted or Icon Composer layered appearances are not included; these require separate artwork. These are standard flat app icon assets.
- `android/res/`: square and round legacy launchers at ldpi (36), mdpi (48), hdpi (72), xhdpi (96), xxhdpi (144), xxxhdpi (192) pixels. Adaptive foreground and monochrome PNG layers use 108dp canvases at every density (81/108/162/216/324/432 pixels). All subject pixels fit inside a centered 64dp diameter circle, within Android's 66dp safe zone. Green background is an XML color resource.
- `android/res/mipmap-anydpi-v26/`: adaptive icon XML for Android 8+. `mipmap-anydpi-v33/` adds the monochrome layer for themed icons on supported Android 13+ launchers.
- `android/play-store-icon-512.png`: 512 × 512 RGBA PNG, fully opaque, embedded sRGB, under 1 MB, square with no baked outer shadow or rounded corners.
- `expo/`: 1024px square icon, transparent adaptive foreground, monochrome foreground, solid background image, and a partial configuration example.
- `masters/`: reusable 1024px full-bleed master and extracted foreground.
- `preview.png`: visual reference with simulated masks. Do not use the preview as an app asset.
- `manifest.json`: image dimensions, modes, hashes, and source fingerprint.
- `generate.py`: reproducible export script (Python 3, Pillow, NumPy); run from any directory. If using the script outside this project, retain `source/original-icon.png`.
- `validation.json`: export checks and native resource compilation results.

## Xcode installation

Copy `ios/AppIcon.appiconset` into your target's `Assets.xcassets`, replacing its existing AppIcon set. Set the target's App Icons Source to `AppIcon`. Alternatively use the single-size catalog. Do not copy both alternatives into the same asset catalog. No manual corner rounding is needed.

## Android installation

Merge `android/res/` into your app module's `src/main/res/`. Replace existing launcher resources with these files and remove any conflicting launcher `.webp` files with the same names/qualifiers. Keep the project's other resources intact. Compile with Android SDK 33 or higher for the themed-icon XML.

In the existing `<application>` element in `AndroidManifest.xml`, set:

```xml
android:icon="@mipmap/ic_launcher"
android:roundIcon="@mipmap/ic_launcher_round"
```

Upload `android/play-store-icon-512.png` separately in Google Play Console. Launcher assets are not notification small icons.

## Expo installation for this project

Copy the four PNG files from `expo/` into `assets/housecare-icons/`. Merge the keys from `expo/app-icon-config.json` into the existing `app.json`; the example is partial and must not replace the whole app configuration. Keep all other existing iOS and Android settings. Expo generates native resources during the next native build/prebuild. A new native binary is required to update installed launcher icons.

The running project's `assets/icon.png` and `app.json` have not been changed by this export task.

## Verification

All PNG dimensions, iOS opacity, sRGB profiles, Android XML references, adaptive safe bounds, store file size, and ZIP integrity were checked. Both iOS catalog alternatives compiled with Xcode `actool` for iPhone/iPad. Android resources compiled and linked with `aapt2` against SDK 36. The Xcode tool emitted local simulator-service connection messages but produced its compiled asset catalog successfully. Previews were visually inspected. This package has not been installed on physical devices or submitted to either store; launcher animations and device-specific rendering still merit a release-build check.

## Platform references

- [Apple: configuring your app icon using an asset catalog](https://developer.apple.com/documentation/xcode/configuring-your-app-icon)
- [Apple: app icon asset catalog format](https://developer.apple.com/library/archive/documentation/Xcode/Reference/xcode_ref-Asset_Catalog_Format/AppIconType.html)
- [Android: adaptive icons and safe zones](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive)
- [Android: creating app icons](https://developer.android.com/studio/write/create-app-icons)
- [Google Play: store icon specifications](https://developer.android.com/distribute/google-play/resources/icon-design-specifications)
