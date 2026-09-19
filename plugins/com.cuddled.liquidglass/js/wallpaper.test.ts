import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { DEFAULT_SETTINGS, normalizeSettings } from './core'
import {
	createMainTabsWallpaper,
	getMainTabsParts,
	WALLPAPER_SOURCE,
} from './wallpaper'

function mainTabs(): React.ReactElement<any> {
	return React.createElement(
		'View',
		{ style: { flex: 1 } },
		React.createElement(
			'ThemeContextProvider',
			{ gradient: { type: 'customBackgroundGradient' } },
			[
				React.createElement('ThemedGradient', {
					key: 'gradient',
					absolute: true,
					mix: true,
				}),
				React.createElement('MainTabsNavigatorPanel', { key: 'navigator' }),
			],
		),
	)
}

// Small hook driver for load-event/lifetime tests without a native renderer.
function runtimeHarness() {
	const slots: any[] = []
	const cleanups: Array<() => void> = []
	let cursor = 0
	let settings = normalizeSettings({
		...DEFAULT_SETTINGS,
		backgroundMode: 'midnight-waves',
	})
	let active = true
	const hooks = {
		...React,
		useMemo(factory: () => any, deps: any[]) {
			const index = cursor++
			if (
				!slots[index] ||
				deps.some((value, i) => value !== slots[index].deps[i])
			)
				slots[index] = { value: factory(), deps }
			return slots[index].value
		},
		useRef(value: any) {
			const index = cursor++
			return (slots[index] ??= { current: value })
		},
		useState(value: any) {
			const index = cursor++
			if (!(index in slots)) slots[index] = value
			return [
				slots[index],
				(next: any) => {
					slots[index] = typeof next === 'function' ? next(slots[index]) : next
				},
			]
		},
		useEffect(effect: () => (() => void) | undefined) {
			const index = cursor++
			if (!slots[index]) {
				slots[index] = true
				const cleanup = effect()
				if (cleanup) cleanups.push(cleanup)
			}
		},
		useSyncExternalStore: (_subscribe: any, snapshot: () => string) =>
			snapshot(),
	} as typeof React
	const runtime = createMainTabsWallpaper(
		hooks,
		{ View: 'View', Image: 'Image' },
		{
			subscribe: () => () => {},
			getSnapshot: () => JSON.stringify(settings),
			getSettings: () => settings,
			isActive: () => active,
		},
	)
	const original = mainTabs()
	const wrapper = runtime.wrap(original) as any
	const boundary = wrapper.props.children
	return {
		original,
		runtime,
		wrapper,
		setSettings(changes: any) {
			settings = normalizeSettings({ ...settings, ...changes })
		},
		render() {
			cursor = 0
			const root = boundary.type(boundary.props)
			const [gradient, wallpaper, scope] = root.props.children.props.children
			return {
				root,
				gradient,
				wallpaper,
				scope,
				image: wallpaper?.props.children[0],
			}
		},
		unmount() {
			for (const cleanup of cleanups) cleanup()
		},
		stop() {
			active = false
			runtime.dispose()
		},
	}
}

test('only the inspected MainTabs structure is eligible; originals are not mutated', () => {
	const h = runtimeHarness()
	assert.ok(getMainTabsParts(React, h.original))
	for (const invalid of [
		null,
		{},
		React.createElement('View', { key: 'empty' }),
		React.createElement(
			'View',
			{ key: 'unsupported' },
			React.createElement('Provider', {}, []),
		),
	]) {
		assert.equal(h.runtime.wrap(invalid), invalid)
	}
	const missingImage = createMainTabsWallpaper(
		React,
		{ View: 'View', Image: undefined },
		{
			subscribe: () => () => {},
			getSnapshot: () => '',
			getSettings: () => DEFAULT_SETTINGS,
			isActive: () => true,
		},
	)
	assert.equal(missingImage.wrap(h.original), h.original)
	const before = getMainTabsParts(React, h.original)!
	const rendered = h.render()
	assert.notEqual(rendered.root, h.original)
	assert.equal(rendered.gradient, before.gradient)
	assert.equal(rendered.scope.props.children, before.navigator)
	assert.equal((h.original.props.children as any).props.children.length, 2)
	assert.equal(rendered.wallpaper.props.pointerEvents, 'none')
	assert.equal(
		rendered.wallpaper.props.importantForAccessibility,
		'no-hide-descendants',
	)
})

test('loading and failures keep gradients; only a loaded wallpaper enables its nested scope', () => {
	const h = runtimeHarness()
	let rendered = h.render()
	assert.equal(rendered.scope.props.value, false)
	assert.equal(rendered.image.props.style[1].opacity, 0)
	assert.equal(rendered.image.props.source, WALLPAPER_SOURCE)
	rendered.image.props.onLoad()
	rendered = h.render()
	assert.equal(rendered.scope.props.value, true)
	assert.equal(rendered.image.props.style[1].opacity, 0.95)
	assert.equal(rendered.gradient.props.absolute, true)
	rendered.image.props.onLoadStart()
	assert.equal(h.render().scope.props.value, false)
	rendered.image.props.onLoad()
	rendered.image.props.onError()
	assert.equal(h.render().scope.props.value, false)
	assert.equal(h.render().wallpaper.props.children[1].props.style[1].opacity, 0)
})

test('mode switches keep navigation stable and stale requests cannot reveal the wallpaper', () => {
	const h = runtimeHarness()
	const initial = h.render()
	const staleLoad = initial.image.props.onLoad
	h.setSettings({ backgroundMode: 'gradient' })
	const off = h.render()
	assert.equal(off.wallpaper, null)
	assert.equal(off.scope.key, initial.scope.key)
	assert.equal(off.scope.type, initial.scope.type)
	assert.equal(off.scope.props.children, initial.scope.props.children)
	staleLoad()
	h.setSettings({ backgroundMode: 'midnight-waves' })
	let current = h.render()
	staleLoad()
	assert.equal(h.render().scope.props.value, false)
	current.image.props.onLoad()
	assert.equal(h.render().scope.props.value, true)
	h.setSettings({ lowPowerMode: true, wallpaperBlur: 6 })
	current = h.render()
	assert.equal(current.image.props.blurRadius, 0)
	h.setSettings({ enabled: false })
	assert.equal(h.render().scope.props.value, false)
	assert.equal(h.render().wallpaper, null)
})

test('unmount and plugin disposal reject late loads; render failure restores original content', () => {
	const h = runtimeHarness()
	const loaded = h.render().image.props.onLoad
	h.unmount()
	loaded()
	assert.equal(h.render().scope.props.value, false)
	h.stop()
	loaded()
	assert.equal(h.render().wallpaper, null)
	assert.equal(h.runtime.wrap(h.original), h.original)
	const ErrorBoundary = h.wrapper.type
	const boundary = new ErrorBoundary(h.wrapper.props)
	boundary.state = ErrorBoundary.getDerivedStateFromError(
		new Error('image renderer unavailable'),
	)
	assert.equal(boundary.render(), h.original)
})
