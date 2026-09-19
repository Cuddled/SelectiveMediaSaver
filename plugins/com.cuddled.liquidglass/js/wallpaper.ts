import {
	chatWallpaperLayersFor,
	isChatWallpaperEnabled,
	isWallpaperBackground,
	MIDNIGHT_WAVES_URL,
	wallpaperLayersFor,
} from './core'
import type * as ReactTypes from 'react'
import type { LiquidGlassSettings } from './types'

type Element = ReactTypes.ReactElement<Record<string, any>>
type ReactApi = typeof ReactTypes

/** Match the native chat viewport, not unrelated previews or arbitrary Views. */
export function isNativeChat(
	React: ReactApi,
	original: unknown,
	nativeChatType: unknown,
): original is Element {
	return (
		!!nativeChatType &&
		React.isValidElement<Record<string, any>>(original) &&
		original.type === nativeChatType &&
		typeof original.props.channelId === 'string' &&
		/^\d{17,20}$/.test(original.props.channelId) &&
		original.props.inverted === true
	)
}

export const WALLPAPER_SOURCE = {
	uri: MIDNIGHT_WAVES_URL,
	cache: 'force-cache' as const,
}
export const ABSOLUTE_FILL = {
	position: 'absolute' as const,
	top: 0,
	right: 0,
	bottom: 0,
	left: 0,
}

/** Only the inspected Discord 347 MainTabs structure is eligible for injection. */
export function getMainTabsParts(React: ReactApi, original: unknown) {
	if (!React.isValidElement<Record<string, any>>(original)) return undefined
	const provider = original.props.children
	if (
		!React.isValidElement<Record<string, any>>(provider) ||
		!Object.hasOwn(provider.props, 'gradient')
	)
		return undefined
	const children = provider.props.children
	if (!Array.isArray(children) || children.length !== 2) return undefined
	const [gradient, navigator] = children
	if (
		!React.isValidElement<Record<string, any>>(gradient) ||
		gradient.props.absolute !== true ||
		!Object.hasOwn(gradient.props, 'mix') ||
		!React.isValidElement(navigator)
	)
		return undefined
	return { root: original, provider, gradient, navigator }
}

interface WallpaperRuntimeAccess {
	subscribe(listener: () => void): () => void
	getSnapshot(): string
	getSettings(): LiquidGlassSettings
	isActive(): boolean
}

/** Each MainTabs instance owns its image state; unrelated gradients stay intact. */
export function createMainTabsWallpaper(
	React: ReactApi,
	native: { View: any; Image: any },
	access: WallpaperRuntimeAccess,
) {
	const VisibleContext = React.createContext(false)
	let alive = true
	const { View, Image } = native

	function WallpaperBoundary({
		original,
		scope = 'app',
	}: {
		original: Element
		scope?: 'app' | 'chat'
	}) {
		React.useSyncExternalStore(
			access.subscribe,
			access.getSnapshot,
			access.getSnapshot,
		)
		const settings = access.getSettings()
		const active =
			alive &&
			access.isActive() &&
			(scope === 'chat'
				? isChatWallpaperEnabled(settings)
				: isWallpaperBackground(settings))
		const channelId = scope === 'chat' ? original.props.channelId : undefined
		// Changing mode invalidates callbacks from the previous image request.
		const request = React.useMemo(() => ({}), [active, channelId])
		const currentRequest = React.useRef<object | null>(request)
		currentRequest.current = request
		const [load, setLoad] = React.useState<{
			request: object
			ready: boolean
		} | null>(null)
		React.useEffect(
			() => () => {
				currentRequest.current = null
			},
			[],
		)
		const setReady = (ready: boolean) => {
			if (
				!alive ||
				!access.isActive() ||
				!active ||
				currentRequest.current !== request
			)
				return
			setLoad(previous =>
				previous?.request === request && previous.ready === ready
					? previous
					: { request, ready },
			)
		}
		const ready = active && load?.request === request && load.ready
		const parts = getMainTabsParts(React, original)
		if ((scope === 'app' && !parts) || !View || !Image) return original
		const layers =
			scope === 'chat'
				? chatWallpaperLayersFor(settings)
				: wallpaperLayersFor(settings)
		const wallpaper = active
			? React.createElement(
					View,
					{
						key: 'liquid-glass-wallpaper',
						style: ABSOLUTE_FILL,
						pointerEvents: 'none',
						accessible: false,
						accessibilityElementsHidden: true,
						importantForAccessibility: 'no-hide-descendants',
					},
					React.createElement(Image, {
						key: channelId ?? 'app',
						source: WALLPAPER_SOURCE,
						resizeMode: 'cover',
						blurRadius: layers.blurRadius,
						style: [ABSOLUTE_FILL, { opacity: ready ? layers.opacity : 0 }],
						onLoadStart: () => setReady(false),
						onLoad: () => setReady(true),
						onError: () => setReady(false),
					}),
					React.createElement(View, {
						style: [
							ABSOLUTE_FILL,
							{ backgroundColor: layers.tintColor, opacity: ready ? 1 : 0 },
						],
					}),
					React.createElement(View, {
						style: [
							ABSOLUTE_FILL,
							{ backgroundColor: layers.dimColor, opacity: ready ? 1 : 0 },
						],
					}),
				)
			: null
		if (scope === 'chat') {
			// This layer sits inside the existing chat screen, above its opaque
			// parent surfaces. Keep the native ref, children and handlers intact.
			const chat = ready
				? React.cloneElement(original, {
						style: [original.props.style, { backgroundColor: '#00000000' }],
					})
				: original
			return React.createElement(
				View,
				{
					style: [
						{ flex: 1, overflow: 'hidden' },
						ready ? { backgroundColor: settings.panelColor } : undefined,
					],
				},
				wallpaper,
				React.createElement(
					VisibleContext.Provider,
					{ key: 'liquid-glass-chat-scope', value: !!ready },
					chat,
				),
			)
		}
		if (!parts) return original
		// Keep both the native gradient and navigator positions stable when toggling.
		return React.cloneElement(
			parts.root,
			{},
			React.cloneElement(parts.provider, {}, [
				parts.gradient,
				wallpaper,
				React.createElement(
					VisibleContext.Provider,
					{ key: 'liquid-glass-wallpaper-scope', value: !!ready },
					parts.navigator,
				),
			]),
		)
	}

	class WallpaperErrorBoundary extends React.Component<
		{ original: Element; children?: ReactTypes.ReactNode },
		{ failed: boolean }
	> {
		state = { failed: false }
		static getDerivedStateFromError() {
			return { failed: true }
		}
		componentDidCatch(error: unknown) {
			console.warn(
				'[LiquidGlass] wallpaper unavailable; keeping gradient:',
				error,
			)
		}
		render() {
			return this.state.failed ? this.props.original : this.props.children
		}
	}

	return {
		wrapChat(original: unknown, nativeChatType: unknown) {
			if (
				!alive ||
				!Image ||
				!View ||
				!isNativeChat(React, original, nativeChatType)
			)
				return original
			return React.createElement(
				WallpaperErrorBoundary,
				{ original },
				React.createElement(WallpaperBoundary, { original, scope: 'chat' }),
			)
		},
		wrap(original: unknown) {
			if (!alive || !Image || !View || !getMainTabsParts(React, original))
				return original
			return React.createElement(
				WallpaperErrorBoundary,
				{ original: original as Element },
				React.createElement(WallpaperBoundary, {
					original: original as Element,
				}),
			)
		},
		useVisible: () => React.useContext(VisibleContext),
		dispose() {
			alive = false
		},
	}
}
