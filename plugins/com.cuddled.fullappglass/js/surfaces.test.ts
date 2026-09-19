import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import {
	createState,
	headerColor,
	normalize,
	surfaceColor,
	toolbarColor,
} from './core'
import {
	createSurfaces,
	recolorChrome,
	recolorListHeader,
	recolorProfileToolbar,
} from './surfaces'

function harness(scope: 'app' | 'profile' = 'app', gradient = false) {
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
	const original: React.ReactElement<any> =
		scope === 'profile'
			? React.createElement(gradient ? 'Gradient' : 'View', {
					style: [
						{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
						{ borderRadius: 24 },
					],
					pointerEvents: 'none',
					...(gradient ? { colors: ['#12345633', '#ABCDEF33'] } : {}),
				})
			: React.createElement(
					'ThemeProvider',
					{
						theme: 'midnight',
						ref: React.createRef(),
						onEvent: () => {},
						key: 'root',
					},
					React.createElement('Navigation', {
						initialState: 'existing-navigation',
					}),
				)
	const wrapped = (
		scope === 'app'
			? runtime.wrapRoot(original)
			: runtime.wrapProfileBackdrop(original)
	) as any
	const boundary = wrapped.props.children
	return {
		state,
		original,
		runtime,
		wrapped,
		render() {
			cursor = 0
			const root = boundary.type(boundary.props)
			if (scope === 'profile')
				return {
					root,
					container: root,
					layer: root,
					scope: null,
					image: root.props.children?.[0],
				}
			const container = root.props.children
			const [layer, visibleScope] = container.props.children
			return {
				root,
				container,
				layer,
				scope: visibleScope,
				image: layer?.props.children[0],
			}
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

test('chat headers retain contrast, scrims follow the master slider, and original button properties survive', () => {
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
		headerColor(settings),
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

test('channel-list backing preserves scrolling, refs and header controls without recoloring list rows', () => {
	const settings = normalize({ enabled: true, transparency: 1 })
	const child = React.createElement('Button', {
		onPress: () => {},
		key: 'button',
	})
	const original = React.createElement(
		'View',
		{
			style: { paddingTop: 16, zIndex: 1 },
			ref: React.createRef(),
			onLayout: () => {},
		},
		[child],
	)
	const next = recolorListHeader(React, original, settings) as any
	assert.equal(next.props.children, (original.props as any).children)
	assert.equal(next.props.ref, original.props.ref)
	assert.equal(next.props.onLayout, original.props.onLayout)
	assert.equal(next.props.style[0], original.props.style)
	assert.equal(next.props.style[1].backgroundColor, headerColor(settings))
	assert.equal(
		recolorListHeader(React, original, { ...settings, mainScreens: false }),
		original,
	)
	assert.equal(
		recolorListHeader(React, original, { ...settings, enabled: false }),
		original,
	)
	assert.equal(recolorListHeader(React, child, settings), child)
})

test('profile toolbar corrects the final gradient and fill without replacing buttons or refs', () => {
	const settings = normalize({ enabled: true })
	const buttons = React.createElement('Buttons', {
		ref: React.createRef(),
		onPress: () => {},
		disabled: true,
	})
	const gradient = React.createElement('Gradient', {
		key: 'gradient',
		pointerEvents: 'none',
		colors: ['#FFFFFF00', '#FFFFFFFF'],
		locations: [0, 1],
		style: { height: 90 },
	})
	const bar = React.createElement(
		'View',
		{ key: 'bar', style: { marginBottom: 20, borderRadius: 16 } },
		buttons,
	)
	const original = React.createElement(
		'View',
		{ pointerEvents: 'box-none', style: { bottom: 0 } },
		[gradient, bar],
	)
	const next = recolorProfileToolbar(React, original, settings) as any
	assert.equal(next.props.style, original.props.style)
	assert.equal(next.props.children[0].props.colors[1], toolbarColor(settings))
	assert.equal(next.props.children[0].props.locations, gradient.props.locations)
	assert.equal(next.props.children[1].props.style[0], bar.props.style)
	assert.equal(next.props.children[1].props.children, buttons)
	assert.equal(gradient.props.colors[1], '#FFFFFFFF')
	for (const key of ['enabled', 'profiles', 'controls'])
		assert.equal(
			recolorProfileToolbar(React, original, { ...settings, [key]: false }),
			original,
		)
	assert.equal(recolorProfileToolbar(React, bar, settings), bar)
})

test('both plain and custom profile backgrounds block underlying screens even when loading/offline', () => {
	for (const gradient of [false, true]) {
		const h = harness('profile', gradient)
		const view = h.render()
		assert.equal(view.root.props.style[0], h.original.props.style)
		assert.equal(view.root.props.style[1].backgroundColor, '#0B0D17')
		assert.equal(view.root.props.pointerEvents, 'none')
		assert.equal(
			view.root.props.importantForAccessibility,
			'no-hide-descendants',
		)
		assert.equal(view.image.props.style[1].opacity, 0)
		view.image.props.onLoad()
		assert.equal(h.render().image.props.style[1].opacity, 1)
		view.image.props.onError()
		assert.equal(h.render().image.props.style[1].opacity, 0)
		assert.equal(h.render().root.props.style[1].backgroundColor, '#0B0D17')
		h.state.update({ ...h.state.getSettings(), profiles: false })
		assert.equal(h.render().root, h.original)
	}
})

test('profile background ignores stale callbacks and honors pause, area toggle, blur and disposal', () => {
	const h = harness('profile')
	const oldImage = h.render().image
	h.state.update({ ...h.state.getSettings(), profiles: false })
	h.render()
	oldImage.props.onLoad()
	h.state.update({ ...h.state.getSettings(), profiles: true, blur: 6 })
	assert.equal(h.render().image.props.style[1].opacity, 0)
	oldImage.props.onLoad()
	assert.equal(h.render().image.props.style[1].opacity, 0)
	assert.equal(h.render().image.props.blurRadius, 0)
	h.state.update({ ...h.state.getSettings(), lowPower: false })
	assert.equal(h.render().image.props.blurRadius, 6)
	const latest = h.render().image
	h.unmount()
	latest.props.onLoad()
	assert.equal(h.render().image.props.style[1].opacity, 0)
	h.state.update({ ...h.state.getSettings(), enabled: false })
	assert.equal(h.render().root, h.original)
	h.stop()
	assert.equal(h.runtime.wrapProfileBackdrop(h.original), h.original)
})

test('profile-only button theme preserves the group and all descendant interaction props', () => {
	const parent = {
		theme: 'light',
		primaryColor: 123,
		secondaryColor: 456,
		key: 'user',
		density: 'compact',
	}
	const state = createState({ enabled: true })
	const hooks = {
		...React,
		useContext: () => parent,
		useSyncExternalStore: (_: any, snapshot: any) => snapshot(),
	} as typeof React
	const surfaces = createSurfaces(
		hooks,
		{ View: 'View', Image: 'Image' },
		{ ...state, isActive: () => true },
	)
	const group = React.createElement(
		'View',
		{},
		React.createElement('Button', {
			onPress: () => {},
			ref: React.createRef(),
			disabled: true,
		}),
	)
	assert.equal(surfaces.wrapProfileButtons(group), group)
	surfaces.setThemeContext(React.createContext(parent))
	const wrapped = surfaces.wrapProfileButtons(group) as any
	const value = wrapped.type(wrapped.props)
	assert.equal(value.props.children, group)
	assert.equal(value.props.value.primaryColor, null)
	assert.equal(parent.primaryColor, 123)
	state.update({ enabled: true, controls: false })
	assert.equal(wrapped.type(wrapped.props).props.value, parent)
	surfaces.dispose()
	assert.equal(wrapped.type(wrapped.props).props.value, parent)
})

test('new boundaries ignore unknown background/toolbar layouts and restore after disposal', () => {
	const h = harness('profile')
	for (const value of [
		null,
		{},
		React.createElement('View', { style: {} }),
		React.createElement(
			'View',
			{ pointerEvents: 'none', style: {} },
			React.createElement('Banner'),
		),
	])
		assert.equal(h.runtime.wrapProfileBackdrop(value), value)
	const mismatched = React.createElement(
		'View',
		{ pointerEvents: 'box-none' },
		[
			React.createElement('Image', { key: 'image' }),
			React.createElement('Button', { key: 'button' }),
		],
	)
	assert.equal(
		recolorProfileToolbar(React, mismatched, h.state.getSettings()),
		mismatched,
	)
	h.stop()
	assert.equal(h.runtime.wrapProfileToolbar(mismatched), mismatched)
	assert.equal(h.runtime.wrapListHeader(mismatched), mismatched)
	assert.equal(h.runtime.wrapProfileButtons(mismatched), mismatched)
})
