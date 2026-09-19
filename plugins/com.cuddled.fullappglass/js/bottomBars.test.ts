import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { backAccountBar, backFloatingInput } from './bottomBars'

const wallpaper = React.createElement('Wallpaper', { key: 'wallpaper' })

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
	for (const i of [0, 1, 3]) assert.equal(children[i], h.children[i])
	const pill = children[2]
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
	const offPill = off.props.children.props.children[2]
	assert.equal(offPill.props.style, h.box.props.style)
	assert.equal(offPill.props.children[1].key, pill.props.children[1].key)
	assert.equal(offPill.props.children[1].props.children, h.content)
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
