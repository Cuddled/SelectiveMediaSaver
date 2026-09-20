# Original Media Mode

NoCompression **1.1.0-beta1**, for Revenge Next / Discord Android 347.
The plugin ID stays `com.cuddled.nocompression`; existing installations upgrade
in place. Restart Discord after upgrading from the JavaScript-only 1.0.0 release
to load this release's Android component.

## Controls

- Plugin settings: enable/pause Original Media Mode, keep original images, and
  keep original videos. Both media types default to original.
- Tap a pending attachment to open Discord's attachment preview. **Original**
  and **Compress this upload** apply only to that attachment.
- Originals above the live channel/account limit prompt for **Compress this
  upload** or **Cancel**. Compression uses Discord's normal settings; it does
  not guarantee the resulting file will fit.
- If the original cannot be read/prepared or its limit cannot be determined,
  the same explicit choice is required. No silent compression fallback.

The selected source is copied byte-for-byte through Android's content resolver
into app-private cache, without image decoding, JPEG conversion, resizing,
video transcoding, or loading a whole file into JavaScript memory. This retains
embedded metadata, HDR, animation and audio along with the source bytes.
An earlier edit/crop in Discord or another app still defines the selected file;
the plugin cannot undo edits made before attachment selection. Discord may
generate separate compressed previews; the uploaded original is the target.
Formats unsupported by a recipient's player may arrive as downloadable files.

## Compatibility and lifecycle

Only React Native message image/video uploads are intercepted. Avatars, banners,
shop files, documents, voice notes, and web-platform uploads retain their native
paths. Filenames, spoilers, descriptions, dimensions, and native payload/size
validation are retained. The old global upload-target override is removed.

Decisions are per upload, including concurrent mixed image/video batches.
Oversize dialogs are serialized. Pending work is canceled on plugin pause,
unload, account change or native attachment cancellation. A late copy cannot
resume an upload after cancellation. Turning the plugin off removes the hooks.
Already prepared files continue through the native uploader using the mode
chosen before preparation; remove and reattach to change them.

Two native copy streams run at a time with a 64 KiB buffer. Cache reservations
are bounded to 2 GiB with a free-space check. Copies are released when their
draft uploads are canceled/removed. Unleased copies older than 24 hours are
cleaned on a subsequent preparation, including leftovers after an app restart.
The copy bound uses the native limit, never a hard-coded Nitro entitlement.

Unknown attachment-preview trees are left intact. The settings defaults and
oversize dialog still operate if that optional menu insertion is unavailable.

## Validation

TypeScript tests cover per-file decisions, concurrent batches, exact boundaries,
oversize approval/cancellation, account changes, unload, invalid bridge results,
native function/receiver preservation, menu insertion and dialog dismissal.
JVM tests exercise the actual streaming copy for byte equality, limits, partial
reads and cancellation. Browser UI QA uses the actual React controls with native
adapters. Physical Android testing remains necessary for real gallery providers,
the current upload preview, native upload completion and recipient playback.
