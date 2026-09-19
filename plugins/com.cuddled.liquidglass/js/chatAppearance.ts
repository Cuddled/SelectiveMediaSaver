import {
	hexWithAlpha,
	isChatWallpaperEnabled,
	normalizeHexColor,
	readableChatForeground,
} from './core'
import type * as ReactTypes from 'react'
import type { HexColor, LiquidGlassSettings } from './types'

type ReactApi = typeof ReactTypes

export function chatAppearanceEnabled(settings: LiquidGlassSettings): boolean {
	return isChatWallpaperEnabled(settings) && settings.semanticEnabled
}

/** Keep the chosen hue, but do not let a pale preset create gray chat bars. */
export function chatAppearanceColors(settings: LiquidGlassSettings) {
	const channels = normalizeHexColor(settings.panelColor)
		.slice(1)
		.match(/../g)!
		.map(value => Number.parseInt(value, 16))
	const scale = Math.min(1, 48 / Math.max(1, ...channels))
	const panel = `#${channels
		.map(value =>
			Math.round(value * scale)
				.toString(16)
				.padStart(2, '0'),
		)
		.join('')}`.toUpperCase() as HexColor
	const foreground = readableChatForeground(settings.textColor)
	return {
		panel,
		surface: hexWithAlpha(panel, 0.72 + settings.panelOpacity * 0.2),
		transparent: hexWithAlpha(panel, 0),
		foreground,
		muted: hexWithAlpha(foreground, 0.88),
	}
}

/** Native message colors are cached separately from React's semantic styles. */
export function applyNativeChatColors(
	settings: LiquidGlassSettings,
	result: unknown,
	processColor: (value: string) => unknown,
): unknown {
	if (
		!chatAppearanceEnabled(settings) ||
		!result ||
		typeof result !== 'object' ||
		Array.isArray(result)
	)
		return result
	const colors = result as Record<string, unknown>
	if (
		typeof colors.defaultUsernameColor !== 'number' ||
		typeof colors.textColor !== 'number'
	)
		return result
	const palette = chatAppearanceColors(settings)
	let strong: unknown
	let muted: unknown
	try {
		strong = processColor(palette.foreground)
		muted = processColor(palette.muted)
	} catch {
		return result
	}
	if (
		typeof strong !== 'number' ||
		!Number.isFinite(strong) ||
		typeof muted !== 'number' ||
		!Number.isFinite(muted)
	)
		return result
	const updated: Record<string, unknown> = {
		...colors,
		defaultUsernameColor: strong,
		textColor: strong,
	}
	for (const key of ['timestampColor', 'editedColor', 'unsupportedColor']) {
		if (typeof colors[key] === 'number') updated[key] = muted
	}
	// Role/name-style colors are applied later by Discord and are not overwritten.
	return updated
}

export function applyChatGapStyle(
	settings: LiquidGlassSettings,
	result: unknown,
): unknown {
	if (
		!chatAppearanceEnabled(settings) ||
		!result ||
		typeof result !== 'object' ||
		Array.isArray(result) ||
		!Object.hasOwn(result, 'backgroundColor')
	)
		return result
	return { ...result, backgroundColor: chatAppearanceColors(settings).surface }
}

/** Preserve the header frame, controls, refs, and all navigation/layout props. */
export function recolorChatHeader(
	React: ReactApi,
	result: unknown,
	settings: LiquidGlassSettings,
): unknown {
	if (
		!chatAppearanceEnabled(settings) ||
		!React.isValidElement<Record<string, any>>(result) ||
		result.type !== React.Fragment
	)
		return result
	const children = result.props.children
	if (
		!Array.isArray(children) ||
		children.length !== 2 ||
		!React.isValidElement<Record<string, any>>(children[0]) ||
		!Object.hasOwn(children[0].props, 'style')
	)
		return result
	return React.cloneElement(result, {}, [
		React.cloneElement(children[0], {
			style: [
				children[0].props.style,
				{ backgroundColor: chatAppearanceColors(settings).surface },
			],
		}),
		children[1],
	])
}

/** Override the scrim's final colors, after Discord forces its end-stop opaque. */
export function recolorChatScrim(
	React: ReactApi,
	result: unknown,
	settings: LiquidGlassSettings,
): unknown {
	if (
		!chatAppearanceEnabled(settings) ||
		!React.isValidElement<Record<string, any>>(result) ||
		result.props.pointerEvents !== 'none'
	)
		return result
	const children = result.props.children
	if (!Array.isArray(children) || children.length !== 2) return result
	const [gradient, fill] = children
	if (
		!React.isValidElement<Record<string, any>>(gradient) ||
		!Array.isArray(gradient.props.colors) ||
		gradient.props.colors.length !== 2 ||
		!React.isValidElement<Record<string, any>>(fill) ||
		!Object.hasOwn(fill.props, 'style')
	)
		return result
	const colors = chatAppearanceColors(settings)
	return React.cloneElement(result, {}, [
		React.cloneElement(gradient, {
			colors: [colors.transparent, colors.surface],
		}),
		React.cloneElement(fill, {
			style: [fill.props.style, { backgroundColor: colors.surface }],
		}),
	])
}

interface RuntimeAccess {
	subscribe(listener: () => void): () => void
	getSnapshot(): string
	getSettings(): LiquidGlassSettings
	isActive(): boolean
}

/** Only used at the inspected Android chat/header module boundaries. */
export function createChatAppearanceRuntime(
	React: ReactApi,
	access: RuntimeAccess,
) {
	let alive = true
	const headers = new WeakMap<
		ReactTypes.FunctionComponent<any>,
		ReactTypes.FunctionComponent<any>
	>()
	function AppearanceBoundary({
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
		if (!alive || !access.isActive()) return original
		return kind === 'header'
			? recolorChatHeader(React, original, access.getSettings())
			: recolorChatScrim(React, original, access.getSettings())
	}
	const wrap = (original: unknown, kind: 'header' | 'scrim') =>
		React.createElement(AppearanceBoundary as any, { original, kind })
	return {
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
			let PatchedHeader = headers.get(Header)
			if (!PatchedHeader) {
				// The original function keeps its hook order; the subscriber lives in
				// a separate component, never conditionally added to Discord's hooks.
				PatchedHeader = props => wrap(Header(props), 'header')
				headers.set(Header, PatchedHeader)
			}
			const nextChildren = [
				React.createElement(PatchedHeader, {
					...header.props,
					key: header.key,
				}),
				children[1],
			]
			return React.cloneElement(
				original,
				{},
				fragment
					? React.cloneElement(fragment, {}, nextChildren)
					: nextChildren,
			)
		},
		wrapScrim(original: unknown) {
			return alive && React.isValidElement(original)
				? wrap(original, 'scrim')
				: original
		},
		dispose() {
			alive = false
		},
	}
}
