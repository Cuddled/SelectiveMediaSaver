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

test('account shade stays opaque while wallpaper loads or fails and follows live main-screen settings', () => {
	const h = harness('account-shade')
	const first = h.render()
	assert.equal(first.container.props.style[1].backgroundColor, '#0B0D17')
	assert.equal(first.layer.props.pointerEvents, 'none')
	assert.equal(
		first.layer.props.importantForAccessibility,
		'no-hide-descendants',
	)
	assert.equal(first.image.props.style[1].opacity, 0)
	first.image.props.onLoad()
	assert.equal(h.render().image.props.style[1].opacity, 1)
	first.image.props.onError()
	assert.equal(h.render().image.props.style[1].opacity, 0)
	h.state.update({
		...h.state.getSettings(),
		panelColor: '#291835',
		darkness: 0.6,
	})
	assert.equal(
		h.render().layer.props.children[1].props.style[1].backgroundColor,
		'#00000099',
	)
	for (const changes of [{ mainScreens: false }, { enabled: false }]) {
		h.state.update({ enabled: true, ...changes })
		const off = h.render()
		assert.equal(off.layer, null)
		assert.equal(
			off.container.props.style,
			h.original.props.children[0].props.style,
		)
	}
	h.state.update({ enabled: true })
	assert.equal(h.render().image.props.style[1].opacity, 0)
	h.runtime.dispose()
	assert.equal(h.render().layer, null)
	assert.equal(h.runtime.wrapAccountShade(h.original), h.original)
})

function harness(
	scope:
		| 'app'
		| 'profile'
		| 'header'
		| 'input'
		| 'account'
		| 'account-shade'
		| 'masked-account' = 'app',
	gradient = false,
) {
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
	let original: React.ReactElement<any> =
		scope === 'header'
			? React.createElement(
					'View',
					{
						style: { paddingTop: 16, zIndex: 1 },
						ref: React.createRef(),
						onLayout: () => {},
					},
					[React.createElement('Button', { key: 'search', onPress: () => {} })],
				)
			: scope === 'profile'
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
	if (scope === 'input') {
		const box = React.createElement(
			'View',
			{
				style: { borderRadius: 24 },
				collapsable: false,
				onLayout: () => {},
				onStartShouldSetResponder: () => true,
				onResponderRelease: () => {},
			},
			[
				null,
				null,
				React.createElement('TextInput', {
					key: 'input',
					value: 'draft',
					ref: React.createRef(),
				}),
			],
		)
		original = React.createElement(
			'AnimatedView',
			{ style: { paddingBottom: 20 }, onLayout: () => {} },
			React.createElement(React.Fragment, {}, [null, null, box, null]),
		)
	} else if (scope === 'account-shade') {
		original = React.createElement(React.Fragment, {}, [
			React.createElement('View', {
				style: [
					{ position: 'absolute', bottom: 0, left: 0, right: 0 },
					{ height: 80, opacity: 0 },
				],
				pointerEvents: 'box-only',
			}),
			React.createElement('LinearGradient', {
				pointerEvents: 'none',
				colors: ['#00000000', '#171B2B33'],
			}),
			React.createElement('View', { style: { height: 48 } }),
		])
	} else if (scope === 'account' || scope === 'masked-account') {
		const fill = React.createElement('AnimatedView', {
			style: [{ width: 330, height: 56 }, { animatedRadius: true }],
		})
		const output =
			scope === 'account'
				? fill
				: React.createElement(
						'MaskedView',
						{
							style: { position: 'absolute' },
							maskElement: React.createElement('AvatarMask'),
						},
						fill,
					)
		original = React.createElement(() => output, {
			key: 'original-background',
			barWidth: 330,
			backgroundColor: '#12345633',
			avatarSize: 60,
		})
	}
	const wrapped = (
		scope === 'app'
			? runtime.wrapRoot(original)
			: scope === 'header'
				? runtime.wrapListHeader(original)
				: scope === 'input'
					? runtime.wrapFloatingInput(original)
					: scope === 'account-shade'
						? runtime.wrapAccountShade(original)
						: scope === 'account' || scope === 'masked-account'
							? runtime.wrapAccountBackground(original)
							: runtime.wrapProfileBackdrop(original)
	) as any
	const boundary =
		scope === 'header' || scope === 'input' || scope === 'account-shade'
			? wrapped
			: scope === 'account' || scope === 'masked-account'
				? wrapped.type(wrapped.props)
				: wrapped.props.children
	return {
		state,
		original,
		runtime,
		wrapped,
		render() {
			cursor = 0
			const root = boundary.type(boundary.props)
			if (scope === 'account-shade') {
				const container = root.props.children[0]
				const wallpaper = container.props.children
				const layer = wallpaper.type(wallpaper.props)
				return {
					root,
					container,
					layer,
					scope: null,
					image: layer?.props.children[0],
				}
			}
			if (
				scope === 'input' ||
				scope === 'account' ||
				scope === 'masked-account'
			) {
				const container =
					scope === 'input'
						? root.props.children.props.children[2]
						: scope === 'masked-account'
							? root.props.children
							: root
				const wallpaper = container.props.children[0]
				const layer = wallpaper.type(wallpaper.props)
				return {
					root,
					container,
					layer,
					scope: container.props.children[1],
					image: layer?.props.children[0],
				}
			}
			if (scope === 'header') {
				const wallpaper = root.props.children[0]
				const layer = wallpaper.type(wallpaper.props)
				return {
					root,
					container: root,
					layer,
					scope: root.props.children[1],
					image: layer?.props.children[0],
				}
			}
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

test('wallpaper header slots preserve chat frames, controls and original styles across toggles', () => {
	const settings = normalize({ enabled: true })
	const content = React.createElement('Controls', {
		onPress: () => {},
		ref: React.createRef(),
	})
	const bar = React.createElement(
		'NavTTIView',
		{
			style: { paddingTop: 26, flexDirection: 'row' },
			onLayout: () => {},
			ref: React.createRef(),
			spanComponent: 'channel_header',
		},
		content,
	)
	const frame = React.createElement('Frame', { key: 'frame' })
	const original = React.createElement(React.Fragment, {}, [bar, frame])
	const background = React.createElement('HeaderWallpaper', {
		key: 'header-wallpaper',
	})
	const next = recolorChrome(
		React,
		original,
		'header',
		settings,
		background,
	) as any
	const header = next.props.children[0]
	assert.equal(header.type, bar.type)
	assert.equal(header.props.ref, bar.props.ref)
	assert.equal(header.props.onLayout, bar.props.onLayout)
	assert.equal(header.props.spanComponent, 'channel_header')
	assert.equal(header.props.style[0], bar.props.style)
	assert.equal(header.props.style[1].backgroundColor, '#0B0D17')
	assert.equal(header.props.children[0], background)
	assert.equal(header.props.children[1].props.children, content)
	assert.equal(next.props.children[1], frame)
	const off = recolorChrome(
		React,
		original,
		'header',
		{ ...settings, enabled: false },
		background,
	) as any
	assert.equal(off.props.children[0].props.style, bar.props.style)
	assert.equal(
		off.props.children[0].props.children[1].key,
		header.props.children[1].key,
	)
	assert.equal(
		off.props.children[0].props.children[1].type,
		header.props.children[1].type,
	)
	assert.equal(off.props.children[0].props.children[1].props.children, content)
})

test('header wallpaper blocks underlying text while loading/offline without changing header measurement', () => {
	const h = harness('header')
	const view = h.render()
	assert.equal(view.root.props.ref, h.original.props.ref)
	assert.equal(view.root.props.onLayout, h.original.props.onLayout)
	assert.equal(view.scope.props.children, h.original.props.children)
	assert.equal(view.layer.props.style[0].position, 'absolute')
	assert.equal(view.layer.props.style[1].backgroundColor, '#0B0D17')
	assert.equal(view.layer.props.pointerEvents, 'none')
	assert.equal(
		view.layer.props.importantForAccessibility,
		'no-hide-descendants',
	)
	assert.equal(view.image.props.style[1].opacity, 0)
	view.image.props.onLoad()
	assert.equal(h.render().image.props.style[1].opacity, 1)
	view.image.props.onError()
	assert.equal(h.render().image.props.style[1].opacity, 0)
	h.state.update({ ...h.state.getSettings(), transparency: 1, darkness: 0 })
	assert.equal(h.render().layer.props.style[1].backgroundColor, '#0B0D17')
	assert.equal(
		h.render().layer.props.children[2].props.style[1].backgroundColor,
		'#171B2B00',
	)
})

test('header wallpaper respects low power, live toggles, stale callbacks and cleanup', () => {
	const h = harness('header')
	const old = h.render()
	old.image.props.onLoad()
	h.state.update({ ...h.state.getSettings(), mainScreens: false })
	const off = h.render()
	assert.equal(off.layer, null)
	assert.equal(off.root.props.style, h.original.props.style)
	assert.equal(off.scope.key, old.scope.key)
	assert.equal(off.scope.props.children, old.scope.props.children)
	old.image.props.onLoad()
	h.state.update({ ...h.state.getSettings(), mainScreens: true, blur: 7 })
	assert.equal(h.render().image.props.style[1].opacity, 0)
	old.image.props.onLoad()
	assert.equal(h.render().image.props.style[1].opacity, 0)
	assert.equal(h.render().image.props.blurRadius, 0)
	h.state.update({ ...h.state.getSettings(), lowPower: false })
	assert.equal(h.render().image.props.blurRadius, 7)
	const current = h.render().image
	h.unmount()
	current.props.onLoad()
	assert.equal(h.render().image.props.style[1].opacity, 0)
	h.stop()
	assert.equal(h.render().layer, null)
	assert.equal(h.runtime.wrapListHeader(h.original), h.original)
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

test('bottom wallpaper handles loading, failure, stale callbacks, area switches and cleanup for all three layouts', () => {
	for (const kind of ['input', 'account', 'masked-account'] as const) {
		const h = harness(kind)
		const area = kind === 'input' ? 'chats' : 'mainScreens'
		const initial = h.render()
		assert.equal(initial.layer.props.pointerEvents, 'none')
		assert.equal(
			initial.layer.props.importantForAccessibility,
			'no-hide-descendants',
		)
		assert.equal(initial.layer.props.style[1].backgroundColor, '#0B0D17')
		assert.equal(initial.image.props.style[1].opacity, 0)
		initial.image.props.onLoad()
		assert.equal(h.render().image.props.style[1].opacity, 1)
		initial.image.props.onError()
		assert.equal(h.render().image.props.style[1].opacity, 0)
		h.state.update({ ...h.state.getSettings(), [area]: false })
		const off = h.render()
		assert.equal(off.layer, null)
		assert.equal(off.scope.key, initial.scope.key)
		assert.equal(off.scope.props.children, initial.scope.props.children)
		initial.image.props.onLoad()
		h.state.update({
			...h.state.getSettings(),
			[area]: true,
			blur: 8,
			transparency: 1,
		})
		assert.equal(h.render().image.props.style[1].opacity, 0)
		assert.equal(h.render().image.props.blurRadius, 0)
		assert.equal(h.render().container.props.style[1].backgroundColor, '#0B0D17')
		initial.image.props.onLoad()
		assert.equal(h.render().image.props.style[1].opacity, 0)
		h.state.update({ ...h.state.getSettings(), lowPower: false })
		assert.equal(h.render().image.props.blurRadius, 8)
		const latest = h.render().image
		h.unmount()
		latest.props.onLoad()
		assert.equal(h.render().image.props.style[1].opacity, 0)
		h.state.update({ ...h.state.getSettings(), enabled: false })
		assert.equal(h.render().layer, null)
		h.stop()
		assert.equal(h.runtime.wrapFloatingInput(h.original), h.original)
		assert.equal(h.runtime.wrapAccountBackground(h.original), h.original)
	}
})

test('composer accents update live without moving the draft, reply or keyboard layout', () => {
	const h = harness('input')
	const initial = h.render()
	const accent = initial.layer.props.children[3]
	assert.equal(accent.props.pointerEvents, 'none')
	assert.equal(accent.props.importantForAccessibility, 'no-hide-descendants')
	assert.equal(accent.props.style.borderRadius, 24)
	h.state.update({
		...h.state.getSettings(),
		accentColor: '#9EE8CE',
		accentOpacity: 1,
	})
	assert.equal(
		h.render().layer.props.children[3].props.style.borderColor,
		'#9EE8CEA5',
	)
	for (const key of ['polishComposer', 'controls'] as const) {
		h.state.update({ ...h.state.getSettings(), [key]: false })
		const off = h.render()
		assert.equal(off.layer.props.children[3], null)
		assert.equal(off.root.props.style, initial.root.props.style)
		assert.equal(off.scope.props.children, initial.scope.props.children)
		assert.equal(off.scope.key, initial.scope.key)
		h.state.update({ ...h.state.getSettings(), [key]: true })
	}
	const account = harness('account')
	assert.equal(account.render().layer.props.children[3], null)
})

test('account background wrappers are stable and preserve props without wrapping unknown renderers', () => {
	const h = harness('account')
	const second = h.runtime.wrapAccountBackground(h.original) as any
	assert.equal(second.type, h.wrapped.type)
	assert.equal(second.key, h.original.key)
	assert.equal(second.props.barWidth, h.original.props.barWidth)
	assert.equal(second.props.avatarSize, h.original.props.avatarSize)
	for (const props of [
		{ barWidth: NaN },
		{ barWidth: 0 },
		{ barWidth: '330' },
		{ backgroundColor: null },
	]) {
		const unknown = React.cloneElement(h.original, props)
		assert.equal(h.runtime.wrapAccountBackground(unknown), unknown)
	}
	const unknown = React.createElement('View', {
		barWidth: 330,
		backgroundColor: '#000000',
	})
	assert.equal(h.runtime.wrapAccountBackground(unknown), unknown)
	h.stop()
	assert.equal(h.runtime.wrapAccountBackground(h.original), h.original)
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
