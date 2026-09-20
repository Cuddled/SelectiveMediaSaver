import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import {
	backAccountBar,
	backAccountShade,
	backFloatingInput,
} from './bottomBars'

const wallpaper = React.createElement('Wallpaper', { key: 'wallpaper' })

test('account shade covers the measured bar footprint without changing masks, hit area or gradients', () => {
	for (const height of [56, 80, 112]) {
		const position = { position: 'absolute', bottom: 0, left: 0, right: 0 }
		const blocker = React.createElement('View', {
			style: [position, { height, opacity: 0 }],
			pointerEvents: 'box-only',
			ref: React.createRef(),
			onLayout: () => {},
		})
		const gradient = React.createElement('LinearGradient', {
			style: [
				position,
				{ bottom: (height + 16) / 2, height: (height + 16) / 2, width: 360 },
			],
			pointerEvents: 'none',
			colors: ['#00000000', '#171B2B33'],
			locations: [0, 1],
		})
		const fill = React.createElement('View', {
			style: [position, { height: (height + 16) / 2 }],
		})
		const original = React.createElement(React.Fragment, {}, [
			blocker,
			gradient,
			fill,
		])
		const next = backAccountShade(React, original, true, wallpaper) as any
		const backing = next.props.children[0]
		assert.equal(backing.props.style[0], blocker.props.style)
		assert.deepEqual(backing.props.style[1], {
			opacity: 1,
			backgroundColor: '#0B0D17',
			overflow: 'hidden',
		})
		for (const key of ['pointerEvents', 'ref', 'onLayout'])
			assert.equal(backing.props[key], (blocker.props as any)[key])
		assert.equal(backing.props.children, wallpaper)
		assert.equal(next.props.children[1], gradient)
		assert.equal(next.props.children[2], fill)
		const off = backAccountShade(React, original, false, wallpaper) as any
		assert.equal(off.props.children[0].props.style, blocker.props.style)
		for (const props of [
			{ pointerEvents: 'auto' },
			{ children: React.createElement('Button') },
			{ style: [position, { height: NaN, opacity: 0 }] },
			{ style: [position, { height: 0, opacity: 0 }] },
			{ style: [position, { height, opacity: 1 }] },
		]) {
			const unknown = React.cloneElement(original, {}, [
				React.cloneElement(blocker, props as any),
				gradient,
				fill,
			])
			assert.equal(backAccountShade(React, unknown, true, wallpaper), unknown)
		}
	}
})

function input() {
	const content = [
		React.createElement('Reply', { key: 'reply' }),
		null,
		React.createElement('Input', {
			key: 'input',
			ref: React.createRef(),
			value: 'unsent draft',
			onChangeText: () => {},
		}),
	]
	const box = React.createElement(
		'View',
		{
			ref: React.createRef(),
			collapsable: false,
			style: [
				{ borderRadius: 24, overflow: 'hidden' },
				{ backgroundColor: '#12345644' },
			],
			onStartShouldSetResponder: () => true,
			onResponderRelease: () => {},
			onLayout: () => {},
			accessibilityElementsHidden: false,
			importantForAccessibility: 'auto',
		},
		content,
	)
	const children = [
		React.createElement('Accessory', { key: 'accessory' }),
		React.createElement('Nudge', { key: 'nudge' }),
		box,
		React.createElement('EmojiSuggestions', { key: 'emoji' }),
	]
	const original = React.createElement(
		'AnimatedView',
		{
			style: [{ paddingBottom: 18 }, { animatedPadding: true }],
			onLayout: () => {},
			ref: React.createRef(),
		},
		React.createElement(React.Fragment, {}, children),
	)
	return { original, box, content, children }
}

test('input backing changes only the pill and preserves draft, keyboard layout, sibling placement and responders', () => {
	const h = input()
	const next = backFloatingInput(React, h.original, true, wallpaper) as any
	assert.equal(next.type, h.original.type)
	assert.equal(next.props.ref, h.original.props.ref)
	assert.equal(next.props.style, h.original.props.style)
	assert.equal(next.props.onLayout, h.original.props.onLayout)
	const children = next.props.children.props.children
	for (const i of [0, 1]) assert.equal(children[i], h.children[i])
	assert.equal(children[2], null)
	assert.equal(children[4], h.children[3])
	const pill = children[3]
	for (const key of [
		'ref',
		'collapsable',
		'onLayout',
		'onStartShouldSetResponder',
		'onResponderRelease',
		'accessibilityElementsHidden',
		'importantForAccessibility',
	])
		assert.equal(pill.props[key], (h.box.props as any)[key])
	assert.equal(pill.props.style[0], h.box.props.style)
	assert.deepEqual(pill.props.style[1], {
		backgroundColor: '#0B0D17',
		overflow: 'hidden',
	})
	assert.equal(pill.props.children[0], wallpaper)
	assert.equal(pill.props.children[1].props.children, h.content)
	const off = backFloatingInput(React, h.original, false, wallpaper) as any
	const offPill = off.props.children.props.children[3]
	assert.equal(offPill.props.style, h.box.props.style)
	assert.equal(offPill.props.children[1].key, pill.props.children[1].key)
	assert.equal(offPill.props.children[1].props.children, h.content)
})

test('workspace toolbar occupies its own composer row without replacing native controls or changing their keys', () => {
	const h = input()
	const toolbar = React.createElement('WorkspaceToolbar', {
		key: 'workspace-toolbar',
	})
	const on = backFloatingInput(
		React,
		h.original,
		true,
		wallpaper,
		toolbar,
	) as any
	const off = backFloatingInput(React, h.original, true, wallpaper, null) as any
	assert.equal(on.props.onLayout, h.original.props.onLayout)
	assert.equal(on.props.style, h.original.props.style)
	const children = on.props.children.props.children
	assert.equal(children[2], toolbar)
	assert.equal(children[3].props.children[1].props.children, h.content)
	assert.equal(children[3].props.ref, h.box.props.ref)
	assert.equal(children[3].key, off.props.children.props.children[3].key)
	assert.equal(off.props.children.props.children[2], null)
	assert.equal(children[4], h.children[3])
})

test('account backings keep the large-avatar mask and small-avatar animated radii intact', () => {
	const animatedRadius = { radiusAnimation: true }
	const fill = React.createElement('AnimatedView', {
		key: 'fill',
		ref: React.createRef(),
		style: [{ height: 56, width: 350, borderRadius: 24 }, animatedRadius],
	})
	const mask = React.createElement('AvatarMask', { avatarSize: 60 })
	const masked = React.createElement(
		'MaskedView',
		{ style: { position: 'absolute' }, maskElement: mask },
		fill,
	)
	for (const original of [fill, masked]) {
		const next = backAccountBar(React, original, true, wallpaper) as any
		const isMasked = original === masked
		const result = isMasked ? next.props.children : next
		assert.equal(result.type, fill.type)
		assert.equal(result.key, fill.key)
		assert.equal(result.props.ref, fill.props.ref)
		assert.equal(result.props.style[0], fill.props.style)
		assert.equal(result.props.style[0][1], animatedRadius)
		assert.equal(result.props.children[0], wallpaper)
		if (isMasked) {
			assert.equal(next.type, masked.type)
			assert.equal(next.props.maskElement, mask)
			assert.equal(next.props.style, masked.props.style)
		}
		const off = backAccountBar(React, original, false, wallpaper) as any
		assert.equal(
			(isMasked ? off.props.children : off).props.style,
			fill.props.style,
		)
	}
})

test('bottom-bar shape guards refuse unrelated layouts, content-filled account views and malformed masks', () => {
	for (const original of [
		null,
		{},
		React.createElement('View', { key: 'unknown' }),
		React.createElement('View', { style: {}, onLayout: () => {} }, []),
		React.createElement(
			'View',
			{ style: {} },
			React.createElement('InteractiveContent'),
		),
		React.createElement(
			'MaskedView',
			{ style: {}, maskElement: null },
			React.createElement('View', { style: {} }),
		),
	]) {
		assert.equal(backFloatingInput(React, original, true, wallpaper), original)
		assert.equal(backAccountBar(React, original, true, wallpaper), original)
		assert.equal(backAccountShade(React, original, true, wallpaper), original)
	}
	const h = input()
	for (const props of [
		{ collapsable: true },
		{ onLayout: null },
		{ onResponderRelease: undefined },
		{ children: [] },
	]) {
		const children = [...h.children]
		children[2] = React.cloneElement(h.box, props as any)
		const unknown = React.cloneElement(
			h.original,
			{},
			React.createElement(React.Fragment, {}, children),
		)
		assert.equal(backFloatingInput(React, unknown, true, wallpaper), unknown)
	}
})
