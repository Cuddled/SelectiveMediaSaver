import { hexWithAlpha } from '../../com.cuddled.liquidglass/js/core'
import {
	ABSOLUTE_FILL,
	WALLPAPER_SOURCE,
} from '../../com.cuddled.liquidglass/js/wallpaper'
import { surfaceColor } from './core'
import type * as ReactTypes from 'react'
import type { Settings } from './core'

type ReactApi = typeof ReactTypes
type Element = ReactTypes.ReactElement<Record<string, any>>
export interface Access {
	subscribe(listener: () => void): () => void
	getSnapshot(): string
	getSettings(): Settings
	isActive(): boolean
}

export function recolorChrome(
	React: ReactApi,
	original: unknown,
	kind: 'header' | 'scrim',
	settings: Settings,
): unknown {
	if (
		!settings.enabled ||
		!settings.chats ||
		!React.isValidElement<Record<string, any>>(original)
	)
		return original
	const children = original.props.children
	if (!Array.isArray(children) || children.length !== 2) return original
	const [first, second] = children
	if (!React.isValidElement<Record<string, any>>(first)) return original
	const surface = surfaceColor(settings)
	if (kind === 'header') {
		if (
			original.type !== React.Fragment ||
			!Object.hasOwn(first.props, 'style')
		)
			return original
		return React.cloneElement(original, {}, [
			React.cloneElement(first, {
				style: [first.props.style, { backgroundColor: surface }],
			}),
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

export function createSurfaces(
	React: ReactApi,
	native: { View: any; Image: any },
	access: Access,
) {
	let alive = true
	const Visible = React.createContext(false)
	const headers = new WeakMap<
		ReactTypes.FunctionComponent<any>,
		ReactTypes.FunctionComponent<any>
	>()
	const active = () =>
		alive && access.isActive() && access.getSettings().enabled
	function Wallpaper({ original }: { original: Element }) {
		React.useSyncExternalStore(
			access.subscribe,
			access.getSnapshot,
			access.getSnapshot,
		)
		const settings = access.getSettings()
		const enabled = active()
		const request = React.useMemo(() => ({}), [enabled])
		const current = React.useRef<object | null>(request)
		current.current = request
		const [loaded, setLoaded] = React.useState<object | null>(null)
		React.useEffect(
			() => () => {
				current.current = null
			},
			[],
		)
		const ready = enabled && loaded === request
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
					React.createElement(native.Image, {
						source: WALLPAPER_SOURCE,
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
	}: {
		original: unknown
		kind: 'header' | 'scrim'
	}) {
		React.useSyncExternalStore(
			access.subscribe,
			access.getSnapshot,
			access.getSnapshot,
		)
		return active()
			? recolorChrome(React, original, kind, access.getSettings())
			: original
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
