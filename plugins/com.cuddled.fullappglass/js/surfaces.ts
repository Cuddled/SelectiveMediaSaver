import { hexWithAlpha } from '../../com.cuddled.liquidglass/js/core'
import {
	ABSOLUTE_FILL,
	WALLPAPER_SOURCE,
} from '../../com.cuddled.liquidglass/js/wallpaper'
import { Atmosphere } from './Atmosphere'
import {
	backAccountBar,
	backAccountShade,
	backFloatingInput,
} from './bottomBars'
import {
	headerColor,
	profileButtonTheme,
	surfaceColor,
	toolbarColor,
} from './core'
import { generatedBackdrop } from './experience'
import { polishEnabled, polishStyles } from './polish'
import { profileGradientOverlay } from './profileTheme'
import type * as ReactTypes from 'react'
import type { Settings } from './core'

type ReactApi = typeof ReactTypes
type Element = ReactTypes.ReactElement<Record<string, any>>
export interface Access {
	subscribe(listener: () => void): () => void
	getSnapshot(): string
	getSettings(): Settings
	isActive(): boolean
	getWallpaper?(channelId?: string, scope?: 'app'): string
}

export function recolorChrome(
	React: ReactApi,
	original: unknown,
	kind: 'header' | 'scrim',
	settings: Settings,
	backdrop?: ReactTypes.ReactNode,
): unknown {
	if (
		((!settings.enabled || !settings.chats) && !backdrop) ||
		!React.isValidElement<Record<string, any>>(original)
	)
		return original
	const children = original.props.children
	if (!Array.isArray(children) || children.length !== 2) return original
	const [first, second] = children
	if (!React.isValidElement<Record<string, any>>(first)) return original
	const surface =
		kind === 'header' ? headerColor(settings) : surfaceColor(settings)
	if (kind === 'header') {
		if (
			original.type !== React.Fragment ||
			!Object.hasOwn(first.props, 'style')
		)
			return original
		return React.cloneElement(original, {}, [
			decorateHeader(
				React,
				first,
				settings.enabled && settings.chats,
				surface,
				backdrop,
			),
			second,
		])
	}
	if (
		original.props.pointerEvents !== 'none' ||
		!Array.isArray(first.props.colors) ||
		first.props.colors.length !== 2 ||
		!React.isValidElement<Record<string, any>>(second) ||
		!Object.hasOwn(second.props, 'style')
	)
		return original
	return React.cloneElement(original, {}, [
		React.cloneElement(first, {
			colors: [hexWithAlpha(settings.panelColor, 0), surface],
		}),
		React.cloneElement(second, {
			style: [second.props.style, { backgroundColor: surface }],
		}),
	])
}

/** Exact ChannelListStickyHeader output: no traversal into channel rows/banners. */
export function recolorListHeader(
	React: ReactApi,
	original: unknown,
	settings: Settings,
	backdrop?: ReactTypes.ReactNode,
): unknown {
	if (
		((!settings.enabled || !settings.mainScreens) && !backdrop) ||
		!React.isValidElement<Record<string, any>>(original) ||
		!Object.hasOwn(original.props, 'style') ||
		!Array.isArray(original.props.children)
	)
		return original
	return decorateHeader(
		React,
		original,
		settings.enabled && settings.mainScreens,
		headerColor(settings),
		backdrop,
	)
}

function decorateHeader(
	React: ReactApi,
	original: Element,
	enabled: boolean,
	fallback: string,
	backdrop?: ReactTypes.ReactNode,
) {
	return React.cloneElement(original, {
		style: enabled
			? [
					original.props.style,
					{ backgroundColor: backdrop ? '#0B0D17' : fallback },
				]
			: original.props.style,
		...(backdrop
			? {
					// Stable keyed slots survive live toggles. No wrapper around the header,
					// so its ref, layout measurement, safe-area padding and controls survive.
					children: [
						backdrop,
						React.createElement(
							React.Fragment,
							{ key: 'header-content' },
							original.props.children,
						),
					],
				}
			: {}),
	})
}

/** YouBannerDecorations paints both an opaque gradient and a mixed-RGB toolbar. */
export function recolorProfileToolbar(
	React: ReactApi,
	original: unknown,
	settings: Settings,
): unknown {
	if (
		!settings.enabled ||
		!settings.profiles ||
		!settings.controls ||
		!React.isValidElement<Record<string, any>>(original) ||
		original.props.pointerEvents !== 'box-none'
	)
		return original
	const children = original.props.children
	if (!Array.isArray(children) || children.length !== 2) return original
	const [gradient, toolbar] = children
	if (
		!React.isValidElement<Record<string, any>>(gradient) ||
		gradient.props.pointerEvents !== 'none' ||
		!Array.isArray(gradient.props.colors) ||
		gradient.props.colors.length !== 2 ||
		!React.isValidElement<Record<string, any>>(toolbar) ||
		!Object.hasOwn(toolbar.props, 'style')
	)
		return original
	return React.cloneElement(original, {}, [
		React.cloneElement(gradient, {
			colors: [hexWithAlpha(settings.panelColor, 0), toolbarColor(settings)],
		}),
		React.cloneElement(toolbar, {
			style: [toolbar.props.style, { backgroundColor: toolbarColor(settings) }],
		}),
	])
}

export function createSurfaces(
	React: ReactApi,
	native: { View: any; Image: any },
	access: Access,
	WorkspaceToolbar?: ReactTypes.ComponentType,
) {
	let alive = true
	let themeContext: ReactTypes.Context<any> | undefined
	const Visible = React.createContext(false)
	const headers = new WeakMap<
		ReactTypes.FunctionComponent<any>,
		ReactTypes.FunctionComponent<any>
	>()
	const active = () =>
		alive && access.isActive() && access.getSettings().enabled
	const accountBackgrounds = new WeakMap<
		ReactTypes.FunctionComponent<any>,
		ReactTypes.FunctionComponent<any>
	>()
	function Wallpaper({ original }: { original: Element }) {
		React.useSyncExternalStore(
			access.subscribe,
			access.getSnapshot,
			access.getSnapshot,
		)
		const settings = access.getSettings()
		const enabled = active()
		const uri = access.getWallpaper?.(undefined, 'app') ?? WALLPAPER_SOURCE.uri
		const generated = generatedBackdrop(settings, uri)
		const request = React.useMemo(() => ({}), [enabled, uri])
		const current = React.useRef<object | null>(request)
		current.current = request
		const [loaded, setLoaded] = React.useState<object | null>(null)
		React.useEffect(
			() => () => {
				current.current = null
			},
			[],
		)
		const ready = enabled && (generated || loaded === request)
		const mark = (success: boolean) => {
			if (active() && current.current === request)
				setLoaded(success ? request : null)
		}
		const layer = enabled
			? React.createElement(
					native.View,
					{
						key: 'full-app-wallpaper',
						style: ABSOLUTE_FILL,
						pointerEvents: 'none',
						accessible: false,
						accessibilityElementsHidden: true,
						importantForAccessibility: 'no-hide-descendants',
					},
					generated
						? null
						: React.createElement(native.Image, {
								key: uri,
								source: { uri },
								resizeMode: 'cover',
								blurRadius: settings.lowPower ? 0 : settings.blur,
								style: [ABSOLUTE_FILL, { opacity: ready ? 1 : 0 }],
								onLoadStart: () => mark(false),
								onLoad: () => mark(true),
								onError: () => mark(false),
							}),
					React.createElement(native.View, {
						style: [
							ABSOLUTE_FILL,
							{
								backgroundColor: hexWithAlpha('#000000', settings.darkness),
								opacity: ready ? 1 : 0,
							},
						],
					}),
					React.createElement(Atmosphere, { settings, backdrop: generated }),
				)
			: null
		// A dark fallback remains behind the app while the image loads or is offline.
		// The original provider, navigation subtree, refs and handlers stay in place.
		return React.cloneElement(
			original,
			enabled ? { theme: 'dark' } : {},
			React.createElement(
				native.View,
				{
					style: { flex: 1, backgroundColor: enabled ? '#0B0D17' : undefined },
				},
				layer,
				React.createElement(
					Visible.Provider,
					{ key: 'full-app-content', value: ready },
					original.props.children,
				),
			),
		)
	}
	function Chrome({
		original,
		kind,
		channelId,
	}: {
		original: unknown
		kind: 'header' | 'scrim' | 'list-header' | 'profile-toolbar'
		channelId?: string
	}) {
		React.useSyncExternalStore(
			access.subscribe,
			access.getSnapshot,
			access.getSnapshot,
		)
		const settings = active()
			? access.getSettings()
			: { ...access.getSettings(), enabled: false }
		const backdrop =
			native.View &&
			native.Image &&
			(kind === 'header' || kind === 'list-header')
				? React.createElement(HeaderWallpaper, {
						key: 'header-wallpaper',
						settings,
						channelId,
						enabled:
							settings.enabled &&
							(kind === 'header' ? settings.chats : settings.mainScreens),
					})
				: undefined
		if (kind === 'list-header')
			return recolorListHeader(React, original, settings, backdrop)
		if (kind === 'profile-toolbar')
			return recolorProfileToolbar(React, original, settings)
		return recolorChrome(React, original, kind, settings, backdrop)
	}
	function HeaderWallpaper({
		settings,
		enabled,
		composer = false,
		channelId,
	}: {
		settings: Settings
		enabled: boolean
		composer?: boolean
		channelId?: string
	}) {
		const uri = access.getWallpaper?.(channelId) ?? WALLPAPER_SOURCE.uri
		const generated = generatedBackdrop(settings, uri)
		const request = React.useMemo(() => ({}), [enabled, uri])
		const current = React.useRef<object | null>(request)
		current.current = request
		const [loaded, setLoaded] = React.useState<object | null>(null)
		React.useEffect(
			() => () => {
				current.current = null
			},
			[],
		)
		const ready = enabled && (generated || loaded === request)
		const mark = (ok: boolean) => {
			if (active() && enabled && current.current === request)
				setLoaded(ok ? request : null)
		}
		if (!enabled) return null
		return React.createElement(
			native.View,
			{
				style: [
					ABSOLUTE_FILL,
					{ backgroundColor: '#0B0D17', overflow: 'hidden' },
				],
				pointerEvents: 'none',
				accessible: false,
				accessibilityElementsHidden: true,
				importantForAccessibility: 'no-hide-descendants',
			},
			generated
				? null
				: React.createElement(native.Image, {
						key: uri,
						source: { uri },
						resizeMode: 'cover',
						blurRadius: settings.lowPower ? 0 : settings.blur,
						style: [ABSOLUTE_FILL, { opacity: ready ? 1 : 0 }],
						onLoadStart: () => mark(false),
						onLoad: () => mark(true),
						onError: () => mark(false),
					}),
			React.createElement(
				native.View,
				{
					style: [
						ABSOLUTE_FILL,
						{ backgroundColor: hexWithAlpha('#000000', settings.darkness) },
					],
				},
				generated
					? React.createElement(Atmosphere, {
							settings: {
								...settings,
								studio: { ...settings.studio, ambient: false },
							},
							backdrop: true,
						})
					: null,
			),
			React.createElement(native.View, {
				style: [ABSOLUTE_FILL, { backgroundColor: surfaceColor(settings) }],
			}),
			composer && polishEnabled(settings, 'Composer')
				? React.createElement(native.View, {
						style: polishStyles(settings).composer,
						pointerEvents: 'none',
						accessible: false,
						importantForAccessibility: 'no-hide-descendants',
					})
				: null,
		)
	}
	function ProfileButtons({ original }: { original: Element }) {
		React.useSyncExternalStore(
			access.subscribe,
			access.getSnapshot,
			access.getSnapshot,
		)
		const parent = React.useContext(themeContext!)
		const settings = access.getSettings()
		const value = active() ? profileButtonTheme(settings, parent) : parent
		return React.createElement(themeContext!.Provider, { value }, original)
	}
	function BottomBar({
		original,
		kind,
	}: {
		original: unknown
		kind: 'input' | 'account' | 'account-shade'
	}) {
		React.useSyncExternalStore(
			access.subscribe,
			access.getSnapshot,
			access.getSnapshot,
		)
		const settings = access.getSettings()
		const enabled =
			active() && (kind === 'input' ? settings.chats : settings.mainScreens)
		const wallpaper = React.createElement(HeaderWallpaper, {
			key: 'bottom-bar-wallpaper',
			settings,
			enabled,
			composer: kind === 'input',
		})
		return kind === 'input'
			? backFloatingInput(
					React,
					original,
					enabled,
					wallpaper,
					enabled && settings.workspace.enabled && WorkspaceToolbar
						? React.createElement(WorkspaceToolbar, {
								key: 'workspace-toolbar',
							})
						: null,
				)
			: kind === 'account-shade'
				? backAccountShade(React, original, enabled, wallpaper)
				: backAccountBar(React, original, enabled, wallpaper)
	}
	function ProfileBackdrop({ original }: { original: Element }) {
		React.useSyncExternalStore(
			access.subscribe,
			access.getSnapshot,
			access.getSnapshot,
		)
		const settings = access.getSettings()
		const enabled = active() && settings.profiles
		const uri = access.getWallpaper?.(undefined, 'app') ?? WALLPAPER_SOURCE.uri
		const generated = generatedBackdrop(settings, uri)
		const request = React.useMemo(() => ({}), [enabled, uri])
		const current = React.useRef<object | null>(request)
		current.current = request
		const [loaded, setLoaded] = React.useState<object | null>(null)
		React.useEffect(
			() => () => {
				current.current = null
			},
			[],
		)
		const ready = enabled && (generated || loaded === request)
		const mark = (ok: boolean) => {
			if (
				active() &&
				access.getSettings().profiles &&
				current.current === request
			)
				setLoaded(ok ? request : null)
		}
		if (!enabled) return original
		const profileColors = profileGradientOverlay(
			settings,
			original.props.colors,
		)
		// Replace only the decorative fixed background, behind banners/content/scrolling.
		// This opaque base prevents the previous screen bleeding through even offline.
		return React.createElement(
			native.View,
			{
				style: [
					original.props.style,
					{ backgroundColor: '#0B0D17', overflow: 'hidden' },
				],
				pointerEvents: 'none',
				accessible: false,
				accessibilityElementsHidden: true,
				importantForAccessibility: 'no-hide-descendants',
			},
			generated
				? null
				: React.createElement(native.Image, {
						key: uri,
						source: { uri },
						resizeMode: 'cover',
						blurRadius: settings.lowPower ? 0 : settings.blur,
						style: [ABSOLUTE_FILL, { opacity: ready ? 1 : 0 }],
						onLoadStart: () => mark(false),
						onLoad: () => mark(true),
						onError: () => mark(false),
					}),
			React.createElement(native.View, {
				style: [
					ABSOLUTE_FILL,
					{ backgroundColor: hexWithAlpha('#000000', settings.darkness) },
				],
			}),
			React.createElement(native.View, {
				style: [ABSOLUTE_FILL, { backgroundColor: surfaceColor(settings) }],
			}),
			generated
				? React.createElement(Atmosphere, { settings, backdrop: true })
				: null,
			profileColors
				? React.cloneElement(original, {
						key: 'profile-owner-gradient',
						style: ABSOLUTE_FILL,
						colors: profileColors,
					})
				: null,
		)
	}
	class Guard extends React.Component<
		{ original: Element; children?: ReactTypes.ReactNode },
		{ failed: boolean }
	> {
		state = { failed: false }
		static getDerivedStateFromError() {
			return { failed: true }
		}
		componentDidCatch(error: unknown) {
			console.warn('[FullAppGlass] Backdrop unavailable:', error)
		}
		render() {
			return this.state.failed ? this.props.original : this.props.children
		}
	}
	return {
		wrapAccountShade(original: unknown) {
			return alive &&
				native.View &&
				native.Image &&
				React.isValidElement(original)
				? React.createElement(BottomBar as any, {
						original,
						kind: 'account-shade',
					})
				: original
		},
		wrapFloatingInput(original: unknown) {
			return alive &&
				native.View &&
				native.Image &&
				React.isValidElement(original)
				? React.createElement(BottomBar as any, { original, kind: 'input' })
				: original
		},
		wrapAccountBackground(original: unknown) {
			if (
				!alive ||
				!native.View ||
				!native.Image ||
				!React.isValidElement<Record<string, any>>(original) ||
				typeof original.type !== 'function' ||
				original.type.prototype?.isReactComponent ||
				typeof original.props.barWidth !== 'number' ||
				!Number.isFinite(original.props.barWidth) ||
				original.props.barWidth <= 0 ||
				!['number', 'string'].includes(typeof original.props.backgroundColor)
			)
				return original
			const Renderer = original.type as ReactTypes.FunctionComponent<any>
			let Wrapper = accountBackgrounds.get(Renderer)
			if (!Wrapper) {
				Wrapper = props =>
					React.createElement(BottomBar as any, {
						original: Renderer(props),
						kind: 'account',
					})
				accountBackgrounds.set(Renderer, Wrapper)
			}
			return React.createElement(Wrapper, {
				...original.props,
				key: original.key,
			})
		},
		setThemeContext(value: ReactTypes.Context<any>) {
			themeContext = value
		},
		wrapProfileButtons(original: unknown) {
			return alive && themeContext?.Provider && React.isValidElement(original)
				? React.createElement(ProfileButtons, { original: original as Element })
				: original
		},
		wrapListHeader(original: unknown) {
			return alive && React.isValidElement(original)
				? React.createElement(Chrome as any, { original, kind: 'list-header' })
				: original
		},
		wrapProfileToolbar(original: unknown) {
			return alive && React.isValidElement(original)
				? React.createElement(Chrome as any, {
						original,
						kind: 'profile-toolbar',
					})
				: original
		},
		wrapProfileBackdrop(original: unknown) {
			if (
				!alive ||
				!native.View ||
				!native.Image ||
				!React.isValidElement<Record<string, any>>(original) ||
				original.props.pointerEvents !== 'none' ||
				!Object.hasOwn(original.props, 'style') ||
				original.props.children != null
			)
				return original
			return React.createElement(
				Guard,
				{ original },
				React.createElement(ProfileBackdrop, { original }),
			)
		},
		wrapRoot(original: unknown) {
			// The inspected outer theme module returns a theme provider with children.
			if (
				!alive ||
				!native.View ||
				!native.Image ||
				!React.isValidElement<Record<string, any>>(original) ||
				typeof original.props.theme !== 'string' ||
				!Object.hasOwn(original.props, 'children')
			)
				return original
			return React.createElement(
				Guard,
				{ original },
				React.createElement(Wallpaper, { original }),
			)
		},
		wrapScreen(original: unknown) {
			if (!alive || !React.isValidElement<Record<string, any>>(original))
				return original
			const content = original.props.children
			const fragment =
				React.isValidElement<Record<string, any>>(content) &&
				content.type === React.Fragment
					? content
					: undefined
			const children = fragment ? fragment.props.children : content
			if (!Array.isArray(children) || children.length !== 2) return original
			const header = children[0]
			if (
				!React.isValidElement<Record<string, any>>(header) ||
				typeof header.type !== 'function' ||
				header.type.prototype?.isReactComponent ||
				typeof header.props.channelId !== 'string' ||
				!/^\d{17,20}$/.test(header.props.channelId) ||
				typeof header.props.isBackEnabled !== 'boolean' ||
				typeof header.props.measureNavigationTTI !== 'boolean'
			)
				return original
			const Header = header.type as ReactTypes.FunctionComponent<any>
			let Wrapper = headers.get(Header)
			if (!Wrapper) {
				Wrapper = props =>
					React.createElement(Chrome as any, {
						original: Header(props),
						kind: 'header',
						channelId: props.channelId,
					})
				headers.set(Header, Wrapper)
			}
			const next = [
				React.createElement(Wrapper, { ...header.props, key: header.key }),
				children[1],
			]
			return React.cloneElement(
				original,
				{},
				fragment ? React.cloneElement(fragment, {}, next) : next,
			)
		},
		wrapScrim(original: unknown) {
			return alive && React.isValidElement(original)
				? React.createElement(Chrome as any, { original, kind: 'scrim' })
				: original
		},
		useVisible: () => React.useContext(Visible),
		dispose() {
			alive = false
		},
	}
}
