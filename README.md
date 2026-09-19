# Selective Media Saver

Selective Media Saver automatically saves new Discord images, GIFs, and videos from the users,
servers, or channels you choose. This repository contains the verified BetterDiscord v2.4.0 source
archive plus separate Android builds for Revenge Classic and Revenge Next.

The two Revenge plugin systems use different loaders and are not interchangeable:

- Revenge Classic installs a loose `manifest.json` + `index.js` bundle from the site root. The
  Classic port targets the `1b1d297-main` build shown as Revenge 1.11.6 in the app.
- Revenge Next installs a compiled plugin ZIP from a repository index. Its beta repository lives at
  the explicit `/next` path so Classic never tries to execute a Next ZIP.
- Midnight Glass installs separately through Revenge Classic's Themes screen. Its spec-2 manifest
  and portrait background are published under `/themes/midnight-glass` so the existing plugin URLs
  stay unchanged.

The Revenge Next port is currently `2.4.0-next8`, a beta build for this tested client stack:

- RevengeXposed loader `1.6.2`
- Discord Android `347.1` (`347201`)
- React `19.2.3` and React Native `0.86.0`
- Android 16 / SDK 36

Revenge will reject the plugin on Discord 348+ until that client version has been tested and the
manifest range is deliberately widened.

## Revenge Classic beta features

- A visual in-app settings screen with switches, ID editors, status, save/failure totals, and a
  one-press history reset.
- Persistent user, server, and channel allowlists with match-any or require-all behavior.
- A safe default that saves nothing until at least one allowlist is configured.
- Automatic image, GIF, video, embed-image, and optional embed-thumbnail capture.
- Optional allowlisted avatar and banner capture when Discord receives the corresponding live
  message or profile event.
- Ignore-bot and ignore-self switches, size checks when Discord supplies an attachment size, a
  bounded queue, and bounded persistent duplicate history.
- Discord's own Android media downloader, avoiding JavaScript buffering of whole videos.

Classic capture is foreground-only and only sees new events received while Discord is running. It
does not scan old messages or fetch profiles in the background. Discord chooses the final public
download location and filename; custom albums, custom filenames, file open/share/delete tools, the
desktop metadata browser, cleanup scheduler, and right-click BetterDiscord menus are not available
in the Classic build.

## Revenge Next beta features

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
- Visual folder modes for flat storage, stable per-sender folders, or server/DM then sender. Sender
  folders combine the global username with the full Discord user ID so duplicate names never mix.
- Bounded persistent sender-folder assignments keep a person's original folder stable after a
  username change, with optional per-sender avatar and banner folders.
- One summary toast per message instead of one notification per attachment.
- Native Android MediaStore downloads that appear in gallery/files apps.
- Native enabled-state synchronization that survives fully closing and reopening Discord.
- Recoverable JavaScript or Android startup failures stay visible in plugin status without making
  Revenge persist the plugin's main toggle as disabled.
- Android service initialization accepts Revenge's early process context even when Android has not
  populated its `applicationContext` property yet.
- Immediate native bridge registration plus automatic startup and on-demand retries, so a slow
  Android context does not leave the saver permanently unavailable.
- Streamed downloads, so a large video is not buffered in JavaScript or loaded fully into memory.
- HTTPS-only Discord CDN access, redirect revalidation, MIME/extension/signature checks, safe file
  names, unique-name handling, and incomplete-download rollback.
- Native open, share, and delete bridge support for a future saved-media browser.

The beta is foreground-only: Discord must be running and receive the message/profile event. It does
not scan old history, fetch profiles in the background, or run an Android background service.
Desktop-only BetterDiscord features such as Electron folder opening, DOM settings, and right-click
desktop menus are not used on mobile. Cross-restart media hash deduplication, the desktop metadata
browser/cleanup scheduler, and a mobile manual-save menu are still follow-up work.

## Revenge Classic compatibility ports for Next

The same Revenge Next repository also contains direct compatibility ports of these nine supplied
Classic plugins. Each installs and enables independently; their original behavior, labels, options,
and quirks are intentionally retained while only loader/API integration was adapted for Next:

- petPet
- NoIdle
- No typing
- NoCompression
- BetterBios / ClickableBioLinks
- PlatformIndicators
- NoBandwidthKick
- Always Animate
- Chatbox Avatar

Each plugin's packaged `NOTICE.md` identifies the exact audited Classic artifact, snapshot hash,
source revision, and license. These ports target the same Discord 347.x client range as the current
Selective Media Saver Next build.

## Liquid Glass for Revenge Next

**Liquid Glass** is a separate appearance plugin in the same Next repository. It uses Discord's own
full-app gradient renderer plus translucent surface colors encoded in Discord-compatible hex,
avoiding an unstable system-wide Android blur patch. The current release is `1.0.0-beta4` for
Discord 347.x. Its visual
settings include:

- Midnight, Frost, Ocean, Rose, Aurora, and AMOLED one-tap presets.
- Visual Gradient / Midnight Waves background cards with a live preview. Midnight Waves uses the
  existing purple portrait wallpaper, centered and cropped to cover the main app background.
- Wallpaper opacity, darkness, raised-panel color tint, and soft blur controls. Low-power mode
  disables blur while preserving the saved value. Color presets preserve wallpaper choices.
- Editable gradient, panel, raised-surface, accent, text, and border colors using hex values.
- Separate live opacity controls for base panels, raised surfaces, profiles, menus/overlays, and
  controls/lists, plus background softness and gradient-angle sliders.
- Up to 20 named custom profiles with one-tap apply, rename, update, and delete controls.
- Dedicated glass switches for own/member profiles, menus/overlays, and controls/lists, plus a
  master transparent-surface switch and low-power mode.
- Targeted profile rendering for custom-colored and Nitro profiles while keeping each profile's
  original hues, banners, avatars, and media intact.

Install and enable **Liquid Glass** from the existing Revenge Next repository, reload Discord once,
then open its settings to customize the look. The controls are live, but saved values remain
persistent across restarts.

### Liquid Glass beta4 release notes

After updating, reload Discord once and choose **Liquid Glass settings → Background style →
Midnight Waves**. Defaults are 95% image opacity, 18% darkness, 10% tint, and no blur. Existing
beta3 settings and older saved profiles migrate to schema v3 without switching their gradient
appearance. New saved profiles include all wallpaper controls.

The wallpaper loads from the existing HTTPS GitHub Pages asset and uses React Native's image
cache; the first load needs network access and cached availability is controlled by Android.
The native gradient stays behind it during loading or failure. Only nested gradients inside the
successfully loaded main-app wallpaper scope are hidden. Unsupported MainTabs structures keep
the gradient. Profile media and avatars are unchanged. Wallpaper visibility on separate opaque
screens depends on Discord's surface rendering; beta4 does not inject duplicate images into them.

Phone verification on Discord 347.1 should check chats, own/member profiles, navigation,
rotation, restart persistence, failed/offline image loading, and low-power mode. Desktop checks
do not verify the final Android appearance.

## Install in Revenge Classic

In **Settings → Plugins**, press the add button and enter this direct plugin URL:

```text
https://cuddled.github.io/SelectiveMediaSaver
```

Classic automatically requests `/manifest.json` and then `/index.js`. Do not paste the ZIP URL or
the `/next` repository URL into the Classic add-plugin dialog.

After installation, enable the plugin, reload Discord, and open its settings. Add at least one user,
server, or channel ID before expecting automatic saves; the safe default is to save nothing while
every allowlist is empty.

## Install in Revenge Next

Add this URL under Revenge Next's custom plugin repositories:

```text
https://cuddled.github.io/SelectiveMediaSaver/next
```

Install the **beta** version, enable it, reload Discord, and open the plugin's settings page. Add at
least one user, server, or channel ID before expecting automatic saves; the safe default is to save
nothing while every allowlist is empty. New installs organize future downloads by sender by default;
the visual Folder organization card can switch to flat folders or server/DM then sender.

The nine Classic compatibility ports appear as separate plugins in this same repository. Install
only the ones you want, enable them, and reload Discord.

The original Next URL at `https://cuddled.github.io/SelectiveMediaSaver/index.json` and its `/pool`
artifact URLs remain published for compatibility with existing installs. New Next installs should
use `/next`; the site root itself is the Classic install URL.

The release workflow also attaches each compiled Next plugin ZIP to its matching GitHub Release.

Files are stored in Android's public Pictures or Movies collection under the configured album name.
No broad storage permission is needed on Android 10 or newer.

## Install the Midnight Glass companion theme in Classic

In Revenge Classic, open **Settings → Themes**, press the add button, and enter this direct theme
URL:

```text
https://cuddled.github.io/SelectiveMediaSaver/themes/midnight-glass/theme.json
```

Select **Midnight Glass** after it downloads. If the wallpaper is not visible in chat, make sure
custom theme backgrounds are shown in Revenge's theme settings. The theme works by itself. Revenge
Next uses the separate Liquid Glass plugin for live presets and color controls.

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
classic/
└── ...                         # Revenge Classic source and build tooling

themes/midnight-glass/
├── theme.json                  # Revenge spec-2 color theme
└── background-v1.png           # Hosted portrait chat background

plugins/com.cuddled.liquidglass/
├── manifest.json               # Revenge Next appearance plugin metadata
└── js/                          # Live theme engine, settings UI, and tests

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
- Android SDK platform 36 with build tools 36.0.0
- Git

Windows:

```powershell
./scripts/bootstrap-gradle-wrapper.ps1
./scripts/prepare-revenge-api.ps1
npm ci
npm run lint
npm run lint:types
npm test
npm run build:classic
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
npm run build:classic
./gradlew --no-daemon packageAllPlugins
```

The distributables are written to:

```text
build/classic/manifest.json
build/classic/index.js
build/dist/com.cuddled.liquidglass@1.0.0-beta3.zip
build/dist/com.cuddled.selectivemediasaver@2.4.0-next8.zip
```

The Selective Media Saver ZIP must contain `manifest.json`, `index.js`, and `plugin.jar` at its
root. Each compatibility port produces its own `build/dist/<plugin-id>@1.0.0.zip` containing
`manifest.json`, `index.js`, and its source/license notice files.

## Pinned toolchain

- Revenge plugin template: `d47f792150f4dcc4f47aace6227f8b8c52aa84de`
- RevengeXposed 1.6.2 API source: `9a1426d0a3df000beb4174d0071d4d80e8be42fc`
- Revenge plugin CLI: `b41bab26bbc446e450673f8a24fb986b469d1e29`
- Revenge type definitions: `565026d875a34d0567b26ab6f4e3e2e3938e85ad`
- Revenge API: `1.0.0`
- Java: 25
- Gradle: 9.6.1

The Android plugin and the pinned Revenge API are compiled in CI with Android SDK 36.

## Publishing and promotion

Pull requests run linting, type checks, unit tests, Classic bundling, native compilation, D8
packaging, and a full Pages-layout validation. Merges to `main` publish Classic `manifest.json` and
`index.js` at the site root, preserve the legacy Next `index.json` and `/pool`, and mirror the Next
repository under `/next`. The same atomic Pages update publishes the validated Midnight Glass
manifest and background under `/themes/midnight-glass`.

`2.4.0-next8` remains on the beta channel. Promote only after testing installation, settings,
capture, large-file cancellation, duplicates, and lifecycle reloads on the target phone. A stable
release uses a newer version without a prerelease label.

## Notice

Revenge and BetterDiscord are third-party Discord client modifications. Using client modifications
may conflict with Discord's terms or create account risk. This project is not affiliated with or
endorsed by Discord or the Revenge project.
