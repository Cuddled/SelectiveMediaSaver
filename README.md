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
avoiding an unstable system-wide Android blur patch. This source targets `1.0.0-beta7` for
Discord 347.x. Its visual
settings include:

- Midnight, Frost, Ocean, Rose, Aurora, and AMOLED one-tap presets.
- Visual Gradient / Midnight Waves background cards with a live preview. Midnight Waves uses the
  existing purple portrait wallpaper, centered and cropped to cover the main app background.
- Wallpaper opacity, darkness, raised-panel color tint, and soft blur controls. Low-power mode
  disables blur while preserving the saved value. Color presets preserve wallpaper choices.
- Optional chat wallpaper behind DM and server messages, with a chat preview and independent
  opacity/darkness sliders. It also works with the full-app background disabled.
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

### Liquid Glass beta7 icon contrast fix

Beta7 adds the dedicated semantic colors used by Discord's generated call/video/search icons
and its attachment, gift, emoji, and microphone controls. With chat wallpaper enabled, default
icons use 94% light foreground and subtle navigation icons use 88%; dark custom text colors get
the same light fallback as the chat text. Hover/active interaction icons use full strength.
Muted/disabled icon colors remain softer, and Discord's existing disabled state and opacity are
preserved. Recording, call-status, destructive-action, and send-button accent colors are unchanged.

The fix uses the existing semantic palette and refresh mechanism rather than replacing buttons
or touching their handlers. Other controls sharing those semantic tokens receive the same palette.
Wallpaper, translucent backgrounds, profiles, schema-v4 settings, and saved colors are unchanged.
Disabling transparent surfaces or Liquid Glass restores Discord's own semantic colors. Reload
Discord once after updating; phone QA should cover idle/active/disabled icons and keyboard changes.

### Liquid Glass beta6 chat contrast fix

With chat wallpaper and transparent surfaces enabled, beta6 replaces the gray chat header,
input scrim, and bottom safe-area fill with a dark translucent tint. The tint follows the panel
hue and opacity but limits pale presets to a dark background. No saved colors are changed.
The chat preview now includes the header, reply text, username, and input surroundings.

Default native message names and message/reply text use a readable light foreground; timestamps
and edited labels use a softer version. Explicit role/name-style colors, links, embeds, navigation
controls, keyboard layout, and native chat refs are preserved. These overrides target the inspected
Discord 347 Android modules, leave unknown render shapes alone, and restore the original outputs
when chat wallpaper, transparent surfaces, or Liquid Glass are disabled. The semantic text palette
also includes Discord's interactive text and mobile heading tokens.

Reload Discord once after updating. Existing wallpaper choices, schema-v4 settings, and saved
profiles remain unchanged. The preview is illustrative; final header, reply, keyboard-open/closed,
and username rendering still needs verification on the phone with this Discord build. Dark custom
role/name-style colors remain the user's/server's choice and are not force-brightened.

### Liquid Glass beta5 chat wallpaper foundation

After updating, reload Discord once and open **Liquid Glass settings → Chat wallpaper →
Midnight Waves in chats**. Chat wallpaper is opt-in; existing settings and custom profiles migrate
to schema v4 without changing the current appearance. New profiles save chat settings too.
Chat defaults are 95% opacity and 30% darkness. Chat uses the same wallpaper image, tint, and blur
as the main app; opacity and darkness are separate. Pausing Liquid Glass disables both.

The Android chat viewport receives a non-interactive image layer behind its original native chat
component. The native background is cleared only after a successful image load; loading/failure
keeps its original background. Native refs, event handlers, message children, and list identity
are preserved. Only the inspected Discord 347 Android chat structure is patched; unsupported
structures are left unchanged. These are local visual settings, not shared with other users.

### Liquid Glass beta4 wallpaper foundation

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

Phone verification on Discord 347.1 should check DMs, server channels, threads, scrolling, message
actions, keyboard/input, channel switching, rotation, restart persistence, failed/offline image
loading, low-power mode, and toggling chat wallpaper off. Also check own/member profiles and main
navigation for regressions. Desktop checks do not verify final Android appearance or whether a
particular native build paints additional opaque layers over the wallpaper.

## Full-App Glass (Experimental) for Revenge Next

`com.cuddled.fullappglass` is a separate, standalone `1.0.0-beta12` plugin. It does not require
Liquid Glass to be installed and has its own JSON storage. Liquid Glass's code, version, saved
colors, and profiles are not changed by this experiment. A few audited pure helpers are bundled
into the new ZIP; there is no runtime dependency on the other plugin.

**Use only one appearance plugin at a time.** Turn Liquid Glass and any other appearance plugins
off and reload Discord before enabling this experiment. The supported public plugin API does not
expose a reliable registry for detecting or disabling other plugins, so this is a visible setup
instruction, not an automatic conflict detector. Full-App Glass starts with its preview paused.

In its settings, enable **Full-App Glass**, then use:

- **Master transparency:** 0% solid through 100% clear; default 80%. The miniature preview changes
  while dragging, and releasing applies/saves the value across supported surfaces. Chat and
  channel-list headers have their own opaque wallpaper-backed layer, with adjustable tint/dim,
  so text scrolling underneath cannot overlap the controls. The profile toolbar retains an
  opacity floor of 82%.
- The message-entry pill and bottom account bar also have their own wallpaper backing. Their
  tint follows the transparency slider, but the wallpaper base remains opaque to block scrolling
  text behind them. **Conversations** controls the input backing; **main screens** controls the
  account-bar backing.
- **Wallpaper darkness:** default 28%, independent from transparency.
- **Glass tint:** Midnight, Violet, Ocean, or Black swatches.
- **Your custom look:** independent switches for rounded channel selections, the outlined dark
  message-entry pill, and coordinated action sheets. All three start on and follow the existing
  area switches. Channel highlights and the polished composer also follow **Inputs and cards**.
- **Accent color:** Lavender, Ice, Rose, Mint, Gold, or Pearl swatches, plus a custom six-digit
  hex field. **Accent opacity** changes outline and selection intensity; drag to preview, release
  to apply. Existing colors, transparency, area choices, enabled state and saved settings survive
  upgrades. New installs still start paused.
- **Area switches:** main screens (shared list/navigation/settings surfaces), conversations,
  own/member profiles, menus/overlays, and controls/cards. Shared Discord tokens mean groups are
  not an exhaustive per-screen allowlist.
- **Menu background:** independent Charcoal, Midnight, Plum, Black, Navy and Slate presets,
  plus a custom six-digit hex color. Defaults to dark Charcoal without changing the saved glass tint.
- **Compact menus:** on by default with Matching menus; reduces ordinary action-row padding and
  space between groups. Turn it off to restore stock spacing. Rows can grow with larger text;
  custom-height, rich-content and draggable rows keep their original dimensions.
- **Low-power mode:** on by default; optional static wallpaper blur up to 10 px when off.
- **Pause** and **reset (paused):** restore Discord's colors without deleting another plugin's data.

The Midnight Waves image sits underneath the inspected app-level theme/navigation tree, with a
dark fallback while loading/offline. The plugin hides supported theme gradients only after the
image loads in that scope. It also uses a separate noninteractive wallpaper behind the native
chat viewport, with independently wallpaper-backed headers and master-opacity input scrims.
Beta2 gives own/member profiles their own fixed wallpaper with an opaque dark fallback, rather
than exposing the previous screen underneath. Banners, profile effects, scroll containers, and
touch handlers are left intact. The own-profile toolbar's final gradient/fill is retinted after
Discord mixes its colors. Profile action buttons use a scoped dark theme context without profile
primary/secondary colors, so their existing semantic glass colors and pressed states apply.
Cached reply/thread-preview message text colors are normalized at the final native row boundary;
role colors, links, markup, blocked/deleted placeholders, and message bodies remain unchanged.
Beta3 also watches Discord 347's `modules/themes/native/updateTheme.tsx`: the React dark provider
does not update this native theme by itself. While conversations are enabled, native theme updates
are temporarily sent as `dark`; pausing, turning conversations off, or unloading restores the most
recent requested theme (or ThemeStore's current theme if none was intercepted). This never dispatches
an appearance-settings action or changes saved preferences. Missing modules safely skip the patch;
bridge refresh failures are logged. Native reply-preview appearance still needs phone confirmation.
Chat and server-list headers receive clipped, noninteractive wallpaper layers with an opaque dark
offline fallback. Original header controls, layout/safe-area measurements, navigation frames, and
refs stay in place; keyed content slots avoid remounting controls when toggling the preview.
Beta4 extends that backing to the inner floating chat-input pill and to the account bar's
decorative background. Keyboard-padding wrappers, draft-bearing input components, reply context,
autocomplete/emoji siblings, responder callbacks and layout measurements remain in place. Both
the large-avatar mask and small-avatar animated-radius background are preserved, with the animated
nameplate and account controls left outside the patched background.
The separate `UserProfileContactButtons` boundary now receives the same scoped dark context as
own-profile action groups. Valid profile colors become subtle tinted fills and accent outlines,
with a muted violet fallback. An exact semantic-context marker limits these accents to primary/
secondary controls inside those groups; destructive, premium, and toggle tokens are excluded.
Pressed-state colors are distinct, while Discord keeps its existing disabled/loading behavior.
Navigation identities, refs, media, interaction handlers, role/name-style colors, and native
disabled states are retained. A temporary dark theme context is used while preview is active;
the user's saved Discord appearance preference is not modified.

Beta5 adds the approved clean appearance through inspected Discord 347 boundaries. Text-channel
selections use rounded accent fills and fine outlines; supported voice/DM/thread rows use the
shared base-channel renderer. Fixed list measurements, unread/mention logic, selection state,
press/long-press callbacks, and thread/voice content are preserved. The composer adds only a dark
decorative overlay and accent edge inside its existing wallpaper backing, retaining draft input,
keyboard padding, reply/autocomplete siblings and touch targets. Supported action sheets use a
solid glass-tinted background, a subtle top outline, coordinated dismiss handles and transparent
row cards. Existing sheet scroll/keyboard/dismiss behavior, action order, danger variants and
disabled states remain Discord's own. Sheets with custom backgrounds or border gradients keep
their background. Unknown element shapes are skipped; paused styling restores the original
styles. These are visual changes, not a recreation of the concept's navigation or action layout.

Beta6 gives matching menus their own opaque background color and optional compact spacing.
Only ActionSheetRow's inspected TableRow/InternalCard/TableRowInner tree receives the density
change; settings rows are untouched. Standard rows use a 52 dp minimum height and 10 dp vertical
padding, with no fixed height, and sheet group gaps shrink to 8 dp. A wallpaper fill now covers
the account bar's existing measured invisible touch-blocking area, preventing channel text from
showing around its upper edge. Its original hit area, gradient siblings, avatar mask, animated
nameplate and controls stay in place. All new choices are additive; existing saved settings survive.
Final menu density and account-bar appearance still need confirmation on the Android phone.

Beta7 adds **Appearance Studio**, opened from the plugin settings, and a **Home** shortcut beside
the Messages heading. Home shows up to 24 favorite servers, 24 pinned friends, eight recent
conversations and your shared Spotify activity with album art when available. These use Discord's
cached records and existing navigation actions; opening a friend does not send a message or join
a call. Empty sections explain what to choose or load. The music card opens the track in Spotify;
it does not control playback.

Beta11 adds a matching **Friends** shortcut immediately beside **Home** at the top of Messages.
It opens Discord's full friends list directly, even if Add Friends was visited previously.
Both buttons follow **Home & Friends shortcuts** under Studio's **Finishing touches**.
The native header height and search/message actions are preserved; long headings truncate on
narrow screens to leave room for both shortcuts. The Friends row styling is unchanged in this update.

Beta12 fixes clipping in styled Friends rows. The custom style now preserves TableRow's zero-padding
outer wrapper; previously, it let the underlying Card add 16 px of padding and push avatars, activity
text and action buttons below their measured cells. Native row heights, inner spacing and actions are
preserved. The regression check models the TableRow-to-Card style precedence, including rows without
an explicit style. Reload Discord after updating.

Studio provides app and Home wallpapers, photo selection and HTTPS image URLs. Choose a server
or DM under **People & places** to override its conversation wallpaper and accent. A DM override
wins over a server override, then the app wallpaper; clearing an override restores inheritance.
Headers, bottom bars and the native chat viewport observe the selection. Root and profile
backdrops use the app wallpaper. Image-load failures keep readable backings, and stale loads from
another conversation cannot reveal an old wallpaper. Local photo URIs may need to be selected
again if Android revokes access or the file moves. Up to 100 scene overrides are retained.

Optional finishing touches include a decorative floating server rail and slim unread marks,
nine original thin-line icons, rounded search-media and media-post thumbnails, calmer embed
cards, compact in-app notification banners, coordinated native reaction colors, a minimal
composer, and orbital empty-screen artwork or a chosen photo. Notification actions, native
spoiler protections, gallery dimensions, avatar cutouts, drag gestures and unread counts remain
Discord's own. The app-launcher shortcut stays available while its panel is active. The gift
toggle targets the gift component; thread controls are not hidden. All native patches are scoped
to inspected Discord 347 components and skip unrecognized layouts. The icon source can be
regenerated with `scripts/generate-full-app-icons.py` and Pillow; installing the plugin does not
require Python.

Typography offers Discord, soft sans, serif and mono interface fonts plus label letter spacing.
Code text is excluded. **Discord text size** explicitly calls Discord's existing Android font
setting, preserving its classic-chat option. Unlike temporary Glass styling, this is a saved
Discord preference: it remains when Glass is paused or unloaded; select **100%** to restore the
default. No font changes are applied automatically. Custom chat-message font families, username
weights and message-group spacing are not exposed by the audited native message renderer.

Settings and Home share a serialized save queue with rollback on failure. Presence updates
refresh Home without repainting every themed icon or label. The additive beta7 settings retain
the existing enabled state, colors and area switches; new installs continue to start paused.
Local checks include TypeScript, normalized repository lint, all 168 tests, all 12 JavaScript
plugin builds, Classic loader checks and ZIP-content verification. An interactive DOM adapter
exercises the actual Studio component at 320 and 430 pixel widths, including picker wiring and
save-error recovery. This is a layout check, not Android execution; phone verification of the
new hooks, image access, keyboard, navigation, font setting and restart persistence is required.

Beta8 adds **Set the mood** and **Feel & focus** in Appearance Studio:

- **Midnight, Ice, Rose and OLED** coordinate the app/Home backdrop, panel colors and accents.
  Presets use native gradients without new downloads; OLED uses solid black. Applying a preset
  replaces app/Home wallpaper selections. **Restore previous look** restores the last look during
  that Studio session. Pins, per-conversation scenes, area switches and power settings are retained.
- **Ambient light** drifts on a 24-second native animation loop. **Gentle motion** adds soft presses
  to Studio/Home buttons and a fading Studio transition. Both respect system reduced motion,
  low-power mode, background app state and focus mode. OLED stays still. Existing low-power settings
  are preserved; **Enable motion** explicitly turns low-power mode off. All surfaces share one pair
  of OS listeners, and animation loops stop on plugin shutdown, even before mounted UI is removed.
- **Matching calls** styles inspected voice-panel cards and native speaking borders, along with
  supported legacy audio-call avatars and controls. Native speaking widths, focus/PIP rules, video
  children, gesture handlers, muted/selected states and red destructive buttons stay native.
- **Glass search** styles the native search input, result rows/cards, recent-search headings and
  search screen background. Query tags, input refs, search history, clear-history actions, native
  result navigation, spoilers, safe-area insets and virtual-list geometry are retained.
- **Focus mode** is available in Studio and as an enter/exit shortcut on Home. It gives the interface
  solid backdrops, stops decorative motion and empty-state art, hides the Home music card, and hides
  optional gift/apps shortcuts while keeping an already-open app launcher available. Exiting restores
  the saved look. It does not mute notifications, alter presence or change channel notification settings.

Beta8 keeps new installations paused and migrates beta7 settings additively. A missing gradient module
uses a static tint; unknown call/search layouts keep their original output. The browser preview uses
the actual Studio and styling functions with sample components/data, not an Android Discord session.
Native phone testing is still needed for both call layouts, speaking/PIP transitions, keyboard/search
behavior and animation smoothness on the target device.

Local beta8 validation passes TypeScript, 178 tests, normalized full-repository lint, all 12 JavaScript
plugin builds, archive verification, Classic compatibility checks, and interactive previews at 320
and 430 pixel widths. Motion tests cover accessibility, backgrounding and shutdown cleanup.

Beta9 adds **Avatar styles** and **Profile design** to Appearance Studio:

- Choose Discord, Circle, Rounded or Soft square avatar shapes and No border, Subtle or Accent
  borders. Supported native Avatar image slots keep their source, animation, loading callbacks,
  size and status layers. Native status cutouts are preserved; decorated, speaking, muted/deafened,
  stage and channel avatars stay unchanged. Older SVG masks and separately rendered native chat
  avatars are not reshaped. These changes affect only this device's view of Discord.
- Profile cards and sections receive soft corners and coordinated borders. A framed avatar backing
  follows the existing banner overlap without moving the native avatar or its media-viewer ref.
  A static fade softens both own and member banner edges while preserving images, GIF interaction,
  native scroll refs, animated styles and profile-effect layers.
- Connection rows use less padding and a 48-pixel minimum height; they remain free to grow with
  larger text. Compact styling is scoped to native account and application-role connection cards.
- Connection headings can collapse or expand their contents. Sections start expanded for another
  user, and collapsed links remain mounted but hidden from accessibility navigation. Native privacy
  filtering, account verification indicators, link/long-press actions and trailing controls remain
  intact. Other profile details and actions are not made collapsible.
- The avatar controls and profile design have separate master switches. Profile design respects the
  existing Profiles area switch; all changes stop when the plugin is paused or unloaded. Existing
  settings migrate additively, and new installations still start paused.

Beta9 local validation passes TypeScript, 185 tests, normalized full-repository lint, JavaScript
builds and archive checks. The interactive preview exercises the actual Studio and styling functions
with sample components at 320 and 430 pixel widths, including larger connection text, preset controls,
save-failure rollback and collapse accessibility. This is not native Android verification: final phone
QA should cover decorated/status avatars, own/member profiles, GIF banners, media viewing and scrolling.

Beta10 adds **Your signature**, **Lists & cards**, and **Chat details** to Customize:

- A small, static butterfly or star motif on Home, selected Studio tabs and built-in empty artwork.
  Choose None to remove it. The motif uses native primitives, requires no downloads, and stays out
  of touch and accessibility navigation.
- Rounded Friends rows and action backings, scoped to the Friends screen. DM rows receive a quiet
  backing, accent outline and selected tint. Native row heights, status/unread indicators, actions,
  accessibility, blocked/muted state and previews are preserved. Nameplate rows remain native.
- Forum list/grid cards and their disabled previews receive coordinated borders and corners.
  Native filtering, post press/long-press actions and measured content remain intact.
- Server invite cards receive matching backing, border and icon corners; native splash images,
  member counts, acceptance rules and disabled/error button colors are preserved.
- Media frames decorate search, forum and media-channel thumbnails. Native chat image/video
  attachments receive a matching background only; their corners, grid spacing and frame layout
  are controlled by Android. Spoilers, age gates, GIF behavior and media actions are unchanged.
- Voice messages receive a matching native playback background and a framed recording pill.
  Android still draws the playback waveform, play button and progress; this plugin does not replace
  them. Recording warnings, duration, cancel/send controls and animated styles remain intact.
- The native Jump to Present/return-target button becomes a 56 by 48 accent capsule. Its real
  action, accessibility label, keyboard/voice-panel positioning and press animation are retained;
  the voice-panel dismiss alternative and unrelated floating buttons are unchanged.
- Everyday system notices receive accent timestamps and selection highlights. Their text, actions
  and native layout are preserved. Moderation/safety notices and unknown types remain native.

Each detail has its own switch; settings migrate additively and new installs remain paused.
List/card changes respect Main screens, chat changes respect Chats, and the jump button also respects
Controls. Unknown component shapes are skipped. Beta10 is a JavaScript-only package for Discord 347;
native message colors are cached, so reopen the channel or reload Discord after changing them.
The plugin does not claim custom layouts for Android-native message rows. Automated validation covers native
data preservation, React component guards, scope/toggle behavior and plugin teardown. Native Android
verification remains required for virtualized lists, unread scrolling, media gates and audio playback.

This is **wallpaper-backed translucency inside Discord**, not a transparent Android window,
screen capture, or live iOS Liquid Glass blur. Opaque native screens, media viewers, video surfaces,
and some separately hosted modals may not reveal the root wallpaper. With **Matching menus** on,
supported action sheets stay opaque for readability. Other highly transparent overlays can show
underlying content through them; reduce transparency if needed. Android
347.x phone verification is still required for full coverage, keyboard/navigation behavior,
restart persistence, and interaction with other plugins. No new native saver or root access is used.

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
build/dist/com.cuddled.liquidglass@1.0.0-beta7.zip
build/dist/com.cuddled.fullappglass@1.0.0-beta12.zip
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
