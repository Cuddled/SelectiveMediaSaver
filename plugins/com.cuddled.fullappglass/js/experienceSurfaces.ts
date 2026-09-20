import { hexWithAlpha } from '../../com.cuddled.liquidglass/js/core'
import { ABSOLUTE_FILL } from '../../com.cuddled.liquidglass/js/wallpaper'
import { atPath } from './studioSurfaces'
import type * as ReactTypes from 'react'
import type { Settings } from './core'
import type { Access } from './surfaces'

type ReactApi = typeof ReactTypes
type Element = ReactTypes.ReactElement<Record<string, any>>
export type ExperienceKind =
	| 'call-card'
	| 'call-avatar'
	| 'call-speaking'
	| 'call-ring'
	| 'call-legacy'
	| 'call-button'
	| 'search-bar'
	| 'search-row'
	| 'search-card'
	| 'search-section'
	| 'search-screen'
const element = (React: ReactApi, value: unknown): value is Element =>
	React.isValidElement(value)

export function voiceButtonStyles(settings: Settings, original: any) {
	if (
		!settings.enabled ||
		!settings.controls ||
		!settings.studio.calls ||
		!original?.iconBg ||
		!original.iconBgSelected ||
		!original.iconFillSelected
	)
		return original
	return {
		...original,
		iconBg: [
			original.iconBg,
			{
				backgroundColor: hexWithAlpha(settings.panelColor, 0.86),
				borderColor: hexWithAlpha(settings.accentColor, 0.28),
				borderWidth: 1,
			},
		],
		iconBgSelected: [
			original.iconBgSelected,
			{ backgroundColor: settings.accentColor },
		],
		iconFillSelected: [original.iconFillSelected, { color: '#080A12' }],
	}
}

/** Search rows keep their exact padding, height, refs, handlers, text and spoiler children. */
export function searchSurface(
	React: ReactApi,
	original: unknown,
	kind: ExperienceKind,
	settings: Settings,
) {
	if (
		!settings.enabled ||
		!settings.mainScreens ||
		!settings.studio.search ||
		!element(React, original)
	)
		return original
	const border = hexWithAlpha(settings.accentColor, 0.32)
	const backing = hexWithAlpha(settings.panelColor, 0.93)
	const style = (value: Element, changes: Record<string, any>) =>
		React.cloneElement(value, { style: [value.props.style, changes] })
	if (kind === 'search-bar') {
		if (
			!Array.isArray(original.props.tags) ||
			typeof original.props.onChangeText !== 'function' ||
			typeof original.props.onSubmitEditing !== 'function'
		)
			return original
		return style(original, {
			borderRadius: 18,
			backgroundColor: backing,
			borderColor: border,
			borderWidth: 1,
		})
	}
	if (kind === 'search-row') {
		if (
			typeof original.props.onPress !== 'function' ||
			!original.props.accessibilityRole ||
			!Array.isArray(original.props.children)
		)
			return original
		return React.cloneElement(original, {
			style: [
				original.props.style,
				{
					borderRadius: 16,
					backgroundColor: hexWithAlpha(settings.panelColor, 0.6),
				},
			],
			underlayColor: hexWithAlpha(settings.accentColor, 0.18),
		})
	}
	if (kind === 'search-card') {
		if (
			original.props.shadow !== 'low' ||
			original.props.border !== 'subtle' ||
			typeof original.props.onPress !== 'function'
		)
			return original
		return style(original, {
			borderRadius: 20,
			backgroundColor: backing,
			borderColor: border,
		})
	}
	if (kind === 'search-section') {
		const children = original.props.children
		if (
			!Array.isArray(children) ||
			children.length !== 2 ||
			!element(React, children[0]) ||
			children[0].props.accessibilityRole !== 'header'
		)
			return original
		return React.cloneElement(original, {}, [
			React.cloneElement(children[0], {
				style: [
					children[0].props.style,
					{ color: settings.accentColor, letterSpacing: 0.35 },
				],
			}),
			children[1],
		])
	}
	if (kind === 'search-screen')
		return original.type === React.Fragment
			? atPath(React, original, [1], gesture =>
					Object.hasOwn(gesture.props, 'gesture')
						? atPath(React, gesture, ['child'], view =>
								Array.isArray(view.props.children) &&
								view.props.children.length === 2
									? style(view, { backgroundColor: backing })
									: view,
							)
						: gesture,
				)
			: original
	return original
}

export function createExperienceSurfaces(
	React: ReactApi,
	native: Record<string, any>,
	access: Access,
) {
	let alive = true
	const wrappers = new WeakMap<
		object,
		Map<string, ReactTypes.ComponentType<any>>
	>()
	const settings = () =>
		alive && access.isActive()
			? access.getSettings()
			: { ...access.getSettings(), enabled: false }
	function inner(original: unknown, kind: ExperienceKind) {
		if (!element(React, original)) return original
		const type = original.type as any
		const renderer =
			typeof type === 'function'
				? type
				: type?.$$typeof === Symbol.for('react.memo') &&
						typeof type.type === 'function'
					? type.type
					: undefined
		if (!renderer || renderer.prototype?.isReactComponent) return original
		let cache = wrappers.get(type)
		if (!cache) {
			cache = new Map()
			wrappers.set(type, cache)
		}
		let Wrapper = cache.get(kind)
		if (!Wrapper) {
			const Render = (props: any) =>
				React.createElement(Surface, { original: renderer(props), kind, props })
			Wrapper =
				typeof type === 'function' ? Render : React.memo(Render, type.compare)
			cache.set(kind, Wrapper)
		}
		return React.createElement(Wrapper, {
			...original.props,
			key: original.key,
		})
	}
	function Surface({
		original,
		kind,
		props,
	}: {
		original: unknown
		kind: ExperienceKind
		props?: Record<string, any>
	}): any {
		React.useSyncExternalStore(
			access.subscribe,
			access.getSnapshot,
			access.getSnapshot,
		)
		const value = settings()
		if (kind.startsWith('search-'))
			return searchSurface(React, original, kind, value)
		if (!element(React, original)) return original
		// Stable wrappers even when disabled: toggling does not remount a call or reset gestures.
		if (kind === 'call-card') {
			if (
				!Object.hasOwn(original.props, 'coords') ||
				!Object.hasOwn(original.props, 'transitionState') ||
				!Array.isArray(original.props.children) ||
				original.props.children.length !== 3
			)
				return original
			let result = atPath(React, original, [0], child =>
				Object.hasOwn(child.props, 'avatarURI') &&
				Object.hasOwn(child.props, 'layoutPhysics')
					? inner(child, 'call-avatar')
					: child,
			)
			result = atPath(React, result, [2], child =>
				Object.hasOwn(child.props, 'speaking') &&
				Object.hasOwn(child.props, 'isSelf')
					? inner(child, 'call-speaking')
					: child,
			)
			return result
		}
		if (kind === 'call-speaking')
			return Object.hasOwn(original.props, 'speaking') &&
				Object.hasOwn(original.props, 'isSelf')
				? inner(original, 'call-ring')
				: original
		if (!value.enabled || !value.studio.calls) return original
		const accent = value.accentColor
		if (kind === 'call-ring') {
			const children = original.props.children
			if (
				original.props.pointerEvents !== 'none' ||
				!Array.isArray(children) ||
				children.length !== 2 ||
				!children.every(
					child =>
						element(React, child) &&
						Object.hasOwn(child.props, 'layout') &&
						Object.hasOwn(child.props, 'style'),
				)
			)
				return original
			// Keep native shared values, animated border widths, focus/PIP rules and timing.
			return React.cloneElement(original, {}, [
				React.cloneElement(children[0], {
					style: [
						children[0].props.style,
						{ borderColor: hexWithAlpha(accent, 0.2) },
					],
				}),
				React.cloneElement(children[1], {
					style: [children[1].props.style, { borderColor: accent }],
				}),
			])
		}
		if (kind === 'call-avatar') {
			if (
				!Object.hasOwn(original.props, 'layout') ||
				!Array.isArray(original.props.children) ||
				original.props.children.length !== 2
			)
				return original
			const [gradient, avatar] = original.props.children
			const colors = [hexWithAlpha(accent, 0.18), value.panelColor]
			const backdrop =
				gradient == null
					? React.createElement(
							native.View,
							{
								pointerEvents: 'none',
								accessible: false,
								importantForAccessibility: 'no-hide-descendants',
								style: [ABSOLUTE_FILL, { backgroundColor: value.panelColor }],
							},
							React.createElement(native.View, {
								style: [
									ABSOLUTE_FILL,
									{ backgroundColor: hexWithAlpha(accent, 0.08) },
								],
							}),
						)
					: element(React, gradient) && Array.isArray(gradient.props.colors)
						? React.cloneElement(gradient, { colors })
						: gradient
			return React.cloneElement(
				original,
				{
					style: [original.props.style, { backgroundColor: value.panelColor }],
				},
				[backdrop, avatar],
			)
		}
		if (kind === 'call-legacy') {
			if (
				typeof props?.speaking !== 'boolean' ||
				!Object.hasOwn(original.props, 'style') ||
				!Array.isArray(original.props.children) ||
				original.props.children.length !== 2
			)
				return original
			return React.cloneElement(
				original,
				{
					style: [original.props.style, { backgroundColor: value.panelColor }],
					...(Array.isArray(original.props.colors)
						? { colors: [hexWithAlpha(accent, 0.18), value.panelColor] }
						: {}),
				},
				original.props.children.map((child: any, index: number) =>
					index === 0 &&
					element(React, child) &&
					typeof child.props.speaking === 'boolean'
						? React.cloneElement(child, {
								avatarStyle: [
									child.props.avatarStyle,
									props.speaking
										? { borderColor: accent, borderWidth: 2 }
										: undefined,
								],
							})
						: child,
				),
			)
		}
		if (kind === 'call-button') {
			if (
				!value.controls ||
				props?.isActive ||
				props?.disableTint ||
				props?.backgroundColor ||
				!Object.hasOwn(original.props, 'imageStyle') ||
				!original.props.accessibilityState
			)
				return original
			return React.cloneElement(original, {
				backgroundColor: hexWithAlpha(value.panelColor, 0.92),
				imageStyle: [original.props.imageStyle, { tintColor: '#F7F8FF' }],
			})
		}
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
			console.warn('[FullAppGlass] Call/search styling unavailable:', error)
		}
		render() {
			return this.state.failed
				? (this.props.original as ReactTypes.ReactNode)
				: this.props.children
		}
	}
	return {
		wrap(kind: ExperienceKind, original: unknown, props?: Record<string, any>) {
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
