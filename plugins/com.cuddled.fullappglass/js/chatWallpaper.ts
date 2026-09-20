import { hexWithAlpha } from '../../com.cuddled.liquidglass/js/core'
import {
	ABSOLUTE_FILL,
	isNativeChat,
	WALLPAPER_SOURCE,
} from '../../com.cuddled.liquidglass/js/wallpaper'
import type * as ReactTypes from 'react'
import type { Access } from './surfaces'

type Element = ReactTypes.ReactElement<Record<string, any>>
/** Per-viewport requests prevent navigation from revealing a previous DM's photo. */
export function createChatWallpaper(
	React: typeof ReactTypes,
	native: { View: any; Image: any },
	access: Access,
) {
	let alive = true
	const Visible = React.createContext(false)
	function Chat({ original }: { original: Element }) {
		React.useSyncExternalStore(
			access.subscribe,
			access.getSnapshot,
			access.getSnapshot,
		)
		const settings = access.getSettings()
		const enabled =
			alive && access.isActive() && settings.enabled && settings.chats
		const channelId = original.props.channelId
		const uri = access.getWallpaper?.(channelId) ?? WALLPAPER_SOURCE.uri
		const request = React.useMemo(() => ({}), [enabled, channelId, uri])
		const latest = React.useRef<object | null>(request)
		latest.current = request
		const [loaded, setLoaded] = React.useState<object | null>(null)
		React.useEffect(
			() => () => {
				latest.current = null
			},
			[],
		)
		const ready = enabled && loaded === request
		const mark = (ok: boolean) => {
			if (alive && access.isActive() && enabled && latest.current === request)
				setLoaded(ok ? request : null)
		}
		return React.createElement(
			native.View,
			{
				style: [
					{ flex: 1, overflow: 'hidden' },
					ready ? { backgroundColor: '#0B0D17' } : undefined,
				],
			},
			enabled
				? React.createElement(
						native.View,
						{
							key: 'chat-wallpaper',
							pointerEvents: 'none',
							accessible: false,
							importantForAccessibility: 'no-hide-descendants',
							style: ABSOLUTE_FILL,
						},
						React.createElement(native.Image, {
							key: `${channelId}:${uri}`,
							source: { uri },
							resizeMode: 'cover',
							blurRadius: settings.lowPower ? 0 : settings.blur,
							onLoadStart: () => mark(false),
							onLoad: () => mark(true),
							onError: () => mark(false),
							style: [ABSOLUTE_FILL, { opacity: ready ? 1 : 0 }],
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
				: null,
			React.createElement(
				Visible.Provider,
				{ key: 'chat-content', value: ready },
				ready
					? React.cloneElement(original, {
							style: [original.props.style, { backgroundColor: '#00000000' }],
						})
					: original,
			),
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
			console.warn('[FullAppGlass] Chat wallpaper unavailable:', error)
		}
		render() {
			return this.state.failed ? this.props.original : this.props.children
		}
	}
	return {
		wrapChat(original: unknown, type: unknown) {
			return alive &&
				native.View &&
				native.Image &&
				isNativeChat(React, original, type)
				? React.createElement(
						Guard,
						{ original },
						React.createElement(Chat, { original }),
					)
				: original
		},
		useVisible: () => React.useContext(Visible),
		dispose() {
			alive = false
		},
	}
}
