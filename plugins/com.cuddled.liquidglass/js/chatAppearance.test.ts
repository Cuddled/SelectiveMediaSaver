import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import {
	applyChatGapStyle,
	applyNativeChatColors,
	chatAppearanceColors,
	chatAppearanceEnabled,
	createChatAppearanceRuntime,
	recolorChatHeader,
	recolorChatScrim,
} from './chatAppearance'
import { applyPreset, DEFAULT_SETTINGS, normalizeSettings } from './core'
import { BUILT_IN_PRESET_IDS } from './types'

const settings = normalizeSettings({
	...DEFAULT_SETTINGS,
	chatWallpaperEnabled: true,
})
const disabled = { ...settings, enabled: false }

function headerResult(): React.ReactElement<any> {
	return React.createElement(React.Fragment, {}, [
		React.createElement(
			'NavTTIView',
			{
				key: 'bar',
				ref: React.createRef(),
				onLayout: () => {},
				spanComponent: 'channel_header',
				style: [
					{ flexDirection: 'row', paddingTop: 28 },
					{ backgroundColor: '#B0B0B0' },
				],
			},
			React.createElement('HeaderButtons', { onPress: () => {} }),
		),
		React.createElement('Frame', { key: 'frame' }),
	])
}

function scrimResult(): React.ReactElement<any> {
	return React.createElement(
		'View',
		{
			pointerEvents: 'none',
			style: { position: 'absolute', top: -20, bottom: 0 },
		},
		[
			React.createElement('LinearGradient', {
				key: 'gradient',
				colors: ['#B0B0B000', '#B0B0B0FF'],
				style: { height: 40 },
				start: { x: 0, y: 0 },
				end: { x: 0, y: 1 },
				locations: [0, 1],
			}),
			React.createElement('View', {
				key: 'fill',
				style: { flex: 1, backgroundColor: '#B0B0B0' },
			}),
		],
	)
}

test('chat chrome stays dark even for pale presets and preserves stored preferences', () => {
	for (const preset of BUILT_IN_PRESET_IDS) {
		const value = applyPreset(settings, preset)
		const before = structuredClone(value)
		const colors = chatAppearanceColors(value)
		for (const channel of colors.panel.slice(1).match(/../g)!)
			assert.ok(Number.parseInt(channel, 16) <= 48)
		assert.match(colors.surface, /^#[0-9A-F]{8}$/)
		const alpha = Number.parseInt(colors.surface.slice(7), 16) / 255
		assert.ok(alpha >= 0.71 && alpha <= 0.93)
		assert.deepEqual(value, before)
	}
	assert.equal(
		chatAppearanceColors({ ...settings, textColor: '#010203' }).foreground,
		'#F7F8FF',
	)
	assert.equal(
		chatAppearanceColors({ ...settings, textColor: '#FFF0FF' }).foreground,
		'#FFF0FF',
	)
})

test('chat appearance honors wallpaper, semantic, and master switches independently of app background', () => {
	assert.equal(
		chatAppearanceEnabled({ ...settings, backgroundEnabled: false }),
		true,
	)
	for (const value of [
		disabled,
		{ ...settings, chatWallpaperEnabled: false },
		{ ...settings, semanticEnabled: false },
	]) {
		assert.equal(chatAppearanceEnabled(value), false)
		const header = headerResult()
		const scrim = scrimResult()
		const gap = { backgroundColor: '#AAAAAA' }
		assert.equal(recolorChatHeader(React, header, value), header)
		assert.equal(recolorChatScrim(React, scrim, value), scrim)
		assert.equal(applyChatGapStyle(value, gap), gap)
	}
})

test('header override only changes its backdrop; navigation, frame, refs and layout survive', () => {
	const original = headerResult()
	const [bar, frame] = original.props.children
	const updated = recolorChatHeader(React, original, settings) as any
	assert.notEqual(updated, original)
	assert.equal(updated.type, original.type)
	const nextBar = updated.props.children[0]
	assert.equal(nextBar.type, bar.type)
	assert.equal(nextBar.key, bar.key)
	assert.equal(nextBar.props.ref, bar.props.ref)
	assert.equal(nextBar.props.onLayout, bar.props.onLayout)
	assert.equal(nextBar.props.children, bar.props.children)
	assert.equal(nextBar.props.style[0], bar.props.style)
	assert.equal(
		nextBar.props.style[1].backgroundColor,
		chatAppearanceColors(settings).surface,
	)
	assert.equal(updated.props.children[1], frame)
	assert.equal(bar.props.style[1].backgroundColor, '#B0B0B0')
})

test('scrim keeps its gradient height, stops, placement and non-interactive behavior', () => {
	const original = scrimResult()
	const [gradient, fill] = original.props.children
	const updated = recolorChatScrim(React, original, settings) as any
	const [nextGradient, nextFill] = updated.props.children
	const palette = chatAppearanceColors(settings)
	assert.equal(updated.props.style, original.props.style)
	assert.equal(updated.props.pointerEvents, 'none')
	assert.equal(nextGradient.type, gradient.type)
	assert.equal(nextGradient.key, gradient.key)
	assert.deepEqual(nextGradient.props.colors, [
		palette.transparent,
		palette.surface,
	])
	for (const key of ['style', 'start', 'end', 'locations'])
		assert.equal(nextGradient.props[key], gradient.props[key])
	assert.equal(nextFill.props.style[0], fill.props.style)
	assert.equal(nextFill.props.style[1].backgroundColor, palette.surface)
	assert.deepEqual(gradient.props.colors, ['#B0B0B000', '#B0B0B0FF'])
	assert.equal(fill.props.style.backgroundColor, '#B0B0B0')
})

test('unknown component shapes and empty keyboard gaps are left alone', () => {
	for (const unknown of [
		null,
		{},
		[],
		React.createElement('View', { key: 'unknown-view' }),
		React.createElement(React.Fragment, { key: 'unknown-fragment' }, 'content'),
	]) {
		assert.equal(recolorChatHeader(React, unknown, settings), unknown)
		assert.equal(recolorChatScrim(React, unknown, settings), unknown)
	}
	for (const unknown of [null, undefined, {}, [], 5])
		assert.equal(applyChatGapStyle(settings, unknown), unknown)
	const gap = { height: 28, backgroundColor: '#B0B0B0' }
	assert.deepEqual(applyChatGapStyle(settings, gap), {
		...gap,
		backgroundColor: chatAppearanceColors(settings).surface,
	})
	assert.equal(gap.backgroundColor, '#B0B0B0')
})

test('native message palette uses processed colors without changing links, roles or cached originals', () => {
	const original = Object.freeze({
		defaultUsernameColor: 11,
		textColor: 12,
		timestampColor: 13,
		editedColor: 14,
		unsupportedColor: 15,
		linkColor: 16,
		roleColor: 17,
		embedBackgroundColor: 18,
	})
	const palette = chatAppearanceColors(settings)
	const process = (color: string) => (color === palette.foreground ? -1 : -2)
	const next = applyNativeChatColors(settings, original, process) as any
	assert.deepEqual(next, {
		...original,
		defaultUsernameColor: -1,
		textColor: -1,
		timestampColor: -2,
		editedColor: -2,
		unsupportedColor: -2,
	})
	assert.equal(original.defaultUsernameColor, 11)
	assert.equal(applyNativeChatColors(disabled, original, process), original)
	assert.equal(
		applyNativeChatColors(settings, original, () => null),
		original,
	)
	assert.equal(
		applyNativeChatColors(settings, original, () => Number.NaN),
		original,
	)
	assert.equal(
		applyNativeChatColors(settings, original, () => {
			throw new Error('Unsupported native color')
		}),
		original,
	)
	for (const unknown of [null, {}, [], { textColor: 'not native' }])
		assert.equal(applyNativeChatColors(settings, unknown, process), unknown)
})

test('screen adapter keeps header identity stable while its reactive colors update and restore', () => {
	let current = settings
	let active = true
	const hooks = {
		...React,
		useSyncExternalStore: (_subscribe: any, getSnapshot: () => string) =>
			getSnapshot(),
	} as typeof React
	const runtime = createChatAppearanceRuntime(hooks, {
		subscribe: () => () => {},
		getSnapshot: () => JSON.stringify(current),
		getSettings: () => current,
		isActive: () => active,
	})
	const renderedHeader = headerResult()
	const Header = () => renderedHeader
	const header = React.createElement(Header, {
		key: 'header',
		channelId: '123456789012345678',
		isBackEnabled: true,
		measureNavigationTTI: true,
	} as any)
	const chat = React.createElement('NativeChat', { key: 'chat' })
	const screen = React.createElement(
		'NavigationSurface',
		{ onBack: () => {} },
		React.createElement(React.Fragment, {}, [header, chat]),
	)
	const wrapped = runtime.wrapScreen(screen) as any
	const newHeader = wrapped.props.children.props.children[0]
	const boundary = newHeader.type(newHeader.props)
	const render = () => boundary.type(boundary.props)
	assert.equal(wrapped.type, screen.type)
	assert.equal(wrapped.props.onBack, screen.props.onBack)
	assert.equal(wrapped.props.children.props.children[1], chat)
	assert.equal(newHeader.key, header.key)
	assert.equal(
		newHeader.type,
		(runtime.wrapScreen(screen) as any).props.children.props.children[0].type,
	)
	assert.notEqual(render(), renderedHeader)
	current = { ...settings, panelColor: '#123456' }
	assert.equal(
		render().props.children[0].props.style[1].backgroundColor,
		chatAppearanceColors(current).surface,
	)
	current = disabled
	assert.equal(render(), renderedHeader)
	current = settings
	active = false
	assert.equal(render(), renderedHeader)
	runtime.dispose()
	assert.equal(runtime.wrapScreen(screen), screen)
	assert.equal(runtime.wrapScrim(renderedHeader), renderedHeader)
})

test('screen adapter does not traverse arbitrary child trees or wrap unrelated headers', () => {
	const runtime = createChatAppearanceRuntime(React, {
		subscribe: () => () => {},
		getSnapshot: () => '',
		getSettings: () => settings,
		isActive: () => true,
	})
	for (const unknown of [
		null,
		React.createElement('View', {}, [
			React.createElement('Header', { key: 'x' }),
			null,
		]),
		React.createElement('View', {}, React.createElement('Header')),
	])
		assert.equal(runtime.wrapScreen(unknown), unknown)
})
