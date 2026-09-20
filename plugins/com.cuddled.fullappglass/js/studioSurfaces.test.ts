import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { createState, normalize } from './core'
import {
	atPath,
	createStudioSurfaces,
	LINE_ICONS,
	mediaTheme,
	styleNotification,
	styleRail,
} from './studioSurfaces'

const e = (
	type: any,
	props: any = {},
	children?: any,
): React.ReactElement<Record<string, any>> =>
	React.createElement(type, props, children) as React.ReactElement<
		Record<string, any>
	>
const settings = normalize({ enabled: true })
function harness() {
	const state = createState(settings)
	const hooks = {
		...React,
		useSyncExternalStore: (_subscribe: any, snapshot: () => string) =>
			snapshot(),
		useState: (initial: any) => [initial, () => {}],
	} as unknown as typeof React
	const ui = createStudioSurfaces(
		hooks,
		{ View: 'View', Image: 'Image' },
		{ ...state, isActive: () => true },
		() => null,
	)
	const render = (
		kind: Parameters<typeof ui.wrap>[0],
		original: any,
		props?: any,
	) => {
		const guard = ui.wrap(kind, original, props) as any
		const wrapper = guard.props.children
		return wrapper.type(wrapper.props)
	}
	return { state, ui, render }
}
test('banner styling retains sender content, dismiss gestures, tap actions and native animation', () => {
	const onPress = () => {}
	const onDismiss = () => {}
	const onLongPress = () => {}
	const content = [
		e('NotificationContent', {
			sender: 'sender',
			icon: 'avatar',
			key: 'content',
		}),
		e('Progress', { key: 'progress' }),
	]
	const pressable = e(
		'Pressable',
		{
			accessibilityRole: 'button',
			onPress,
			onAccessibilityEscape: onDismiss,
			onLongPress,
			style: { overflow: 'hidden' },
		},
		content,
	)
	const original = e(
		'AnimatedView',
		{ style: [{ transform: [{ scale: 0.95 }] }] },
		pressable,
	)
	const next = styleNotification(React, original, settings) as any
	assert.equal(next.props.style[0], original.props.style)
	for (const key of [
		'onPress',
		'onAccessibilityEscape',
		'onLongPress',
		'children',
	])
		assert.equal(next.props.children.props[key], pressable.props[key])
	assert.equal(
		styleNotification(
			React,
			original,
			normalize({ enabled: true, menus: false }),
		),
		original,
	)
	assert.equal(
		(styleNotification(React, e('Unknown'), settings) as any).type,
		'Unknown',
	)
})
test('server rail adds only a noninteractive backdrop and keeps the list, drag preview and dimensions stable', () => {
	const list = e('FastList', {
		nativeID: 'guilds-bar-fast-list',
		ref: React.createRef(),
		onScroll: () => {},
		insetStart: 10,
	})
	const children = [list, e('DragPreview'), e('Popover')]
	const rail = e(
		'NativeView',
		{ nativeID: 'guilds-bar-view', collapsable: false, style: { width: 80 } },
		children,
	)
	const original = e(
		'Profiler',
		{},
		e('GestureDetector', { gesture: {} }, rail),
	)
	const next = styleRail(React, 'View', original, settings) as any
	const decorated = next.props.children.props.children
	assert.equal(decorated.props.style, rail.props.style)
	assert.equal(decorated.props.children[0].props.pointerEvents, 'none')
	assert.equal(decorated.props.children[1].props.children, children)
	const off = styleRail(
		React,
		'View',
		original,
		normalize({ enabled: false }),
	) as any
	const offRail = off.props.children.props.children
	assert.equal(offRail.props.children[0], null)
	assert.equal(offRail.props.children[1].key, decorated.props.children[1].key)
	assert.equal(offRail.props.children[1].props.children, children)
	assert.equal(styleRail(React, 'View', list, settings), list)
})
test('empty art replaces only audited decorative images; labels and buttons survive', () => {
	const h = harness()
	const image = e('Image', {
		source: 42,
		resizeMode: 'contain',
		style: { width: 170, height: 130 },
	})
	const label = e('Text', {}, 'No messages')
	const action = e('Button', { onPress: () => {} })
	const original = e('View', {}, e('View', {}, [image, label, action]))
	const next = h.render('empty-common', original)
	const children = next.props.children.props.children
	assert.equal(children[1], label)
	assert.equal(children[2], action)
	const artwork = children[0].type(children[0].props)
	assert.equal(artwork.props.pointerEvents, 'none')
	h.state.update({ ...settings, enabled: false })
	assert.equal(children[0].type(children[0].props), image)
	const unknown = e('View', {}, e('CustomIllustration', { source: 'image' }))
	assert.equal(h.render('empty-modern', unknown), unknown)
})
test('icon replacement keeps semantic tint, sizing, accessibility and native component type', () => {
	const h = harness()
	for (const name of LINE_ICONS) {
		const original = e('BaseIconImage', {
			source: 12,
			color: 'interactive-muted',
			size: 'sm',
			style: { opacity: 0.5 },
			accessibilityLabel: 'Original icon',
		})
		const next = h.render(name, original)
		assert.equal(next.type, original.type)
		for (const key of ['color', 'size', 'style', 'accessibilityLabel'])
			assert.equal(next.props[key], original.props[key])
		assert.match(next.props.source.uri, /^data:image\/png;base64,iVBOR/)
		h.state.update({ ...settings, controls: false })
		assert.equal(h.render(name, original), original)
		h.state.update(settings)
	}
})
test('typography keeps code, line heights, font scaling, refs and styles; PlainText receives matching font props', () => {
	const h = harness()
	h.state.update({
		...settings,
		studio: { ...settings.studio, font: 'serif', letterSpacing: 0.3 },
	})
	const original = e(
		'NativeText',
		{
			ref: React.createRef(),
			style: { lineHeight: 20, fontSize: 16 },
			allowFontScaling: true,
		},
		'Label',
	)
	const next = h.render('text', original, { variant: 'text-md/normal' })
	assert.equal(next.props.ref, original.props.ref)
	assert.equal(next.props.allowFontScaling, true)
	assert.equal(next.props.style[0], original.props.style)
	assert.equal(next.props.style[1].fontFamily, 'serif')
	assert.equal(h.render('text', original, { variant: 'code' }), original)
	const plain = e('PlainText', {
		text: 'Label',
		fontSize: 14,
		fontFamily: 'ggsans',
		lineHeight: 20,
		letterSpacing: 0,
		hasLetterSpacing: false,
	})
	const result = h.render('text', plain)
	assert.equal(result.props.fontFamily, 'serif')
	assert.equal(result.props.fontSize, 14)
	assert.equal(result.props.lineHeight, 20)
	assert.equal(result.props.hasLetterSpacing, true)
	h.ui.dispose()
	assert.equal(h.ui.wrap('text', original), original)
})
test('minimal composer leaves active app controls accessible and restores hidden shortcuts live', () => {
	const h = harness()
	const original = e('Button', {
		onPress: () => {},
		accessibilityLabel: 'Apps',
	})
	assert.equal(h.render('gift', original), null)
	assert.equal(h.render('apps', original, { active: true }), original)
	assert.equal(h.render('apps', original, { active: false }), null)
	h.state.update({ ...settings, chats: false })
	assert.equal(h.render('gift', original), original)
	assert.equal(h.render('apps', original), original)
})
test('gallery polish preserves media content, spoiler components, actions, refs and measured grid size', () => {
	const h = harness()
	const media = [
		e('SpoilerMedia', { shouldObscure: true }),
		null,
		null,
		null,
		e('Avatar'),
	]
	const pressable = e(
		'Pressable',
		{
			ref: React.createRef(),
			onPress: () => {},
			accessibilityRole: 'button',
			style: { width: 112, height: 112 },
		},
		media,
	)
	const original = e('AnimatedView', { style: { opacity: 1 } }, pressable)
	const result = h.render('media-gallery', original).props.children
	assert.equal(result.props.children, media)
	assert.equal(result.props.ref, pressable.props.ref)
	assert.equal(result.props.onPress, pressable.props.onPress)
	assert.equal(result.props.style[0], pressable.props.style)
	assert.equal(result.props.style.at(-1).borderWidth, 1)
	h.state.update({
		...settings,
		studio: { ...settings.studio, mediaCards: false, mediaFrames: true },
	})
	assert.equal(
		h.render('media-gallery', original).props.children.props.style.at(-1)
			.borderWidth,
		1,
	)
	h.state.update({
		...settings,
		studio: { ...settings.studio, mediaCards: false, mediaFrames: false },
	})
	assert.equal(h.render('media-gallery', original), original)
	h.state.update(settings)
	const post = e('AndroidThumbnail', {
		androidStyle: { width: 200 },
		shouldSpoiler: true,
		source: { uri: 'spoiled' },
		blurTheme: 'dark',
	})
	const updated = h.render('media-post', post)
	assert.equal(updated.props.shouldSpoiler, true)
	assert.equal(updated.props.source, post.props.source)
	assert.equal(updated.props.blurTheme, 'dark')
	const theme = {
		colors: { backgroundColor: 10, bodyTextColor: 20 },
		baseColors: { thumbnailCornerRadius: 15, headerColor: 30 },
		extra: true,
	}
	const styled = mediaTheme(settings, theme, () => -1) as any
	assert.equal(styled.colors.bodyTextColor, 20)
	assert.equal(styled.baseColors.headerColor, 30)
	assert.equal(theme.baseColors.thumbnailCornerRadius, 15)
	assert.equal(
		mediaTheme(settings, theme, () => null),
		theme,
	)
})
test('Home and Friends entries preserve header height and actions while allowing the title to shrink', () => {
	const h = harness()
	const heading = e(
		'View',
		{ style: { gap: 8 } },
		e('Text', { accessibilityRole: 'header' }, 'Messages'),
	)
	const actions = e('Buttons', { onPress: () => {} })
	const border = e('AnimatedBorder')
	const original = e('View', { style: { height: 96 } }, [
		heading,
		actions,
		border,
		null,
	])
	const next = h.render('home', original)
	assert.equal(next.props.style, original.props.style)
	assert.equal(next.props.children[1], actions)
	assert.equal(next.props.children[2], border)
	assert.equal(next.props.children[0].props.style, heading.props.style)
	const title = next.props.children[0].props.children[0]
	assert.equal(title.props.numberOfLines, 1)
	assert.equal(title.props.ellipsizeMode, 'tail')
	assert.deepEqual(title.props.style[1], { flexShrink: 1, minWidth: 0 })
	assert.equal(
		next.props.children[0].props.children[0].props.children,
		'Messages',
	)
	h.state.update({
		...settings,
		studio: { ...settings.studio, dashboard: false },
	})
	assert.equal(h.render('home', original), original)
	h.state.update({ ...settings, enabled: false })
	assert.equal(h.render('home', original), original)
	assert.equal(
		atPath(React, original, [9], () => null),
		original,
	)
})
