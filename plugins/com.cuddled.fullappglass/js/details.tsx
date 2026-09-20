import { hexWithAlpha } from '../../com.cuddled.liquidglass/js/core'
import { ABSOLUTE_FILL } from '../../com.cuddled.liquidglass/js/wallpaper'
import { atPath } from './studioSurfaces'
import type * as ReactTypes from 'react'
import type { Settings } from './core'
import type { Access } from './surfaces'

type ReactApi = typeof ReactTypes
type Element = ReactTypes.ReactElement<Record<string, any>>
const element = (React: ReactApi, value: unknown): value is Element =>
	React.isValidElement<Record<string, any>>(value)
const record = (value: unknown): value is Record<string, any> =>
	!!value && typeof value === 'object' && !Array.isArray(value)
const JUMP_MARKER = '__fullAppGlassJumpButton'

export const DETAIL_HOOKS = [
	[
		'modules/main_tabs_v2/native/friends/screens/FriendsScreen.tsx',
		['default'],
		'friends-scope',
	],
	[
		'modules/main_tabs_v2/native/shared_components/user_list/UserRow.tsx',
		['default', 'type'],
		'friend-row',
	],
	['components_native/common/ActionButton.tsx', ['default'], 'friend-action'],
	[
		'modules/main_tabs_v2/native/tabs/messages/items/channel/MessagesItemChannelBase.tsx',
		['default', 'type'],
		'dm-row',
	],
	[
		'modules/forums/native/posts/ForumPostContainer.tsx',
		['ForumPostPressableContainer'],
		'forum',
	],
	[
		'modules/forums/native/posts/ForumPostContainer.tsx',
		['ForumPostDisabledContainer'],
		'forum-disabled',
	],
	[
		'modules/forums/native/posts/ForumPostMedia.tsx',
		['ForumPostMediaThumbnail'],
		'forum-media',
	],
	[
		'modules/forums/native/posts/ForumPostMedia.tsx',
		['ForumPostGridMedia'],
		'forum-media',
	],
	['components_native/chat/JumpToPresentButton.tsx', ['default'], 'jump-root'],
	[
		'modules/chat_input/native/ChatFloatingNavButton.tsx',
		['default'],
		'jump-button',
	],
	[
		'modules/voice_messages/native/components/VoiceMessageChat.tsx',
		['default', 'type'],
		'voice-recording',
	],
] as const
export type DetailKind = (typeof DETAIL_HOOKS)[number][2]

export function detailStyles(settings: Settings) {
	return {
		row: {
			borderRadius: 18,
			backgroundColor: hexWithAlpha(settings.panelColor, 0.68),
		},
		selected: {
			borderRadius: 18,
			backgroundColor: hexWithAlpha(settings.accentColor, 0.15),
		},
		outline: {
			...ABSOLUTE_FILL,
			borderRadius: 18,
			borderWidth: 1,
			borderColor: hexWithAlpha(settings.accentColor, 0.24),
		},
		card: {
			borderRadius: 22,
			backgroundColor: hexWithAlpha(settings.panelColor, 0.94),
			borderWidth: 1,
			borderColor: hexWithAlpha(settings.accentColor, 0.24),
		},
		media: {
			borderRadius: 16,
			borderWidth: 1,
			borderColor: hexWithAlpha(settings.accentColor, 0.38),
			overflow: 'hidden' as const,
		},
	}
}

/** Pure transformations of inspected Discord 347 outputs. Never change list heights. */
export function styleDetail(
	React: ReactApi,
	View: any,
	kind: DetailKind,
	original: unknown,
	props: Record<string, any>,
	settings: Settings,
	inFriends = false,
): unknown {
	if (!element(React, original)) return original
	// Mark only the real jump button, not the voice-panel dismiss alternative.
	if (kind === 'jump-root') {
		const child = original.props.children
		return element(React, child) &&
			typeof child.props.onPress === 'function' &&
			typeof child.props.accessibilityLabel === 'string' &&
			child.props.icon != null
			? React.cloneElement(
					original,
					{},
					React.cloneElement(child, { [JUMP_MARKER]: true }),
				)
			: original
	}
	if (!settings.enabled) return original
	const styles = detailStyles(settings)
	const studio = settings.studio
	if (kind === 'friend-row') {
		if (
			!settings.mainScreens ||
			!studio.friendList ||
			!inFriends ||
			!props.user?.id ||
			props.guildId != null ||
			original.props.nameplate != null ||
			Object.hasOwn(original.props, 'checked') ||
			!Object.hasOwn(original.props, 'label') ||
			!Object.hasOwn(original.props, 'subLabel') ||
			typeof original.props.onPress !== 'function' ||
			original.props.height !== '100%'
		)
			return original
		return React.cloneElement(original, {
			radius: 18,
			// TableRow's inner body is 100% of a measured row; a new border would add height.
			style: [original.props.style, styles.row],
		})
	}
	if (kind === 'friend-action') {
		const child = original.props.children
		if (
			!settings.mainScreens ||
			!studio.friendList ||
			!inFriends ||
			!element(React, child) ||
			child.props.variant !== 'tertiary' ||
			typeof child.props.onPress !== 'function' ||
			!child.props.icon
		)
			return original
		return React.cloneElement(original, {
			style: [
				original.props.style,
				{
					borderRadius: 14,
					backgroundColor: hexWithAlpha(settings.accentColor, 0.08),
				},
			],
		})
	}
	if (kind === 'dm-row') {
		const pressable = original.props.children
		if (
			!settings.mainScreens ||
			!studio.dmList ||
			original.props.collapsable !== false ||
			!element(React, pressable) ||
			pressable.props.accessibilityRole !== 'button' ||
			typeof pressable.props.onPress !== 'function' ||
			!Array.isArray(pressable.props.children) ||
			pressable.props.children.length !== 5
		)
			return original
		const [nameplate, selected, unread, avatar, content] =
			pressable.props.children
		if (
			!element(React, nameplate) ||
			nameplate.props.nameplate != null ||
			!element(React, content) ||
			typeof content.props.channelSelected !== 'boolean'
		)
			return original
		return React.cloneElement(
			original,
			{},
			React.cloneElement(
				pressable,
				{
					style: [
						pressable.props.style,
						content.props.channelSelected ? styles.selected : styles.row,
					],
				},
				[
					nameplate,
					element(React, selected)
						? React.cloneElement(selected, {
								style: [selected.props.style, styles.outline],
								pointerEvents: 'none',
							})
						: selected,
					unread,
					avatar,
					content,
					React.createElement(View, {
						key: 'glass-dm-outline',
						pointerEvents: 'none',
						accessible: false,
						importantForAccessibility: 'no-hide-descendants',
						style: styles.outline,
					}),
				],
			),
		)
	}
	if (kind === 'forum') {
		if (!settings.mainScreens || !studio.forumCards || !props.threadId)
			return original
		return atPath(React, original, ['child', 'child'], card =>
			card.props.variant === 'surface-high' &&
			card.props.accessibilityRole === 'button' &&
			typeof card.props.onPress === 'function' &&
			typeof card.props.onLongPress === 'function'
				? React.cloneElement(card, {
						radius: 22,
						style: [card.props.style, styles.card],
					})
				: card,
		)
	}
	if (kind === 'forum-disabled') {
		return settings.mainScreens &&
			studio.forumCards &&
			original.props.pointerEvents === 'none' &&
			Object.hasOwn(original.props, 'style')
			? React.cloneElement(original, {
					style: [original.props.style, styles.card],
				})
			: original
	}
	if (kind === 'forum-media') {
		if (
			!settings.mainScreens ||
			!studio.mediaFrames ||
			typeof original.props.shouldSpoiler !== 'boolean' ||
			!original.props.source ||
			!Object.hasOwn(original.props, 'androidStyle') ||
			!Object.hasOwn(original.props, 'containerStyle')
		)
			return original
		return React.cloneElement(original, {
			containerStyle: [
				original.props.containerStyle,
				{ borderRadius: 16, overflow: 'hidden' },
			],
			// Border stays inside the explicitly sized media image, not outside its container.
			androidStyle: [original.props.androidStyle, styles.media],
			iosStyle: [original.props.iosStyle, styles.media],
		})
	}
	if (kind === 'jump-button') {
		const pill = original.props.children
		if (
			!settings.chats ||
			!settings.controls ||
			!studio.jumpToLatest ||
			props[JUMP_MARKER] !== true ||
			original.props.accessibilityRole !== 'button' ||
			typeof original.props.onPress !== 'function' ||
			!element(React, pill) ||
			!element(React, pill.props.children) ||
			!pill.props.children.props.source
		)
			return original
		// Retain the native pressed animation and icon, and only decorate this button.
		return React.cloneElement(
			original,
			{
				style: [
					original.props.style,
					{
						minWidth: 48,
						minHeight: 48,
						justifyContent: 'center',
						alignItems: 'center',
					},
				],
			},
			React.cloneElement(
				pill,
				{
					style: [
						pill.props.style,
						{
							width: 56,
							height: 48,
							borderRadius: 24,
							borderWidth: 1,
							borderColor: hexWithAlpha(settings.accentColor, 0.65),
						},
					],
				},
				React.cloneElement(pill.props.children, {
					style: [
						pill.props.children.props.style,
						{ tintColor: settings.accentColor },
					],
				}),
			),
		)
	}
	if (kind === 'voice-recording') {
		if (
			!settings.chats ||
			!studio.voiceMessages ||
			typeof props.isRecording !== 'boolean' ||
			!Array.isArray(original.props.children) ||
			original.props.children.length !== 5 ||
			!Object.hasOwn(original.props, 'style')
		)
			return original
		// Preserve the native animated background, recording warning, waveform and controls.
		return React.cloneElement(original, {
			style: [
				original.props.style,
				{
					borderRadius: 24,
					borderWidth: 1,
					borderColor: hexWithAlpha(settings.accentColor, 0.55),
				},
			],
		})
	}
	return original
}

function color(processColor: (value: string) => unknown, value: string) {
	try {
		const result = processColor(value)
		return typeof result === 'number' && Number.isFinite(result)
			? result
			: undefined
	} catch {
		return undefined
	}
}

/** Only fields emitted by native row builders are changed. No invented native props. */
export function styleGuildInvite(
	settings: Settings,
	original: unknown,
	processColor: (value: string) => unknown,
) {
	if (
		!settings.enabled ||
		!settings.chats ||
		!settings.studio.inviteCards ||
		!record(original) ||
		typeof original.backgroundColor !== 'number' ||
		typeof original.borderColor !== 'number' ||
		typeof original.thumbnailCornerRadius !== 'number'
	)
		return original
	const backgroundColor = color(
		processColor,
		hexWithAlpha(settings.panelColor, 0.96),
	)
	const borderColor = color(
		processColor,
		hexWithAlpha(settings.accentColor, 0.36),
	)
	if (backgroundColor == null || borderColor == null) return original
	// Keep splash, counts, native accept/join states and all error/disabled colors.
	return {
		...original,
		backgroundColor,
		borderColor,
		thumbnailCornerRadius: 18,
	}
}

export function styleNativeMessage(
	settings: Settings,
	original: unknown,
	processColor: (value: string) => unknown,
) {
	if (!settings.enabled || !settings.chats || !record(original)) return original
	let next = original
	if (
		settings.studio.voiceMessages &&
		typeof original.flags === 'number' &&
		(original.flags & 8192) !== 0 &&
		typeof original.audioAttachmentBackgroundColor === 'number'
	) {
		const backgroundColor = color(
			processColor,
			hexWithAlpha(settings.panelColor, 0.96),
		)
		if (backgroundColor != null)
			next = { ...next, audioAttachmentBackgroundColor: backgroundColor }
	}
	return next
}

export function styleSystemNotice(
	settings: Settings,
	original: unknown,
	processColor: (value: string) => unknown,
) {
	// Routine social notices only. Moderation, safety and unknown types stay native.
	if (
		!settings.enabled ||
		!settings.chats ||
		!settings.studio.systemNotices ||
		!record(original) ||
		![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 18, 67].includes(
			original.type,
		) ||
		typeof original.timestampColor !== 'number' ||
		typeof original.highlightColor !== 'number'
	)
		return original
	const timestampColor = color(processColor, settings.accentColor)
	const highlightColor = color(
		processColor,
		hexWithAlpha(settings.accentColor, 0.12),
	)
	if (timestampColor == null || highlightColor == null) return original
	return { ...original, timestampColor, highlightColor }
}

export function styleAttachments(
	settings: Settings,
	original: unknown,
	processColor: (value: string) => unknown,
) {
	if (
		!settings.enabled ||
		!settings.chats ||
		!settings.studio.mediaFrames ||
		!Array.isArray(original)
	)
		return original
	const backgroundColor = color(
		processColor,
		hexWithAlpha(settings.panelColor, 0.96),
	)
	if (backgroundColor == null) return original
	let changed = false
	const next = original.map(item => {
		if (
			!record(item) ||
			!['image', 'video'].includes(item.attachmentType) ||
			typeof item.backgroundColor !== 'number'
		)
			return item
		changed = true
		return { ...item, backgroundColor }
	})
	return changed ? next : original
}

export function createDetailSurfaces(
	React: ReactApi,
	native: Record<string, any>,
	access: Access,
) {
	let alive = true
	const FriendsScope = React.createContext(false)
	function Surface({
		kind,
		original,
		props = {},
	}: {
		kind: DetailKind
		original: unknown
		props?: Record<string, any>
	}) {
		React.useSyncExternalStore(
			access.subscribe,
			access.getSnapshot,
			access.getSnapshot,
		)
		const inFriends = React.useContext(FriendsScope)
		const current = access.getSettings()
		const settings =
			alive && access.isActive() ? current : { ...current, enabled: false }
		if (kind === 'friends-scope')
			return React.createElement(
				FriendsScope.Provider,
				{ value: true },
				original as ReactTypes.ReactNode,
			)
		return styleDetail(
			React,
			native.View,
			kind,
			original,
			props,
			settings,
			inFriends,
		) as ReactTypes.ReactNode
	}
	class Guard extends React.Component<
		{ original: unknown; children?: ReactTypes.ReactNode },
		{ failed: boolean }
	> {
		state = { failed: false }
		static getDerivedStateFromError() {
			return { failed: true }
		}
		componentDidCatch(error: unknown) {
			console.warn('[FullAppGlass] Detail styling unavailable:', error)
		}
		render() {
			return this.state.failed
				? (this.props.original as ReactTypes.ReactNode)
				: this.props.children
		}
	}
	return {
		wrap(kind: DetailKind, original: unknown, props?: Record<string, any>) {
			return alive && element(React, original)
				? React.createElement(
						Guard,
						{ original },
						React.createElement(Surface, { original, kind, props }),
					)
				: original
		},
		dispose() {
			alive = false
		},
	}
}
