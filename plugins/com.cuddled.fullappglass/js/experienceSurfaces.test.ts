import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { createState, normalize } from './core'
import {
	createExperienceSurfaces,
	searchSurface,
	voiceButtonStyles,
} from './experienceSurfaces'
import type { ExperienceKind } from './experienceSurfaces'

const e = (
	type: any,
	props: any = {},
	children?: any,
): React.ReactElement<any> => React.createElement(type, props, children)
const settings = normalize({ enabled: true })
const flatten = (style: any): any =>
	Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style
function harness() {
	const state = createState(settings)
	const hooks = {
		...React,
		useSyncExternalStore: (_: any, get: () => string) => get(),
	} as typeof React
	const ui = createExperienceSurfaces(
		hooks,
		{ View: 'View' },
		{ ...state, isActive: () => true },
	)
	const render = (kind: ExperienceKind, original: any, props?: any): any => {
		const guard = ui.wrap(kind, original, props) as any
		if (guard === original) return original
		return guard.props.children.type(guard.props.children.props)
	}
	const renderInner = (value: any): any => {
		const renderer =
			typeof value.type === 'function' ? value.type : value.type.type
		const surface = renderer(value.props)
		return surface.type(surface.props)
	}
	return { state, ui, render, renderInner }
}

test('search styling keeps query tags, input refs, history actions, result spoilers and list geometry', () => {
	const handlers = {
		onPress: () => {},
		onChangeText: () => {},
		onSubmitEditing: () => {},
		onRemove: () => {},
		onAccessibilityAction: () => {},
		ref: React.createRef(),
	}
	const tags = [{ type: 'from', userId: '123456789012345678' }]
	const bar = e('TokenInput', {
		...handlers,
		tags,
		defaultValue: 'query',
		autoFocus: true,
		style: { minHeight: 44 },
	})
	const styled = searchSurface(React, bar, 'search-bar', settings) as any
	assert.equal(styled.props.tags, tags)
	for (const key of Object.keys(handlers))
		assert.equal(styled.props[key], bar.props[key])
	assert.equal(styled.props.defaultValue, 'query')
	assert.equal(flatten(styled.props.style).minHeight, 44)
	const spoiler = e('Spoiler', { hidden: true })
	const row = e(
		'Pressable',
		{
			...handlers,
			accessibilityRole: 'button',
			accessibilityLabel: 'Recent search',
			style: { height: 64, paddingVertical: 10 },
		},
		[spoiler],
	)
	const result = searchSurface(React, row, 'search-row', settings) as any
	assert.equal(result.props.children, row.props.children)
	assert.equal(result.props.onPress, row.props.onPress)
	assert.equal(
		result.props.onAccessibilityAction,
		row.props.onAccessibilityAction,
	)
	assert.equal(flatten(result.props.style).height, 64)
	assert.equal(flatten(result.props.style).paddingVertical, 10)
	for (const disabled of [
		normalize({ enabled: false }),
		normalize({ enabled: true, mainScreens: false }),
		normalize({ enabled: true, studio: { search: false } }),
	])
		assert.equal(searchSurface(React, row, 'search-row', disabled), row)
	const unknown = e('Unknown')
	assert.equal(searchSurface(React, unknown, 'search-bar', settings), unknown)
})

test('search screen and recent headings preserve gesture objects, inset, navigation, lists and clear-history controls', () => {
	const gesture = {}
	const list = e('VirtualList', { data: [1, 2], ref: React.createRef() })
	const body = e('View', { style: [{ flex: 1 }, { paddingTop: 34 }] }, [
		e('SearchInput'),
		list,
	])
	const screen = e(React.Fragment, {}, [
		e('Gradient'),
		e('Gesture', { gesture }, body),
	])
	const result = searchSurface(React, screen, 'search-screen', settings) as any
	assert.equal(result.props.children[1].props.gesture, gesture)
	assert.equal(
		result.props.children[1].props.children.props.children,
		body.props.children,
	)
	assert.equal(
		flatten(result.props.children[1].props.children.props.style).paddingTop,
		34,
	)
	const clear = e('ClearHistory', { onPress: () => {} })
	const title = e(
		'Text',
		{ accessibilityRole: 'header', maxFontSizeMultiplier: 2 },
		'Recent searches',
	)
	const section = e('View', {}, [title, clear])
	const changed = searchSurface(
		React,
		section,
		'search-section',
		settings,
	) as any
	assert.equal(changed.props.children[1], clear)
	assert.equal(changed.props.children[0].props.children, 'Recent searches')
	assert.equal(changed.props.children[0].props.maxFontSizeMultiplier, 2)
})

test('call styling preserves native speaking animations, focus/PIP state, video content and gestures across live toggles', () => {
	const h = harness()
	const layout = () => {}
	const widthAnimation = { borderWidth: 'native-speaking-value' }
	const ring = e(
		'AnimatedView',
		{
			pointerEvents: 'none',
			style: { opacity: 'native-focused-value' },
			layout,
		},
		[
			e('AnimatedView', {
				style: [{ borderColor: 'black' }, widthAnimation],
				layout,
			}),
			e('AnimatedView', {
				style: [{ borderColor: 'green' }, widthAnimation],
				layout,
			}),
		],
	)
	const indicator = () => ring
	const lazyIndicator = React.memo((props: any) => e(indicator, props))
	const avatar = e('NativeAvatar', { source: 'photo', onPress: () => {} })
	const avatarView = e(
		'AnimatedView',
		{ style: { opacity: 'ringing-animation' }, layout },
		[null, avatar],
	)
	const Avatar = React.memo(() => avatarView)
	const video = e('NativeVideo', { streamId: 'stream', onTouch: () => {} })
	const content = [
		e(Avatar, { avatarURI: 'photo', layoutPhysics: {}, layout, key: 'avatar' }),
		video,
		e(lazyIndicator, {
			speaking: {},
			id: 'user',
			isSelf: false,
			layout,
			key: 'ring',
		}),
	]
	const card = e(
		'GestureWrapper',
		{ coords: {}, transitionState: {}, gesture: {}, ref: React.createRef() },
		content,
	)
	const styled = h.render('call-card', card)
	assert.equal(styled.type, card.type)
	assert.equal(styled.props.gesture, card.props.gesture)
	assert.equal(styled.props.ref, card.props.ref)
	assert.equal(styled.props.children[1], video)
	const paintedAvatar = h.renderInner(styled.props.children[0])
	assert.equal(paintedAvatar.props.children[1], avatar)
	assert.equal(paintedAvatar.props.children[0].props.pointerEvents, 'none')
	const lazy = h.renderInner(styled.props.children[2])
	const paintedRing = h.renderInner(lazy)
	assert.equal(paintedRing.props.style, ring.props.style)
	for (let i = 0; i < 2; i++) {
		assert.equal(paintedRing.props.children[i].props.layout, layout)
		assert.equal(
			flatten(paintedRing.props.children[i].props.style).borderWidth,
			'native-speaking-value',
		)
	}
	h.state.update({ enabled: false })
	const paused = h.render('call-card', card)
	assert.equal(paused.props.children[0].type, styled.props.children[0].type)
	assert.equal(paused.props.children[2].type, styled.props.children[2].type)
	assert.equal(h.renderInner(paused.props.children[0]), avatarView)
	assert.equal(h.renderInner(h.renderInner(paused.props.children[2])), ring)
	h.ui.dispose()
	assert.equal(h.render('call-card', card), card)
})

test('call buttons retain destructive, muted, selected and disabled semantics', () => {
	const original = {
		iconBg: { backgroundColor: 'clear' },
		iconBgSelected: { backgroundColor: 'white' },
		iconFillSelected: { color: 'black' },
		iconBgVoiceMuted: { backgroundColor: 'muted' },
		iconFillRed: { color: 'red' },
	}
	const result = voiceButtonStyles(settings, original)
	assert.equal(result.iconBgVoiceMuted, original.iconBgVoiceMuted)
	assert.equal(result.iconFillRed, original.iconFillRed)
	assert.equal(
		voiceButtonStyles(normalize({ enabled: false }), original),
		original,
	)
	const h = harness()
	const button = e('ActionButton', {
		backgroundColor: 'red',
		imageStyle: {},
		accessibilityState: { selected: false },
		onPress: () => {},
		disabled: true,
	})
	assert.equal(
		h.render('call-button', button, { backgroundColor: 'red' }),
		button,
	)
	assert.equal(h.render('call-button', button, { isActive: true }), button)
	const changed = h.render('call-button', button, {})
	assert.equal(changed.props.onPress, button.props.onPress)
	assert.equal(changed.props.disabled, true)
	assert.equal(
		changed.props.accessibilityState,
		button.props.accessibilityState,
	)
	assert.equal(h.render('call-card', e('Unknown')).type, 'Unknown')
})
