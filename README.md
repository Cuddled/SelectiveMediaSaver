# Selective Media Saver

Selective Media Saver automatically saves new Discord images, GIFs, and videos from the users,
servers, or channels you choose. This repository contains both the original BetterDiscord v2.4.0
source archive and a new Android port for Revenge Next.

The Android port is currently `2.4.0-next1`, a beta build for the exact setup it was developed
against:

- Revenge Next main build `1b1d297`
- RevengeXposed loader `1.6.2`
- Discord Android `347.1` (`347201`)
- React `19.2.3` and React Native `0.86.0`
- Android 16 / SDK 36

Revenge will reject the plugin on Discord 348+ until that client version has been tested and the
manifest range is deliberately widened.

## Android beta features

- A native React Native settings page with live capture and bridge status.
- Persistent user, server, and channel allowlists.
- Match-any or require-all allowlist behavior.
- Independent image, video, and embed-thumbnail switches.
- Optional allowlisted avatar capture from new messages and `USER_UPDATE` events.
- Optional allowlisted banner capture when Discord receives foreground profile events.
- Bounded persistent avatar/banner history with visual history previews and clear buttons.
- Ignore-bot and ignore-self options.
- Foreground capture from new `MESSAGE_CREATE` events.
- A bounded processing queue and bounded in-session event deduplication.
- Configurable album name, separate image/video folders, and a 1–512 MiB per-file limit.
- One summary toast per message instead of one notification per attachment.
- Native Android MediaStore downloads that appear in gallery/files apps.
- Streamed downloads, so a large video is not buffered in JavaScript or loaded fully into memory.
- HTTPS-only Discord CDN access, redirect revalidation, MIME/extension/signature checks, safe file
  names, unique-name handling, and incomplete-download rollback.
- Native open, share, and delete bridge support for a future saved-media browser.

The beta is foreground-only: Discord must be running and receive the message/profile event. It does
not scan old history, fetch profiles in the background, or run an Android background service.
Desktop-only BetterDiscord features such as Electron folder opening, DOM settings, and right-click
desktop menus are not used on mobile. Cross-restart media hash deduplication, the desktop metadata
browser/cleanup scheduler, and a mobile manual-save menu are still follow-up work.

## Install in Revenge Next

After the first release workflow publishes the repository, add this URL under Revenge's custom
plugin repositories:

```text
https://cuddled.github.io/SelectiveMediaSaver
```

Install the **beta** version, enable it, reload Discord, and open the plugin's settings page. Add at
least one user, server, or channel ID before expecting automatic saves; the safe default is to save
nothing while every allowlist is empty.

Files are stored in Android's public Pictures or Movies collection under the configured album name.
No broad storage permission is needed on Android 10 or newer.

## Source provenance

`SelectiveMediaSaver_v2_4_0_FIXED.zip` is the BetterDiscord source used for this port. Its contained
`SelectiveMediaSaver.plugin.js` is 49,396 bytes and has SHA-256:

```text
BDBD33ED36157670092CDF27D65ACC116D63F0CCD817F4E35E968E043DB29ADF
```

The root `SelectiveMediaSaver.plugin.js` is an old repository placeholder and is intentionally not
used as source. The previously uploaded archive was truncated Base64 text; it has been reconstructed
from the matching v2.4.0 source and verified by size, ZIP CRC, and SHA-256.

## Project layout

```text
plugins/com.cuddled.selectivemediasaver/
├── manifest.json
├── js/
│   ├── index.ts
│   ├── Settings.tsx
│   └── ...
└── src/main/
    ├── AndroidManifest.xml
    └── kotlin/com/cuddled/selectivemediasaver/SelectiveMediaSaverPlugin.kt
```

The package manifest points to:

- JavaScript: `index.js`
- Native artifact: `plugin.jar`
- Native entry class: `com.cuddled.selectivemediasaver.SelectiveMediaSaverPlugin`

The native bridge is namespaced under `com.cuddled.selectivemediasaver.*`.

## Build and verify

Requirements:

- Node.js 24
- JDK 25
- Android SDK platforms 36 and 37 with matching build tools
- Git

Windows:

```powershell
./scripts/bootstrap-gradle-wrapper.ps1
./scripts/prepare-revenge-api.ps1
npm ci
npm run lint
npm run lint:types
npm test
./gradlew.bat --no-daemon packageAllPlugins
```

Linux/macOS:

```bash
bash scripts/bootstrap-gradle-wrapper.sh
bash scripts/prepare-revenge-api.sh
npm ci
npm run lint
npm run lint:types
npm test
./gradlew --no-daemon packageAllPlugins
```

The distributable is written to:

```text
build/dist/com.cuddled.selectivemediasaver@2.4.0-next1.zip
```

It must contain `manifest.json`, `index.js`, and `plugin.jar` at the ZIP root.

## Pinned toolchain

- Revenge plugin template: `d47f792150f4dcc4f47aace6227f8b8c52aa84de`
- RevengeXposed 1.6.2 API source: `9a1426d0a3df000beb4174d0071d4d80e8be42fc`
- Revenge plugin CLI: `b41bab26bbc446e450673f8a24fb986b469d1e29`
- Revenge type definitions: `565026d875a34d0567b26ab6f4e3e2e3938e85ad`
- Revenge API: `1.0.0`
- Java: 25
- Gradle: 9.6.1

The Android plugin compiles against SDK 36. SDK 37 is also installed in CI because the pinned
RevengeXposed source uses it while publishing the compile-only Revenge API artifact.

## Publishing and promotion

Pull requests run linting, type checks, unit tests, native compilation, D8 packaging, and repository
metadata validation. Merges to `main` publish immutable plugin ZIPs and `index.json` to `gh-pages`.

`2.4.0-next1` remains on the beta channel. Promote only after testing installation, settings,
capture, large-file cancellation, duplicates, and lifecycle reloads on the target phone. A stable
release uses a newer version without a prerelease label.

## Notice

Revenge and BetterDiscord are third-party Discord client modifications. Using client modifications
may conflict with Discord's terms or create account risk. This project is not affiliated with or
endorsed by Discord or the Revenge project.
