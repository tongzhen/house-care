# Dependency security

Use Node from `.nvmrc` and install the committed dependency tree with `npm ci --ignore-scripts`. CI disables dependency lifecycle scripts, checks npm advisories at moderate severity or above, and runs dependency compatibility/security tests before the application checks. Reviewed GitHub Actions are pinned to commit hashes, checkout credentials are not persisted, and the EAS CLI is pinned to 27.11.0. The preview job installs application dependencies before making the Expo token available.

## Security updates and compatibility

The 20 November 2026 update retains Expo SDK 57 and React Native 0.86.2. It raises the Expo, Router and Zod minimum versions and refreshes affected transitive dependencies. The original lockfile reported 27 npm audit entries, including one critical entry; these counts include propagation to parent packages and do not establish app-specific exploitability.

Some upstream constraints still select vulnerable packages. `package.json` documents the enforced versions through `overrides`:

- `image-size` 2.0.3 fixes malformed-image infinite loops. Metro passes image buffers to its default export, which remains supported; the dependency test exercises Metro's actual PNG dimension reader and malformed ICNS inputs.
- Vulnerable minimatch releases from 7 through 11.0.0 use 11.0.1. Older unaffected matcher lines retain their existing APIs. Expo fingerprint ignore rules are tested through their real consumer.
- `shell-quote` 1.12.0 rejects line terminators following comment tokens. Tests cover all four line terminators and ordinary quoted arguments without executing shell input.
- The Expo plist XML parser and YAML 3/4 parsers receive patched versions within their existing release lines.
- Existing `react-native-reanimated` 4.5.3 and `react-native-worklets` 0.10.4 are retained because resolving optional peers to their newest releases selects versions incompatible with this app's React Native/Expo versions.

Router 57 uses query-string 7, which requires a callable CommonJS decoder. Patched `decode-uri-component` 0.5.1 is ESM, and query-string 9 changes the export shape expected by Router. The private, first-party module in `modules/decode-uri-component-compat` therefore exposes the patched decoder's default function through `module.exports`. Its upstream dependency is pinned under an npm alias, with its original registry tarball and integrity hash retained in the lockfile. A direct local dependency plus an override ensures query-string uses this adapter. Unicode, repeated parameters, malformed input, and round trips are covered by `npm run test:dependencies`.

The notices generator excludes local package links from third-party notices, while retaining the aliased upstream decoder's MIT license notice. Regenerate notices after changing the lockfile.

## Updating safely

1. Review `npm run audit:dependencies` and the dependency paths before choosing updates. Avoid `npm audit fix --force`, which can propose an Expo downgrade or incompatible major update.
2. Update the necessary constraints/overrides, regenerate the lockfile, and verify a clean script-free install.
3. Run `npm run test:dependencies`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run validate:catalog`.
4. Run `npm run generate:notices` and `npm run notices:check`, and verify Android and iOS JavaScript exports when changing Router, Metro, or module-format compatibility.
5. Remove an override or the decoder adapter when the owning Expo/Router dependencies adopt compatible patched versions, after repeating the same checks.

An npm audit result covers published advisories for the npm tree. It does not prove absence of malicious packages, audit EAS CLI's separately installed tree, or cover CocoaPods/Maven dependencies and native device behavior.
