import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { createState, normalize } from './core'
import {
	createDetailSurfaces,
	DETAIL_HOOKS,
	styleAttachments,
	styleDetail,
	styleGuildInvite,
	styleNativeMessage,
	styleSystemNotice,
} from './details'
import { SignatureMotif } from './motif'
import type { DetailKind } from './details'

const e = (
	type: any,
	props: any = {},
	children?: any,
): React.ReactElement<any> => React.createElement(type, props, children)
const flatten = (value: any): any =>
	Array.isArray(value) ? Object.assign({}, ...value.map(flatten)) : value
const settings = normalize({ enabled: true })
const press = () => {}
const style = (
	kind: DetailKind,
	original: unknown,
	props: any = {},
	value = settings,
	scope = false,
): any => styleDetail(React, 'View', kind, original, props, value, scope)
const processColor = (value: string) => Number.parseInt(value.slice(1, 7), 16)

test('beta9 settings migrate additively and each new preference can be disabled', () => {
	const studio = {
		signatureMotif: 'star',
		friendList: false,
		forumCards: false,
		inviteCards: false,
		dmList: false,
		systemNotices: false,
		voiceMessages: false,
		jumpToLatest: false,
		mediaFrames: false,
		avatarShape: 'soft',
		profileLayout: false,
		favorites: ['123456789012345678'],
		mood: 'rose',
	}
	const next = normalize({ enabled: false, studio })
	for (const [key, value] of Object.entries(studio))
		assert.deepEqual((next.studio as any)[key], value)
	assert.equal(next.enabled, false)
	assert.equal(
		normalize({
			studio: { signatureMotif: 'unexpected', mediaFrames: 'false' },
		}).studio.signatureMotif,
		'butterfly',
	)
	assert.equal(
		normalize({ studio: { mediaFrames: 'false' } }).studio.mediaFrames,
		true,
	)
	assert.equal(
		normalize({ studio: { signatureMotif: 'none' } }).studio.signatureMotif,
		'none',
	)
})

test('friend cards preserve measured height, native profile actions, labels and accessibility', () => {
	const row = e('TableRow', {
		height: '100%',
		label: e('Name'),
		subLabel: e('Activity'),
		icon: e('Avatar'),
		trailing: e('Actions'),
		onPress: press,
		onLongPress: press,
		onAccessibilityAction: press,
		disabled: false,
		style: { padding: 0 },
		ref: React.createRef(),
	})
	const props = { user: { id: '123' } }
	const result = style('friend-row', row, props, settings, true)
	assert.equal(result.type, row.type)
	for (const key of Object.keys(row.props).filter(k => k !== 'style'))
		assert.equal(result.props[key], row.props[key])
	assert.equal(result.props.radius, 18)
	assert.equal(result.props.style[0], row.props.style)
	assert.equal(flatten(result.props.style).height, undefined)
	assert.equal(
		style('friend-row', row, props),
		row,
		'other user lists are untouched',
	)
	assert.equal(
		style('friend-row', row, { ...props, guildId: 'guild' }, settings, true),
		row,
	)
	for (const extra of [{ nameplate: {} }, { checked: false }, { height: 90 }]) {
		const special = e('SpecialRow', { ...row.props, ...extra })
		assert.equal(style('friend-row', special, props, settings, true), special)
	}
	assert.equal(
		style(
			'friend-row',
			row,
			props,
			normalize({ enabled: true, studio: { friendList: false } }),
			true,
		),
		row,
	)
})

test('friend action decoration preserves call/message buttons and leaves positive actions alone', () => {
	const button = e('IconButton', {
		icon: e('ChatIcon'),
		onPress: press,
		accessibilityLabel: 'Message',
		variant: 'tertiary',
		disabled: true,
	})
	const root = e('View', { style: { marginLeft: 12 } }, button)
	assert.equal(
		style('friend-action', root, {}, settings, true).props.children,
		button,
	)
	assert.equal(style('friend-action', root), root)
	const positive = e(
		'View',
		{},
		e('IconButton', { ...button.props, variant: 'active' }),
	)
	assert.equal(style('friend-action', positive, {}, settings, true), positive)
})

function dm(selected = false, nameplate?: unknown) {
	const children = [
		e('Nameplate', { nameplate }),
		selected ? e('Selected', { style: { borderWidth: 1 } }) : null,
		e('Unread', { count: 8 }),
		e('AvatarScope', { status: 'dnd' }),
		e('Content', { channelSelected: selected, blocked: true, muted: true }),
	]
	const pressable = e(
		'PressableHighlight',
		{
			style: { flex: 1 },
			accessibilityRole: 'button',
			accessibilityLabel: 'Sam, 8 unread messages',
			accessibilityHint: 'Muted',
			onPress: press,
			onLongPress: press,
			onPressIn: press,
			onPressOut: press,
		},
		children,
	)
	return e(
		'View',
		{
			collapsable: false,
			style: { height: 76, overflow: 'hidden' },
			ref: React.createRef(),
		},
		pressable,
	)
}
test('DM decoration preserves list geometry, unread/nameplate semantics, gesture callbacks and children', () => {
	for (const selected of [false, true]) {
		const original = dm(selected)
		const result = style('dm-row', original)
		assert.equal(result.props.style, original.props.style)
		assert.equal(result.props.ref, original.props.ref)
		const before = original.props.children
		const after = result.props.children
		for (const key of [
			'onPress',
			'onLongPress',
			'onPressIn',
			'onPressOut',
			'accessibilityLabel',
			'accessibilityHint',
		])
			assert.equal(after.props[key], before.props[key])
		for (const index of [0, 2, 3, 4])
			assert.equal(after.props.children[index], before.props.children[index])
		assert.equal(after.props.children[5].props.pointerEvents, 'none')
		assert.equal(
			after.props.children[5].props.importantForAccessibility,
			'no-hide-descendants',
		)
		assert.equal(flatten(after.props.style).height, undefined)
	}
	const decorated = dm(true, { asset: 'native' })
	assert.equal(style('dm-row', decorated), decorated)
})

test('forum cards preserve provider, press gestures, local media, blocked posts and disabled pointer behavior', () => {
	const body = e('Post', { blocked: true, messageContent: null, media: null })
	const card = e(
		'Card',
		{
			variant: 'surface-high',
			accessibilityRole: 'button',
			onPress: press,
			onLongPress: press,
			onPressIn: press,
			style: { minHeight: 110, padding: 12 },
		},
		body,
	)
	const original = e(
		'Provider',
		{ value: { pressed: false } },
		e('View', { style: { marginBottom: 12 } }, card),
	)
	const next = style('forum', original, { threadId: 'thread' })
	assert.equal(next.props.value, original.props.value)
	const styled = next.props.children.props.children
	assert.equal(styled.props.children, body)
	assert.equal(styled.props.onPress, press)
	assert.equal(styled.props.onLongPress, press)
	assert.equal(styled.props.style[0], card.props.style)
	assert.equal(flatten(styled.props.style).minHeight, 110)
	const disabled = e(
		'View',
		{ pointerEvents: 'none', style: { marginBottom: 12 } },
		body,
	)
	assert.equal(style('forum-disabled', disabled).props.pointerEvents, 'none')
	assert.equal(style('forum-disabled', disabled).props.children, body)
})

test('media frame keeps spoiler and age-gate props, image source, dimensions, callbacks and refs', () => {
	const media = e('ForumPostMedia', {
		source: { uri: 'native://secret.gif' },
		shouldSpoiler: true,
		obscureReason: 'age-restricted',
		blurTheme: 'dark',
		isMediaPost: true,
		onPress: press,
		ref: React.createRef(),
		androidStyle: { width: 80, height: 80 },
		iosStyle: { width: 80, height: 80 },
		containerStyle: { marginLeft: 8 },
	})
	const next = style('forum-media', media)
	for (const key of [
		'source',
		'shouldSpoiler',
		'obscureReason',
		'blurTheme',
		'onPress',
		'ref',
		'isMediaPost',
	])
		assert.equal(next.props[key], media.props[key])
	assert.equal(flatten(next.props.androidStyle).width, 80)
	assert.equal(flatten(next.props.androidStyle).height, 80)
	assert.equal(flatten(next.props.androidStyle).borderWidth, 1)
	assert.equal(flatten(next.props.containerStyle).borderWidth, undefined)
	assert.equal(
		style(
			'forum-media',
			media,
			{},
			normalize({ enabled: true, studio: { mediaFrames: false } }),
		),
		media,
	)
})

test('jump capsule is confined to JumpToPresent and retains positioning, animation and return-target action', () => {
	const button = e('FloatingButton', {
		onPress: press,
		accessibilityLabel: 'Return to message',
		icon: 42,
	})
	const original = e('View', { style: { bottom: 88, right: 16 } }, button)
	const marked = style('jump-root', original)
	assert.equal(marked.props.style, original.props.style)
	const animated = { nativeAnimation: true }
	const image = e('Image', { source: 42, style: { width: 24, height: 24 } })
	const native = e(
		'Pressable',
		{
			accessibilityRole: 'button',
			accessibilityLabel: 'Return to message',
			onPress: press,
			onPressIn: press,
			onPressOut: press,
		},
		e(
			'AnimatedView',
			{ style: [{ backgroundColor: '#161922' }, animated] },
			image,
		),
	)
	const result = style('jump-button', native, marked.props.children.props)
	assert.equal(result.props.onPress, press)
	assert.equal(result.props.onPressIn, press)
	assert.equal(result.props.accessibilityLabel, native.props.accessibilityLabel)
	assert.equal(
		result.props.children.props.style[0],
		native.props.children.props.style,
	)
	assert.equal(result.props.children.props.children.props.source, 42)
	assert.equal(flatten(result.props.children.props.style).width, 56)
	assert.equal(style('jump-button', native, button.props), native)
	assert.equal(
		style(
			'jump-button',
			native,
			marked.props.children.props,
			normalize({ enabled: true, controls: false }),
		),
		native,
	)
	const dismiss = e('View', original.props, e('VoicePanelDismissButton'))
	assert.equal(style('jump-root', dismiss), dismiss)
})

test('voice recorder styling retains warning, animated style, waveform and all five controls', () => {
	const children = [
		e('Loading'),
		e('Cancel', { onPress: press }),
		e('Duration', { warning: true }),
		e('Waveform', { values: [2, 1] }),
		e('Send', { onPress: press }),
	]
	const original = e(
		'AnimatedView',
		{ style: [{ height: '100%' }, { opacity: 0.8 }], ref: React.createRef() },
		children,
	)
	const next = style('voice-recording', original, { isRecording: true })
	assert.equal(next.props.children, children)
	assert.equal(next.props.ref, original.props.ref)
	assert.equal(next.props.style[0], original.props.style)
	assert.equal(flatten(next.props.style).opacity, 0.8)
	assert.equal(flatten(next.props.style).backgroundColor, undefined)
})

test('native invite colors preserve splash, membership, disabled/expired button colors and acceptance state', () => {
	const original = {
		type: 0,
		backgroundColor: 1,
		borderColor: 2,
		thumbnailCornerRadius: 15,
		titleColor: 3,
		acceptLabelColor: 4,
		acceptLabelBackgroundColor: 5,
		acceptLabelBorderColor: 6,
		canBeAccepted: false,
		inviteSplash: 'native://banner',
		memberText: '902 Members',
		onlineText: '12 Online',
		error: { code: 'disabled' },
	}
	const next = styleGuildInvite(settings, original, processColor) as any
	for (const key of Object.keys(original).filter(
		k =>
			!['backgroundColor', 'borderColor', 'thumbnailCornerRadius'].includes(k),
	))
		assert.equal(next[key], (original as any)[key])
	assert.notEqual(next.backgroundColor, original.backgroundColor)
	assert.equal(next.thumbnailCornerRadius, 18)
	assert.equal(original.thumbnailCornerRadius, 15)
	for (const bad of [
		() => null,
		() => NaN,
		() => {
			throw Error('unsupported')
		},
	])
		assert.equal(styleGuildInvite(settings, original, bad), original)
})

test('voice playback color preserves audio URLs, waveforms, durations, playback flags, accessibility and other messages', () => {
	const original = {
		id: 'voice',
		flags: 8192,
		audioAttachmentBackgroundColor: 1,
		attachments: [
			{ url: 'native://voice', waveform: 'abcd', durationSecs: 20 },
		],
		accessibilityActions: [{ id: 'play' }],
		state: 'sent',
		content: [],
	}
	const next = styleNativeMessage(settings, original, processColor) as any
	assert.notEqual(next.audioAttachmentBackgroundColor, 1)
	for (const key of Object.keys(original).filter(
		k => k !== 'audioAttachmentBackgroundColor',
	))
		assert.equal(next[key], (original as any)[key])
	const ordinary = { ...original, flags: 0 }
	assert.equal(styleNativeMessage(settings, ordinary, processColor), ordinary)
	assert.equal(
		styleNativeMessage(
			normalize({ enabled: true, studio: { voiceMessages: false } }),
			original,
			processColor,
		),
		original,
	)
})

test('system accents preserve rich content and actions and never restyle moderation or safety notices', () => {
	const original = {
		type: 7,
		timestampColor: 1,
		highlightColor: 2,
		content: [{ onClick: press }],
		mentioned: false,
		accessibilityActions: [{ id: 'reply' }],
		sticker: { uri: 'native://sticker' },
		timestamp: 'Today',
		dark: true,
	}
	const next = styleSystemNotice(settings, original, processColor) as any
	assert.notEqual(next.timestampColor, 1)
	for (const key of Object.keys(original).filter(
		k => !['timestampColor', 'highlightColor'].includes(k),
	))
		assert.equal(next[key], (original as any)[key])
	for (const type of [0, 14, 16, 24, 36, 37, 38, 39, 58, 61, 999]) {
		const other = { ...original, type }
		assert.equal(styleSystemNotice(settings, other, processColor), other)
	}
})

test('native image/video backgrounds keep redaction, GIF/playback/upload flags and every non-media entry', () => {
	const original = [
		{
			attachmentType: 'image',
			backgroundColor: 1,
			url: 'native://gif',
			isAnimated: true,
			shouldObscure: true,
			obscureReason: 'spoiler',
			width: 640,
			height: 480,
			uploaderId: 'upload',
		},
		{
			attachmentType: 'video',
			backgroundColor: 1,
			videoUrl: 'native://video',
			inlinePlaybackDisabled: true,
		},
		{ attachmentType: 'audio', backgroundColor: 1 },
		{ attachmentType: 'other', backgroundColor: 1 },
		null,
	]
	const next = styleAttachments(settings, original, processColor) as any[]
	for (const i of [0, 1])
		for (const key of Object.keys(original[i]!).filter(
			k => k !== 'backgroundColor',
		))
			assert.equal(next[i][key], (original[i] as any)[key])
	for (const i of [2, 3, 4]) assert.equal(next[i], original[i])
	assert.equal(original[0]!.backgroundColor, 1)
	assert.equal(
		styleAttachments(settings, original, () => null),
		original,
	)
})

test('paused, chat area off and each native toggle restore unmodified row data', () => {
	const original = {
		backgroundColor: 1,
		borderColor: 2,
		thumbnailCornerRadius: 15,
		flags: 8192,
		audioAttachmentBackgroundColor: 1,
		type: 7,
		timestampColor: 1,
		highlightColor: 2,
	}
	for (const value of [
		normalize({ enabled: false }),
		normalize({ enabled: true, chats: false }),
		normalize({
			enabled: true,
			studio: {
				inviteCards: false,
				voiceMessages: false,
				systemNotices: false,
				mediaFrames: false,
			},
		}),
	]) {
		for (const fn of [styleGuildInvite, styleNativeMessage, styleSystemNotice])
			assert.equal(fn(value, original, processColor), original)
		const attachments = [{ attachmentType: 'image', backgroundColor: 1 }]
		assert.equal(
			styleAttachments(value, attachments, processColor),
			attachments,
		)
	}
})

test('unknown trees and null outputs remain native and disposal restores retained wrappers', () => {
	const original = e('Unexpected', { style: { flex: 1 } })
	const state = createState(settings)
	const hooks = {
		...React,
		useContext: () => false,
		useSyncExternalStore: (_: any, snapshot: () => string) => snapshot(),
	} as unknown as typeof React
	const ui = createDetailSurfaces(
		hooks,
		{ View: 'View' },
		{ ...state, isActive: () => true },
	)
	for (const [, , kind] of DETAIL_HOOKS) {
		assert.equal(ui.wrap(kind, null), null)
		assert.equal(style(kind, original), original)
	}
	const retained = ui.wrap('dm-row', dm()) as any
	const mounted = retained.props.children
	assert.notEqual(mounted.type(mounted.props), mounted.props.original)
	ui.dispose()
	assert.equal(mounted.type(mounted.props), mounted.props.original)
	assert.equal(ui.wrap('dm-row', original), original)
})

test('signature motifs are silent, static decoration and obey None, pause and main-screen scope', () => {
	const globals = globalThis as any
	const before = globals.revenge
	globals.revenge = {
		react: {
			React,
			ReactJSXRuntime: { jsx: e, jsxs: e, Fragment: React.Fragment },
			ReactNative: { View: 'View', Text: 'Text' },
		},
	}
	try {
		for (const signatureMotif of ['butterfly', 'star'] as const) {
			const node = SignatureMotif({
				settings: normalize({ enabled: true, studio: { signatureMotif } }),
			}) as any
			assert.equal(node.props.pointerEvents, 'none')
			assert.equal(node.props.importantForAccessibility, 'no-hide-descendants')
			assert.equal(node.props.accessibilityElementsHidden, true)
			assert.equal(node.props.onPress, undefined)
		}
		for (const value of [
			normalize({ enabled: false }),
			normalize({ enabled: true, mainScreens: false }),
			normalize({ enabled: true, studio: { signatureMotif: 'none' } }),
		])
			assert.equal(SignatureMotif({ settings: value }), null)
	} finally {
		globals.revenge = before
	}
})
