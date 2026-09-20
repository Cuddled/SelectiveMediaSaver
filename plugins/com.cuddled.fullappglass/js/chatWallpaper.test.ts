import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { createChatWallpaper } from './chatWallpaper'
import { createState } from './core'

test('custom chat wallpapers isolate late loads by URI and channel and preserve native viewport identity', () => {
	const slots: any[] = []
	const cleanups: Array<() => void> = []
	let cursor = 0
	const state = createState({ enabled: true })
	let uri = 'https://example.com/first.jpg'
	const hooks = {
		...React,
		useSyncExternalStore: (_subscribe: any, snapshot: () => string) =>
			snapshot(),
		useMemo(factory: () => any, deps: any[]) {
			const i = cursor++
			if (!slots[i] || deps.some((value, j) => value !== slots[i].deps[j]))
				slots[i] = { value: factory(), deps }
			return slots[i].value
		},
		useRef(value: any) {
			return (slots[cursor++] ??= { current: value })
		},
		useState(value: any) {
			const i = cursor++
			if (!(i in slots)) slots[i] = value
			return [
				slots[i],
				(next: any) => {
					slots[i] = next
				},
			]
		},
		useEffect(effect: () => () => void) {
			const i = cursor++
			if (!slots[i]) {
				slots[i] = true
				cleanups.push(effect())
			}
		},
	} as typeof React
	const ui = createChatWallpaper(
		hooks,
		{ Image: 'Image', View: 'View' },
		{ ...state, isActive: () => true, getWallpaper: () => uri },
	)
	const original = React.createElement(
		'DCDChat',
		{
			channelId: '123456789012345678',
			inverted: true,
			style: { flex: 1 },
			ref: React.createRef(),
			onScroll: () => {},
		},
		React.createElement('Messages'),
	)
	const guard = ui.wrapChat(original, 'DCDChat') as any
	const wrapper = guard.props.children
	const render = (node: any = original) => {
		cursor = 0
		const root = wrapper.type({ original: node })
		return {
			root,
			image: root.props.children[0]?.props.children[0],
			chat: root.props.children[1].props.children,
			visible: root.props.children[1].props.value,
		}
	}
	const first = render()
	assert.equal(first.visible, false)
	assert.equal(first.chat, original)
	first.image.props.onLoad()
	const loaded = render()
	assert.equal(loaded.visible, true)
	for (const key of ['ref', 'onScroll', 'children', 'channelId'])
		assert.equal(
			loaded.chat.props[key],
			original.props[key as keyof typeof original.props],
		)
	uri = 'https://example.com/second.jpg'
	const second = render()
	assert.equal(second.visible, false)
	first.image.props.onLoad()
	assert.equal(render().visible, false)
	second.image.props.onLoad()
	assert.equal(render().visible, true)
	const other = React.cloneElement(original, {
		channelId: '223456789012345678',
	})
	assert.equal(render(other).visible, false)
	second.image.props.onLoad()
	assert.equal(render(other).visible, false)
	state.update({ ...state.getSettings(), enabled: false })
	assert.equal(render(other).image, undefined)
	state.update({ ...state.getSettings(), enabled: true })
	const resumed = render(other)
	resumed.image.props.onLoad()
	assert.equal(render(other).visible, true)
	resumed.image.props.onError()
	assert.equal(render(other).visible, false)
	for (const cleanup of cleanups) cleanup()
	resumed.image.props.onLoad()
	assert.equal(render(other).visible, false)
	ui.dispose()
	assert.equal(ui.wrapChat(original, 'DCDChat'), original)
	assert.equal(ui.wrapChat(original, 'WrongType'), original)
})
