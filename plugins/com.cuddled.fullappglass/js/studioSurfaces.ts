import { hexWithAlpha } from '../../com.cuddled.liquidglass/js/core'
import { ABSOLUTE_FILL } from '../../com.cuddled.liquidglass/js/wallpaper'
import icons from './lineIcons'
import { interfaceFont } from './studioModel'
import type * as ReactTypes from 'react'
import type { Settings } from './core'
import type { Access } from './surfaces'

type ReactApi = typeof ReactTypes
type Element = ReactTypes.ReactElement<Record<string, any>>
export type StudioKind =
	| 'notification'
	| 'notification-content'
	| 'rail'
	| 'rail-item'
	| 'empty-common'
	| 'empty-modern'
	| 'empty-messages'
	| 'empty-channels'
	| 'text'
	| 'gift'
	| 'apps'
	| 'home'
	| 'media-gallery'
	| 'media-post'
const element = (React: ReactApi, value: unknown): value is Element =>
	React.isValidElement<Record<string, any>>(value)
export const LINE_ICONS = Object.keys(icons) as Array<keyof typeof icons>

/** Clone one audited child path; unknown trees are deliberately left unchanged. */
export function atPath(
	React: ReactApi,
	original: unknown,
	path: Array<number | 'child'>,
	transform: (value: Element) => unknown,
): unknown {
	if (!element(React, original)) return original
	if (!path.length) return transform(original)
	const [first, ...rest] = path
	const children = original.props.children
	if (first === 'child') {
		if (!element(React, children)) return original
		const next = atPath(React, children, rest, transform)
		return next === children
			? original
			: React.cloneElement(original, {}, next as ReactTypes.ReactNode)
	}
	if (!Array.isArray(children) || first >= children.length) return original
	const child = children[first]
	const next = atPath(React, child, rest, transform)
	if (next === child) return original
	const changed = [...children]
	changed[first] = next
	return React.cloneElement(original, {}, changed)
}
export function styleNotification(
	React: ReactApi,
	original: unknown,
	settings: Settings,
) {
	if (
		!settings.enabled ||
		!settings.menus ||
		!settings.studio.notifications ||
		!element(React, original)
	)
		return original
	const pressable = original.props.children
	if (
		!element(React, pressable) ||
		pressable.props.accessibilityRole !== 'button' ||
		typeof pressable.props.onPress !== 'function' ||
		!Array.isArray(pressable.props.children)
	)
		return original
	return React.cloneElement(
		original,
		{
			style: [
				original.props.style,
				{
					backgroundColor: '#111522',
					borderRadius: 20,
					borderWidth: 1,
					borderColor: hexWithAlpha(settings.accentColor, 0.55),
				},
			],
		},
		React.cloneElement(pressable, {
			style: [pressable.props.style, { borderRadius: 20 }],
		}),
	)
}
export function styleRail(
	React: ReactApi,
	View: any,
	original: unknown,
	settings: Settings,
) {
	const enabled =
		settings.enabled && settings.mainScreens && settings.studio.floatingRail
	return atPath(React, original, ['child', 'child'], rail => {
		if (
			rail.props.nativeID !== 'guilds-bar-view' ||
			!Array.isArray(rail.props.children) ||
			!rail.props.children.some(
				(child: unknown) =>
					element(React, child) &&
					child.props.nativeID === 'guilds-bar-fast-list',
			)
		)
			return rail
		return React.cloneElement(rail, {}, [
			enabled
				? React.createElement(View, {
						key: 'glass-rail-backdrop',
						pointerEvents: 'none',
						accessible: false,
						importantForAccessibility: 'no-hide-descendants',
						style: {
							...ABSOLUTE_FILL,
							top: 6,
							bottom: 6,
							left: 3,
							right: 3,
							borderRadius: 22,
							borderWidth: 1,
							borderColor: hexWithAlpha(
								settings.accentColor,
								settings.accentOpacity * 0.5,
							),
							backgroundColor: '#101523B8',
						},
					})
				: null,
			React.createElement(
				React.Fragment,
				{ key: 'glass-rail-content' },
				rail.props.children,
			),
		])
	})
}
export function mediaTheme(
	settings: Settings,
	original: unknown,
	processColor: (color: string) => unknown,
) {
	if (
		!settings.enabled ||
		!settings.chats ||
		!settings.studio.mediaCards ||
		!original ||
		typeof original !== 'object'
	)
		return original
	const value = original as Record<string, any>
	if (
		!value.baseColors ||
		typeof value.baseColors.thumbnailCornerRadius !== 'number' ||
		!value.colors ||
		typeof value.colors.backgroundColor !== 'number'
	)
		return original
	let backgroundColor: unknown
	let borderColor: unknown
	try {
		backgroundColor = processColor('#141827')
		borderColor = processColor(hexWithAlpha(settings.accentColor, 0.18))
	} catch {
		return original
	}
	if (
		typeof backgroundColor !== 'number' ||
		typeof borderColor !== 'number' ||
		!Number.isFinite(backgroundColor) ||
		!Number.isFinite(borderColor)
	)
		return original
	return {
		...value,
		colors: { ...value.colors, backgroundColor, borderColor },
		baseColors: {
			...value.baseColors,
			backgroundColor,
			borderColor,
			thumbnailCornerRadius: 18,
		},
	}
}
export function createStudioSurfaces(
	React: ReactApi,
	native: Record<string, any>,
	access: Access,
	Home: ReactTypes.ComponentType<any>,
) {
	let alive = true
	type Renderer = (...args: any[]) => any
	const unreadRenderers = new WeakMap<Renderer, Renderer>()
	const unreadComponents = new WeakMap<
		ReactTypes.FunctionComponent<any>,
		ReactTypes.FunctionComponent<any>
	>()
	const useSettings = () => {
		React.useSyncExternalStore(
			access.subscribe,
			access.getSnapshot,
			access.getSnapshot,
		)
		const settings = access.getSettings()
		return alive && access.isActive()
			? settings
			: { ...settings, enabled: false }
	}
	function EmptyImage({ original }: { original: Element }) {
		const settings = useSettings()
		const uri = settings.studio.emptyImage
		const [failed, setFailed] = React.useState<string | null>(null)
		if (!settings.enabled || !settings.mainScreens || !settings.studio.emptyArt)
			return original
		if (uri && failed !== uri)
			return React.cloneElement(original, {
				key: uri,
				source: { uri },
				resizeMode: 'contain',
				onError: (...args: any[]) => {
					setFailed(uri)
					original.props.onError?.(...args)
				},
			})
		// Original artwork stays available if a user-selected image fails to load.
		if (uri) return original
		return React.createElement(
			native.View,
			{
				style: [
					original.props.style,
					{
						minWidth: 150,
						minHeight: 130,
						alignItems: 'center',
						justifyContent: 'center',
					},
				],
				accessible: false,
				pointerEvents: 'none',
				importantForAccessibility: 'no-hide-descendants',
			},
			React.createElement(native.View, {
				style: {
					position: 'absolute',
					width: 132,
					height: 78,
					borderWidth: 1.5,
					borderColor: hexWithAlpha(settings.accentColor, 0.55),
					borderRadius: 70,
					transform: [{ rotate: '-25deg' }],
				},
			}),
			React.createElement(native.View, {
				style: {
					width: 62,
					height: 62,
					borderRadius: 31,
					backgroundColor: hexWithAlpha(settings.accentColor, 0.12),
					borderWidth: 1.5,
					borderColor: settings.accentColor,
				},
			}),
			React.createElement(native.View, {
				style: {
					position: 'absolute',
					width: 10,
					height: 10,
					borderRadius: 5,
					backgroundColor: '#DCEAFF',
					transform: [{ translateX: 52 }, { translateY: -29 }],
				},
			}),
		)
	}
	function Unread({ original }: { original: Element }) {
		const settings = useSettings()
		return settings.enabled &&
			settings.mainScreens &&
			settings.studio.floatingRail &&
			original.props.pointerEvents === 'none' &&
			Object.hasOwn(original.props, 'style')
			? React.cloneElement(original, {
					style: [
						original.props.style,
						{
							width: 5,
							borderRadius: 3,
							backgroundColor: settings.accentColor,
						},
					],
				})
			: original
	}
	function wrapUnread(renderer: Renderer) {
		let cached = unreadRenderers.get(renderer)
		if (!cached) {
			cached = function (this: any, ...args: any[]) {
				const original = Reflect.apply(renderer, this, args)
				if (
					!element(React, original) ||
					typeof original.type !== 'function' ||
					original.type.prototype?.isReactComponent ||
					typeof original.props.selected !== 'boolean'
				)
					return original
				const Component = original.type as ReactTypes.FunctionComponent<any>
				let Wrapper = unreadComponents.get(Component)
				if (!Wrapper) {
					Wrapper = props =>
						React.createElement(Unread, {
							original: Component(props) as Element,
						})
					unreadComponents.set(Component, Wrapper)
				}
				return React.createElement(Wrapper, {
					...original.props,
					key: original.key,
				})
			}
			unreadRenderers.set(renderer, cached)
		}
		return cached
	}
	function Surface({
		original,
		kind,
		props,
	}: {
		original: unknown
		kind: StudioKind | keyof typeof icons
		props?: Record<string, any>
	}) {
		const settings = useSettings()
		if (!element(React, original)) return original as ReactTypes.ReactNode
		if (kind === 'media-gallery') {
			if (
				!settings.enabled ||
				!settings.mainScreens ||
				!settings.studio.mediaCards
			)
				return original
			return atPath(React, original, ['child'], pressable =>
				pressable.props.accessibilityRole === 'button' &&
				typeof pressable.props.onPress === 'function' &&
				Array.isArray(pressable.props.children) &&
				pressable.props.children.length === 5
					? React.cloneElement(pressable, {
							style: [
								pressable.props.style,
								{ borderRadius: 16, overflow: 'hidden' },
							],
						})
					: pressable,
			) as ReactTypes.ReactNode
		}
		if (kind === 'media-post')
			return settings.enabled &&
				settings.mainScreens &&
				settings.studio.mediaCards &&
				Object.hasOwn(original.props, 'androidStyle') &&
				typeof original.props.shouldSpoiler === 'boolean'
				? React.cloneElement(original, {
						androidStyle: [
							original.props.androidStyle,
							{ borderRadius: 16, overflow: 'hidden' },
						],
					})
				: original
		if (kind === 'gift' || kind === 'apps')
			return settings.enabled &&
				settings.chats &&
				settings.controls &&
				(kind === 'gift'
					? settings.studio.hideGift
					: settings.studio.hideApps && !props?.active)
				? null
				: original
		if (kind === 'notification')
			return styleNotification(
				React,
				original,
				settings,
			) as ReactTypes.ReactNode
		if (kind === 'notification-content')
			return settings.enabled &&
				settings.menus &&
				settings.studio.notifications &&
				Array.isArray(original.props.children) &&
				original.props.children.length === 3
				? React.cloneElement(original, {
						style: [
							original.props.style,
							{ paddingVertical: 10, paddingHorizontal: 12 },
						],
					})
				: original
		if (kind === 'rail')
			return styleRail(
				React,
				native.View,
				original,
				settings,
			) as ReactTypes.ReactNode
		if (kind === 'home')
			return atPath(React, original, [0], heading => {
				if (
					!element(React, heading.props.children) ||
					heading.props.children.props.accessibilityRole !== 'header' ||
					!settings.enabled ||
					!settings.mainScreens ||
					!settings.studio.dashboard
				)
					return heading
				return React.cloneElement(heading, {}, [
					React.cloneElement(heading.props.children, { key: 'original-title' }),
					React.createElement(Home, { key: 'glass-home', compact: true }),
				])
			}) as ReactTypes.ReactNode
		if (kind === 'rail-item')
			return atPath(React, original, [0, 1, 'child'], transition =>
				typeof transition.props.renderItem === 'function'
					? React.cloneElement(transition, {
							renderItem: wrapUnread(transition.props.renderItem),
						})
					: transition,
			) as ReactTypes.ReactNode
		if (kind.startsWith('empty-')) {
			const paths: Record<string, Array<number | 'child'>> = {
				'empty-common': ['child', 0],
				'empty-modern': [0],
				'empty-messages': ['child', 0, 0, 'child'],
				'empty-channels': [1, 0],
			}
			return atPath(React, original, paths[kind], image =>
				image.type === native.Image && Object.hasOwn(image.props, 'source')
					? React.createElement(EmptyImage, { key: image.key, original: image })
					: image,
			) as ReactTypes.ReactNode
		}
		if (!settings.enabled || !settings.mainScreens || !settings.controls)
			return original
		if (kind === 'text') {
			if (
				String(props?.variant).startsWith('code') ||
				(settings.studio.font === 'discord' &&
					settings.studio.letterSpacing === 0)
			)
				return original
			const fontFamily = interfaceFont(settings.studio.font)
			const overrides = {
				...(fontFamily ? { fontFamily } : {}),
				...(settings.studio.letterSpacing
					? { letterSpacing: settings.studio.letterSpacing }
					: {}),
			}
			// PlainText's optimized renderer uses explicit font props; other text uses styles.
			return React.cloneElement(original, {
				...(typeof original.props.text === 'string' &&
				typeof original.props.fontSize === 'number'
					? {
							...overrides,
							...(settings.studio.letterSpacing
								? { hasLetterSpacing: true }
								: {}),
						}
					: {}),
				style: [original.props.style, overrides],
			})
		}
		if (
			settings.studio.lineIcons &&
			Object.hasOwn(icons, kind) &&
			Object.hasOwn(original.props, 'source')
		)
			return React.cloneElement(original, {
				source: {
					uri: icons[kind as keyof typeof icons],
					width: 24,
					height: 24,
					scale: 4,
				},
			})
		return original
	}
	class Guard extends React.Component<
		{ original: unknown; children?: ReactTypes.ReactNode },
		{ failed: boolean }
	> {
		state = { failed: false }
		static getDerivedStateFromError() {
			return { failed: true }
		}
		componentDidCatch(error: unknown) {
			console.warn('[FullAppGlass] Optional detail unavailable:', error)
		}
		render() {
			return this.state.failed
				? (this.props.original as ReactTypes.ReactNode)
				: this.props.children
		}
	}
	return {
		wrap(
			kind: StudioKind | keyof typeof icons,
			original: unknown,
			props?: Record<string, any>,
		) {
			return alive && element(React, original)
				? React.createElement(
						Guard,
						{ original },
						React.createElement(Surface, { original, kind, props }),
					)
				: original
		},
		dispose() {
			alive = false
		},
	}
}
