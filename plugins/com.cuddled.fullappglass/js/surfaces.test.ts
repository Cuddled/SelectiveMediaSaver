import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { createState, normalize, surfaceColor } from './core'
import { createSurfaces, recolorChrome } from './surfaces'

function harness() {
	const slots: any[] = []
	const cleanups: Array<() => void> = []
	let cursor = 0
	let alive = true
	const state = createState({ enabled: true })
	const hooks = {
		...React,
		useMemo(factory: () => any, deps: any[]) {
			const i = cursor++
			if (!slots[i] || deps.some((v, j) => slots[i].deps[j] !== v))
				slots[i] = { value: factory(), deps }
			return slots[i].value
		},
		useRef(value: any) {
			const i = cursor++
			return (slots[i] ??= { current: value })
		},
		useState(value: any) {
			const i = cursor++
			if (!(i in slots)) slots[i] = value
			return [
				slots[i],
				(next: any) => {
					slots[i] = typeof next === 'function' ? next(slots[i]) : next
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
		useSyncExternalStore: (_subscribe: any, snapshot: () => string) =>
			snapshot(),
	} as typeof React
	const runtime = createSurfaces(
		hooks,
		{ View: 'View', Image: 'Image' },
		{ ...state, isActive: () => alive },
	)
	const original: React.ReactElement<any> = React.createElement(
		'ThemeProvider',
		{
			theme: 'midnight',
			ref: React.createRef(),
			onEvent: () => {},
			key: 'root',
		},
		React.createElement('Navigation', { initialState: 'existing-navigation' }),
	)
	const wrapped = runtime.wrapRoot(original) as any
	const boundary = wrapped.props.children
	return {
		state,
		original,
		runtime,
		wrapped,
		render() {
			cursor = 0
			const root = boundary.type(boundary.props)
			const container = root.props.children
			const [layer, scope] = container.props.children
			return { root, container, layer, scope, image: layer?.props.children[0] }
		},
		unmount() {
			for (const stop of cleanups) stop()
		},
		stop() {
			alive = false
			runtime.dispose()
		},
	}
}

test('root wallpaper preserves the original provider, navigation, refs and handlers', () => {
	const h = harness()
	const view = h.render()
	assert.equal(view.root.type, h.original.type)
	assert.equal(view.root.key, h.original.key)
	assert.equal(view.root.props.ref, h.original.props.ref)
	assert.equal(view.root.props.onEvent, h.original.props.onEvent)
	assert.equal(view.scope.props.children, h.original.props.children)
	assert.equal(view.layer.props.pointerEvents, 'none')
	assert.equal(
		view.layer.props.importantForAccessibility,
		'no-hide-descendants',
	)
	assert.equal(view.container.props.style.backgroundColor, '#0B0D17')
	assert.equal(view.image.props.style[1].opacity, 0)
	assert.equal(h.original.props.theme, 'midnight')
})

test('root gradient suppression only becomes eligible after successful image load', () => {
	const h = harness()
	assert.equal(h.render().scope.props.value, false)
	h.render().image.props.onLoad()
	const loaded = h.render()
	assert.equal(loaded.scope.props.value, true)
	assert.equal(loaded.image.props.style[1].opacity, 1)
	loaded.image.props.onError()
	assert.equal(h.render().scope.props.value, false)
	assert.equal(h.render().container.props.style.backgroundColor, '#0B0D17')
})

test('pause and resume do not replace navigation and stale callbacks cannot revive the image', () => {
	const h = harness()
	const oldImage = h.render().image
	oldImage.props.onLoad()
	const loaded = h.render()
	h.state.update({ ...h.state.getSettings(), enabled: false })
	const off = h.render()
	assert.equal(off.root.props.theme, 'midnight')
	assert.equal(off.layer, null)
	assert.equal(off.scope.props.value, false)
	assert.equal(off.scope.type, loaded.scope.type)
	assert.equal(off.scope.key, loaded.scope.key)
	assert.equal(off.scope.props.children, loaded.scope.props.children)
	h.state.update({ ...h.state.getSettings(), enabled: true })
	h.render()
	oldImage.props.onLoad()
	assert.equal(h.render().scope.props.value, false)
	const image = h.render().image
	h.unmount()
	image.props.onLoad()
	assert.equal(h.render().scope.props.value, false)
	h.stop()
	assert.equal(h.runtime.wrapRoot(h.original), h.original)
})

test('wallpaper respects low-power mode and preserves its chosen blur value', () => {
	const h = harness()
	h.state.update({ ...h.state.getSettings(), blur: 8 })
	assert.equal(h.render().image.props.blurRadius, 0)
	h.state.update({ ...h.state.getSettings(), lowPower: false })
	assert.equal(h.render().image.props.blurRadius, 8)
	assert.equal(h.state.getSettings().blur, 8)
})

test('unknown root structures are not changed and the render guard falls back', () => {
	const h = harness()
	for (const value of [
		null,
		{},
		React.createElement('View', { key: 'unknown' }),
	])
		assert.equal(h.runtime.wrapRoot(value), value)
	const Guard = h.wrapped.type
	const guard = new Guard(h.wrapped.props)
	guard.state = Guard.getDerivedStateFromError(new Error('render failed'))
	assert.equal(guard.render(), h.original)
})

test('chat chrome uses master transparency, preserves button properties and restores when off', () => {
	const settings = normalize({ enabled: true, transparency: 0.9 })
	const bar = React.createElement('HeaderBar', {
		key: 'bar',
		ref: React.createRef(),
		onPress: () => {},
		style: { padding: 8 },
	})
	const frame = React.createElement('Frame', { key: 'frame' })
	const header = React.createElement(React.Fragment, {}, [bar, frame])
	const result = recolorChrome(React, header, 'header', settings) as any
	assert.equal(result.props.children[0].props.onPress, bar.props.onPress)
	assert.equal(result.props.children[0].props.ref, bar.props.ref)
	assert.equal(result.props.children[0].props.style[0], bar.props.style)
	assert.equal(
		result.props.children[0].props.style[1].backgroundColor,
		surfaceColor(settings),
	)
	assert.equal(result.props.children[1], frame)
	assert.equal(
		recolorChrome(React, header, 'header', { ...settings, chats: false }),
		header,
	)
	assert.equal(
		recolorChrome(React, header, 'header', { ...settings, enabled: false }),
		header,
	)
	const gradient = React.createElement('Gradient', {
		key: 'gradient',
		colors: ['#00000000', '#000000FF'],
		locations: [0, 1],
	})
	const fill = React.createElement('View', { key: 'fill', style: { flex: 1 } })
	const scrim = React.createElement('View', { pointerEvents: 'none' }, [
		gradient,
		fill,
	])
	const next = recolorChrome(React, scrim, 'scrim', settings) as any
	assert.equal(next.props.children[0].props.colors[1], surfaceColor(settings))
	assert.equal(next.props.children[0].props.locations, gradient.props.locations)
	assert.deepEqual(gradient.props.colors, ['#00000000', '#000000FF'])
})
