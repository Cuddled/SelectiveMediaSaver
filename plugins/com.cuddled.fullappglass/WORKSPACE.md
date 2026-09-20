# Workspace beta15

Workspace adds ten connected tools to Full-App Glass on Discord Android 347.x.
Open **Home → Open Workspace**, or tap **✧ Tools** inside a conversation. Hold
the chat button to open the gesture wheel. Existing theme settings are preserved.

| Tool | Working behavior |
| --- | --- |
| Conversation lenses | Search loaded messages; filter media, links, question marks and reply relationships; bookmark and jump to original messages. |
| Floating peek | Keep the most recent loaded messages from another conversation over the current chat; move the panel up/down; open the native conversation to reply. |
| Media Studio | Automatically search older images/videos in the selected conversation, newest first, with progress and pause/resume; browse thumbnails, collections, tags, timestamps and playback ranges. |
| Gesture wheel | Tap or drag to six configurable shortcuts. The center cancels; screen-reader button actions remain available. |
| Personal rules | Apply a scene and suggest a tool while a channel/server/voice condition matches; first enabled matching rule wins. The saved look returns when the rule stops matching. |
| Notebooks | Per-conversation notes, private follow-ups and message bookmarks. |
| Voice-note tools | Play voice attachments; 1×/1.5×/2× speed, skip/seek, timestamp bookmarks and searchable timestamped transcripts supplied by the user. |
| Home builder | Reorder/remove/add six widget types, switch compact/roomy cards, save/apply named layouts. |
| Reactive atmosphere | Blend stable colors derived from track or server identity, or change accent with voice activity. The saved palette stays intact. |
| Session restore | Save a conversation, visible message anchor, notebook context and scene; restore through Discord's native message navigation. |

## Current boundaries

- This is a first implementation, not a promise of pixel-identical native rendering.
  Phone QA is still required on the supported Discord/Revenge build.
- Lenses, peeks and voice tools use messages already loaded by Discord. Opening an
  original message uses Discord's normal navigation and loading behavior.
- Media Studio automatically pages Discord 347's native media-search endpoint for
  the selected conversation. It does not scroll chat, change the visible search,
  acknowledge unread messages, or search other channels. Each page is scoped and
  permission-checked; blocked/ignored search results and age-gated channels are excluded.
  Results include uploaded images/videos and images served by Discord's embed proxy.
  Deleted, inaccessible, expired or not-yet-indexed media may be unavailable.
- Loading stops on pause, leaving Media Studio, backgrounding the app, permission
  loss, account change or unloading. Foregrounding resumes an automatically paused
  load. A manually paused load resumes with **Resume loading**. Discord's retry delays
  survive pause/resume and refresh; repeated indexing/rate-limit replies pause for retry.
- Search metadata stays in memory for the current conversation; message text and
  signed URLs are not saved to plugin storage. Only 24 thumbnails render per gallery
  page. For very large conversations, **Browse older batch** continues after 5,000
  media-bearing messages while releasing the prior batch; **Refresh media** returns
  to the latest results. Partial indexing is labeled instead of claiming completion.
- The library stores attachment identifiers and personal metadata, not permanent
  copies or expiring CDN URLs. Reopen a message to refresh an expired/unloaded link.
- Playback uses Discord's media WebView. Open a video once if that optional module
  has not initialized. Playback pauses when the app backgrounds and unmounts when
  the tool closes. Clip ranges are playback selections, not exported edited files.
- Transcripts must be pasted/typed as `m:ss text` lines. There is no bundled speech
  recognition engine, cloud transcription, automatic storyboard extraction, or
  media-upload action. Original voice messages are left intact.
- Music/server accents are deterministic color assignments, not album-art color
  extraction. Voice activity changes the accent without recording audio. Focus,
  OLED, low-power mode, and reduced-motion behavior are preserved.
- Scroll tracking wraps the audited 347 `useScrollHandlers` input and preserves
  the original handler and return value. Unknown shapes are left alone. If an
  anchor is unavailable, the session UI labels its latest-loaded-message fallback;
  “Save session here” in Lenses provides an explicit alternative.
- Active appearance rules may override a restored scene while their condition is
  still true. Pause the rule to keep the restored scene visible.

## Storage and lifecycle

Private data is scoped by the signed-in Discord user ID in plugin storage. Account
changes close private screens and clear floating peeks/reading positions. Normal
Discord channel permission checks are required before viewing cached messages or
navigating saved references. Age-gated channels remain in Discord's native UI.

Data is local plugin storage, not an encrypted vault or cloud backup. The bounded
store supports eight accounts, 100 notebooks per account, 200 bookmarks, 150 media
entries, 24 rules, 24 sessions and eight named layouts. Histories retain the newest
entries; notebook/account limits reject additional writes instead of discarding
existing notes. Notes, metadata and layouts save on explicit actions. Failed
writes restore the prior saved state and display an error.

**Pause workspace tools** removes the chat shortcut and automatic rule/reactive
appearance. **Reset personal workspace** requires confirmation and only clears the
current account. Unloading removes subscriptions, timers, wrappers and theme overrides.

## Validation

Automated tests cover automatic pagination, deduplication, search scope, retry delays,
cancellation, late responses, cursor validation, large-history continuation, image
proxies, migration, bounded storage, account isolation, permission
changes, scene restoration, native handler preservation, navigation, playback
document isolation, transcripts, shortcuts, persistence failures and disposal.
Browser QA renders the actual React components through a React Native adapter and
exercises all ten screens at phone widths. It does not substitute for Android
playback, gestures, keyboard or overlay testing on a physical device.
