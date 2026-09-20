import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { createState, normalize } from './core'
import {
	avatarRadius,
	createIdentitySurfaces,
	markAvatar,
	styleAvatarImage,
	styleProfileAvatar,
} from './identity'
import type { IdentityKind } from './identity'

const e = (
	type: any,
	props: any = {},
	children?: any,
): React.ReactElement<any> => React.createElement(type, props, children)
const flatten = (value: any): any =>
	Array.isArray(value) ? Object.assign({}, ...value.map(flatten)) : value
const settings = normalize({ enabled: true })
function harness() {
	const state = createState(settings)
	let context: any = null
	let fold = { key: '', closed: false }
	const hooks = {
		...React,
		useSyncExternalStore: (_: any, snapshot: () => string) => snapshot(),
		useContext: () => context,
		useState: () => [
			fold,
			(value: typeof fold) => {
				fold = value
			},
		],
	} as unknown as typeof React
	const ui = createIdentitySurfaces(
		hooks,
		{ View: 'View', Text: 'Text', Pressable: 'Pressable' },
		{ ...state, isActive: () => true },
	)
	const render = (kind: IdentityKind, original: any, props?: any): any => {
		const guarded = ui.wrap(kind, original, props) as any
		if (guarded === original) return original
		return guarded.props.children.type(guarded.props.children.props)
	}
	return {
		state,
		ui,
		render,
		context(value: any) {
			context = value
		},
	}
}

test('beta8 migration retains saved scenes and settings while validating identity controls', () => {
	const before = normalize({
		enabled: true,
		lowPower: false,
		studio: {
			mood: 'rose',
			favorites: ['123456789012345678'],
			wallpaper: 'https://example.com/photo.jpg',
		},
	})
	assert.equal(before.studio.avatarShape, 'rounded')
	assert.equal(before.studio.avatarBorder, 'accent')
	const after = normalize({
		...before,
		studio: {
			...before.studio,
			avatarShape: 'bad',
			avatarBorder: 5,
			profileLayout: false,
			avatarStyles: false,
		},
	})
	assert.equal(after.studio.avatarShape, 'rounded')
	assert.equal(after.studio.avatarBorder, 'accent')
	assert.equal(after.studio.profileLayout, false)
	assert.equal(after.studio.avatarStyles, false)
	assert.equal(after.studio.wallpaper, before.studio.wallpaper)
	assert.deepEqual(after.studio.favorites, before.studio.favorites)
	assert.equal(after.studio.mood, 'rose')
	assert.equal(after.lowPower, false)
	assert.equal(avatarRadius('circle', 80), 40)
	assert.equal(avatarRadius('rounded', 80), 19.2)
	assert.equal(avatarRadius('soft', 80), 28.799999999999997)
})

test('avatar image styling preserves native source, cutout, status, accessibility and decoration layers', () => {
	const callback = () => {}
	const image = e('CutoutableAvatarImage', {
		size: 'normal',
		cutout: undefined,
		source: { uri: 'native://avatar' },
		animate: true,
	})
	const status = e('Status', { status: 'dnd', typing: true, onPress: callback })
	const original = e(
		'View',
		{
			style: { width: 40, height: 40 },
			accessibilityLabel: 'Alex, Do Not Disturb',
		},
		[null, image, null, status, null],
	)
	const marked = markAvatar(
		React,
		original,
		{ user: { id: '123' } },
		settings,
	) as any
	assert.equal(marked.props.children[3], status)
	assert.equal(
		marked.props.accessibilityLabel,
		original.props.accessibilityLabel,
	)
	const props = marked.props.children[1].props
	const raster = e('FastImage', {
		source: image.props.source,
		usesSmallCache: true,
		style: { width: 40, height: 40, borderRadius: 20 },
		onError: callback,
	})
	const styled = styleAvatarImage(React, raster, props, settings, {
		normal: 40,
	}) as any
	assert.equal(flatten(styled.props.style).borderRadius, 9.6)
	assert.equal(styled.props.source, raster.props.source)
	assert.equal(styled.props.onError, callback)
	assert.equal(flatten(styled.props.style).width, 40)
	const cutout = { nativeCutouts: [{ shape: 0, x: 28, y: 28, size: 10 }] }
	const clipped = e('NativeCutoutAvatarImage', {
		source: raster.props.source,
		style: { width: 40, height: 40 },
		imageStyle: { borderRadius: 20 },
		cutout: cutout.nativeCutouts[0],
		animate: true,
	})
	const clippedResult = styleAvatarImage(
		React,
		clipped,
		{ ...props, cutout },
		settings,
		{ normal: 40 },
	) as any
	assert.equal(clippedResult.props.cutout, cutout.nativeCutouts[0])
	assert.equal(clippedResult.props.animate, true)
	assert.equal(flatten(clippedResult.props.imageStyle).borderRadius, 9.6)
	assert.equal(flatten(clippedResult.props.style).overflow, 'hidden')
	for (const sensitive of [
		{ avatarDecoration: { asset: 'decoration' } },
		{ speaking: true },
		{ channel: {} },
		{ mute: true },
		{ deaf: true },
		{ isStageCall: true },
	])
		assert.equal(markAvatar(React, original, sensitive, settings), original)
	assert.equal(
		styleAvatarImage(React, raster, image.props, settings, { normal: 40 }),
		raster,
	)
	assert.equal(
		styleAvatarImage(
			React,
			raster,
			{ ...props, cutout: { radius: 5 } },
			settings,
			{ normal: 40 },
		),
		raster,
	)
	assert.equal(styleAvatarImage(React, raster, props, settings, {}), raster)
	assert.equal(
		styleAvatarImage(
			React,
			raster,
			props,
			{ ...settings, enabled: false },
			{ normal: 40 },
		),
		raster,
	)
})

test('floating profile avatar preserves native geometry, press handlers and media-viewer ref', () => {
	const ref = React.createRef()
	const onPress = () => {}
	const avatar = e('HeaderAvatar', {
		ref,
		onPress,
		size: 'xxlarge',
		style: { top: -46, margin: 6 },
	})
	const backing = e('View', {
		style: { width: 92, height: 92, top: -46, left: 10, borderRadius: 92 },
	})
	const original = e(React.Fragment, {}, [backing, avatar])
	const styled = styleProfileAvatar(
		React,
		original,
		{},
		settings,
		flatten,
	) as any
	assert.equal(styled.props.children[1], avatar)
	assert.equal(flatten(styled.props.children[0].props.style).top, -46)
	assert.equal(flatten(styled.props.children[0].props.style).width, 92)
	assert.equal(flatten(styled.props.children[0].props.style).borderRadius, 25.2)
	assert.equal(styled.props.children[0].props.pointerEvents, 'none')
	assert.equal(
		styleProfileAvatar(
			React,
			original,
			{ pendingAvatarSrc: 'draft' },
			settings,
			flatten,
		),
		original,
	)
	assert.equal(
		styleProfileAvatar(
			React,
			original,
			{},
			{ ...settings, profiles: false },
			flatten,
		),
		original,
	)
})

test('banner fade retains the original pressable, GIF state, image and bounds; previews are unchanged', () => {
	const { render, state } = harness()
	const pressable = e(
		'PressableOpacity',
		{ onPress: () => {}, activeOpacity: 0.8 },
		e('Banner', { source: { uri: 'animated.gif' } }),
	)
	const original = e(
		'View',
		{ style: { position: 'relative', height: 180 } },
		pressable,
	)
	const result = render('banner', original, { displayProfile: {} })
	assert.equal(result.props.children[0], pressable)
	assert.equal(result.props.style, original.props.style)
	const fade = result.props.children[1].type(result.props.children[1].props)
	assert.equal(fade.props.pointerEvents, 'none')
	assert.equal(fade.props.importantForAccessibility, 'no-hide-descendants')
	assert.equal(fade.props.children.length, 32)
	assert.equal(
		render('banner', original, { displayProfile: {}, pendingBanner: 'draft' }),
		original,
	)
	state.update({
		...settings,
		studio: { ...settings.studio, profileBannerFade: false },
	})
	assert.equal(render('banner', original, { displayProfile: {} }), original)
})

test('connections collapse without unmounting links, retain trailing actions and reset for a different user', () => {
	const { render, context, state, ui } = harness()
	const link = e('Connection', {
		onPress: () => {},
		onLongPress: () => {},
		account: { verified: true },
	})
	const group = e('TableRowGroup', { hasIcons: true }, [link])
	const source = e('UserProfileCard', { title: 'Connections' }, group)
	const provider = render('connections', source, { userId: 'person-a' })
	assert.equal(provider.props.children, source)
	context(provider.props.value)
	const action = e('Button', { onPress: () => {} })
	const title = e(
		'View',
		{},
		e('Text', { accessibilityRole: 'header' }, 'Connections'),
	)
	const header = e('View', { style: { marginBottom: 12 } }, [title, action])
	const card = e('View', { style: { marginTop: 12 } }, [header, group])
	let result = render('card', card, { title: 'Connections' })
	const originalBody = result.props.children[1].props.children
	assert.equal(originalBody, group)
	assert.equal(result.props.children[0].props.children[1], action)
	assert.equal(
		result.props.children[0].props.children[0].props.accessibilityState
			.expanded,
		true,
	)
	result.props.children[0].props.children[0].props.onPress()
	result = render('card', card, { title: 'Connections' })
	assert.equal(result.props.children[1].props.children, originalBody)
	assert.equal(result.props.children[1].props.style.display, 'none')
	assert.equal(
		result.props.children[1].props.importantForAccessibility,
		'no-hide-descendants',
	)
	assert.equal(
		result.props.children[0].props.children[0].props.accessibilityState
			.expanded,
		false,
	)
	context({ key: 'person-b:Connections' })
	assert.equal(
		render('card', card, { title: 'Connections' }).props.children[1].props
			.style,
		undefined,
	)
	context(provider.props.value)
	state.update({
		...settings,
		studio: { ...settings.studio, profileCollapsible: false },
	})
	assert.equal(
		render('card', card, { title: 'Connections' }).props.children[1].props
			.style,
		undefined,
	)
	assert.equal(render('connections', null, { userId: 'hidden' }), null)
	state.update({ ...settings, profiles: false })
	assert.equal(render('card', card, { title: 'Connections' }), card)
	ui.dispose()
	assert.equal(render('card', card, { title: 'Connections' }), card)
})

test('compact rows are scoped to profile connections and leave text sizing, height overrides and callbacks intact', () => {
	const { render, context, state } = harness()
	const label = e('Text', {
		style: { fontSize: 30 },
		children: 'A long connected account name',
	})
	const row = e(
		'View',
		{
			style: { padding: 16, minHeight: 64, flexDirection: 'column' },
			onLayout: () => {},
		},
		[label],
	)
	assert.equal(render('connection-row', row, { label }), row)
	context({ key: 'person:Connections' })
	const styled = render('connection-row', row, { label })
	assert.equal(flatten(styled.props.style).minHeight, 48)
	assert.equal(flatten(styled.props.style).height, undefined)
	assert.equal(flatten(styled.props.style).flexDirection, 'column')
	assert.equal(styled.props.children, row.props.children)
	assert.equal(styled.props.onLayout, row.props.onLayout)
	assert.equal(render('connection-row', row, { label, height: 80 }), row)
	state.update({
		...settings,
		studio: { ...settings.studio, profileCompactConnections: false },
	})
	assert.equal(render('connection-row', row, { label }), row)
})
