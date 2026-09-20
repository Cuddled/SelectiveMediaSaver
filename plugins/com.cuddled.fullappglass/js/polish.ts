import { hexWithAlpha } from '../../com.cuddled.liquidglass/js/core'
import { ABSOLUTE_FILL } from '../../com.cuddled.liquidglass/js/wallpaper'
import type * as ReactTypes from 'react'
import type { Settings } from './core'
import type { Access } from './surfaces'

type ReactApi = typeof ReactTypes
type Element = ReactTypes.ReactElement<Record<string, any>>
export type PolishKind =
	| 'text-channel'
	| 'base-channel'
	| 'sheet'
	| 'row'
	| 'handle'

export function polishEnabled(
	settings: Settings,
	area: 'Channels' | 'Composer' | 'Menus',
) {
	return (
		settings.enabled &&
		settings[`polish${area}`] &&
		(area === 'Menus'
			? settings.menus
			: settings.controls &&
				(area === 'Channels' ? settings.mainScreens : settings.chats))
	)
}

/** Native styles only: semantic token consumers continue receiving audited hex. */
export function polishStyles(settings: Settings) {
	const border = hexWithAlpha(settings.accentColor, settings.accentOpacity)
	return {
		channel: { borderRadius: 14 },
		selected: {
			borderRadius: 14,
			backgroundColor: hexWithAlpha(
				settings.accentColor,
				settings.accentOpacity * 0.28,
			),
		},
		channelOutline: {
			...ABSOLUTE_FILL,
			borderRadius: 14,
			borderWidth: 1,
			borderColor: border,
		},
		composer: {
			...ABSOLUTE_FILL,
			borderRadius: 24,
			backgroundColor: hexWithAlpha('#0B0D17', 0.64),
			borderWidth: 1,
			borderColor: hexWithAlpha(
				settings.accentColor,
				settings.accentOpacity * 0.65,
			),
		},
		sheet: {
			// Opaque backing prevents chat text from showing through the action rows.
			backgroundColor: settings.menuColor,
			borderTopLeftRadius: 24,
			borderTopRightRadius: 24,
			borderWidth: 1,
			borderBottomWidth: 0,
			borderColor: hexWithAlpha(
				settings.accentColor,
				settings.accentOpacity * 0.65,
			),
		},
		row: { backgroundColor: '#00000000', borderRadius: 14 },
		handle: { backgroundColor: border },
	}
}

function element(React: ReactApi, value: unknown): value is Element {
	return React.isValidElement<Record<string, any>>(value)
}

/** Inspected TextChannel memo output: indicator, pressable, selection coachmark. */
export function polishTextChannel(
	React: ReactApi,
	original: unknown,
	settings: Settings,
): unknown {
	if (!polishEnabled(settings, 'Channels') || !element(React, original))
		return original
	const children = original.props.children
	if (!Array.isArray(children) || children.length !== 3) return original
	const pressable = children[1]
	if (
		!element(React, pressable) ||
		pressable.props.accessibilityRole !== 'button' ||
		typeof pressable.props.onPress !== 'function' ||
		typeof pressable.props.accessibilityState?.selected !== 'boolean' ||
		!Array.isArray(pressable.props.children) ||
		pressable.props.children.length !== 2
	)
		return original
	const selected = pressable.props.accessibilityState.selected
	const [outline, row] = pressable.props.children
	if (
		!element(React, row) ||
		!Object.hasOwn(row.props, 'style') ||
		(selected &&
			(!element(React, outline) || !Object.hasOwn(outline.props, 'style')))
	)
		return original
	const styles = polishStyles(settings)
	const next = [...children]
	next[1] = React.cloneElement(
		pressable,
		{
			style: [
				pressable.props.style,
				selected ? styles.selected : styles.channel,
			],
		},
		[
			selected
				? React.cloneElement(outline, {
						style: [outline.props.style, styles.channelOutline],
						pointerEvents: 'none',
						accessible: false,
					})
				: outline,
			row,
		],
	)
	return React.cloneElement(original, {}, next)
}

/** BaseChannelItem covers legacy voice/DM/thread rows without changing measured heights. */
export function polishBaseChannel(
	React: ReactApi,
	View: any,
	original: unknown,
	settings: Settings,
): unknown {
	if (
		!element(React, original) ||
		original.props.accessibilityRole !== 'button' ||
		typeof original.props.onPress !== 'function' ||
		typeof original.props.accessibilityState?.selected !== 'boolean'
	)
		return original
	const children = original.props.children
	if (!Array.isArray(children) || children.length !== 2) return original
	const row = children[0]
	if (
		!element(React, row) ||
		!Object.hasOwn(row.props, 'style') ||
		!Array.isArray(row.props.children) ||
		row.props.children.length !== 4
	)
		return original
	const enabled = polishEnabled(settings, 'Channels')
	const selected = enabled && original.props.accessibilityState.selected
	const styles = polishStyles(settings)
	const decorated = React.cloneElement(
		row,
		{
			style: enabled
				? [row.props.style, selected ? styles.selected : styles.channel]
				: row.props.style,
		},
		[
			selected
				? React.createElement(View, {
						key: 'channel-outline',
						style: styles.channelOutline,
						pointerEvents: 'none',
						accessible: false,
						importantForAccessibility: 'no-hide-descendants',
					})
				: null,
			// Stable content slot across selection/preview changes; no new layout wrapper.
			React.createElement(
				React.Fragment,
				{ key: 'channel-content' },
				row.props.children,
			),
		],
	)
	return React.cloneElement(
		original,
		{
			style: enabled
				? [original.props.style, styles.channel]
				: original.props.style,
		},
		[decorated, children[1]],
	)
}

/** ActionSheet.render returns BottomSheet; style its documented input slots only. */
export function polishSheet(
	React: ReactApi,
	original: unknown,
	settings: Settings,
): unknown {
	if (
		!polishEnabled(settings, 'Menus') ||
		!element(React, original) ||
		original.props.backgroundComponent != null ||
		original.props.borderGradient != null ||
		!Object.hasOwn(original.props, 'contentStyles') ||
		!Object.hasOwn(original.props, 'bodyStyles')
	)
		return original
	return React.cloneElement(original, {
		backgroundStyles: [
			original.props.backgroundStyles,
			polishStyles(settings).sheet,
		],
		// This opts this sheet out of the stock theme gradient over its new backing.
		showGradient: false,
		bodyStyles: settings.compactMenus
			? [original.props.bodyStyles, { gap: 8 }]
			: original.props.bodyStyles,
	})
}

/** Preserve the provider, row actions, danger variants and disabled semantics. */
export function polishRow(
	React: ReactApi,
	original: unknown,
	settings: Settings,
): unknown {
	if (
		!polishEnabled(settings, 'Menus') ||
		!element(React, original) ||
		!['default', 'danger'].includes(original.props.value)
	)
		return original
	const row = original.props.children
	if (
		!element(React, row) ||
		!Object.hasOwn(row.props, 'label') ||
		!['default', 'danger'].includes(row.props.variant)
	)
		return original
	return React.cloneElement(
		original,
		{},
		React.cloneElement(row, {
			style: [row.props.style, polishStyles(settings).row],
			radius: 14,
		}),
	)
}

/** Keep the screen-reader dismiss button and the normal drag target intact. */
export function polishHandle(
	React: ReactApi,
	original: unknown,
	settings: Settings,
): unknown {
	if (!polishEnabled(settings, 'Menus') || !element(React, original))
		return original
	const fragment = original.type === React.Fragment
	const siblings = original.props.children
	if (fragment && (!Array.isArray(siblings) || siblings.length !== 2))
		return original
	const touchable = fragment ? siblings[1] : original
	if (
		!element(React, touchable) ||
		touchable.props['aria-hidden'] !== true ||
		typeof touchable.props.onPress !== 'function'
	)
		return original
	const container = touchable.props.children
	if (!element(React, container) || !Object.hasOwn(container.props, 'style'))
		return original
	const bar = container.props.children
	if (
		!element(React, bar) ||
		!Object.hasOwn(bar.props, 'style') ||
		bar.props.children != null
	)
		return original
	const next = React.cloneElement(
		touchable,
		{},
		React.cloneElement(
			container,
			{},
			React.cloneElement(bar, {
				style: [bar.props.style, polishStyles(settings).handle],
			}),
		),
	)
	return fragment ? React.cloneElement(original, {}, [siblings[0], next]) : next
}

function functionElement(value: Element) {
	return (
		typeof value.type === 'function' &&
		!(value.type as any).prototype?.isReactComponent
	)
}

function customRowSize(style: unknown): boolean {
	if (Array.isArray(style)) return style.some(customRowSize)
	if (!style) return false
	// Registered/animated styles are not safe to inspect or override here.
	if (typeof style !== 'object') return true
	return [
		'height',
		'minHeight',
		'maxHeight',
		'padding',
		'paddingVertical',
		'paddingTop',
		'paddingBottom',
	].some(key => Object.hasOwn(style, key))
}

/** TableRow calls its local TableRowInner, so scope the rendered child instead
 * of patching the export (which misses that lexical call). Never wrap settings rows.
 */
export function scopeMenuCard(
	React: ReactApi,
	original: unknown,
	wrap: (inner: Element) => ReactTypes.ReactNode,
): unknown {
	if (!element(React, original)) return original
	const fragment = original.type === React.Fragment
	const siblings = original.props.children
	if (fragment && (!Array.isArray(siblings) || siblings.length !== 2))
		return original
	const card = fragment ? siblings[0] : original
	if (
		!element(React, card) ||
		card.props.border !== 'none' ||
		card.props.shadow !== 'none' ||
		card.props.variant !== 'muted'
	)
		return original
	const inner = card.props.children
	if (
		!element(React, inner) ||
		!functionElement(inner) ||
		!Object.hasOwn(inner.props, 'label')
	)
		return original
	const next = React.cloneElement(card, {}, wrap(inner))
	return fragment ? React.cloneElement(original, {}, [next, siblings[1]]) : next
}

/** A minimum size keeps touch targets usable while allowing wrapped/large text. */
export function compactMenuBody(
	React: ReactApi,
	original: unknown,
	props: Record<string, any>,
	settings: Settings,
): unknown {
	if (
		!polishEnabled(settings, 'Menus') ||
		!settings.compactMenus ||
		typeof props.label !== 'string' ||
		props.height != null ||
		props.subLabel != null ||
		props.trailing != null ||
		props.draggable ||
		props.dragHandlePressableProps != null ||
		!element(React, original) ||
		!Object.hasOwn(original.props, 'style') ||
		!Array.isArray(original.props.children) ||
		original.props.children.length !== 5
	)
		return original
	return React.cloneElement(original, {
		style: [original.props.style, { minHeight: 52, paddingVertical: 10 }],
	})
}

export function createPolish(React: ReactApi, View: any, access: Access) {
	let alive = true
	const rows = new WeakMap<
		ReactTypes.FunctionComponent<any>,
		ReactTypes.FunctionComponent<any>
	>()
	const inners = new WeakMap<
		ReactTypes.FunctionComponent<any>,
		ReactTypes.FunctionComponent<any>
	>()
	function useSettings() {
		React.useSyncExternalStore(
			access.subscribe,
			access.getSnapshot,
			access.getSnapshot,
		)
		return alive && access.isActive()
			? access.getSettings()
			: { ...access.getSettings(), enabled: false }
	}
	function wrapInner(inner: Element, allowCompact: boolean) {
		const Renderer = inner.type as ReactTypes.FunctionComponent<any>
		let Wrapper = inners.get(Renderer)
		if (!Wrapper) {
			Wrapper = ({ originalProps, allowCompact }) => {
				const settings = useSettings()
				// Always call the original renderer, including when paused, for hook order.
				const output = Renderer(originalProps)
				return allowCompact
					? (compactMenuBody(
							React,
							output,
							originalProps,
							settings,
						) as ReactTypes.ReactNode)
					: output
			}
			inners.set(Renderer, Wrapper)
		}
		return React.createElement(Wrapper, {
			key: inner.key,
			originalProps: inner.props,
			allowCompact,
		})
	}
	function scopeRow(original: unknown): unknown {
		if (
			!element(React, original) ||
			!['default', 'danger'].includes(original.props.value)
		)
			return original
		const row = original.props.children
		if (
			!element(React, row) ||
			!functionElement(row) ||
			!Object.hasOwn(row.props, 'label') ||
			!['default', 'danger'].includes(row.props.variant)
		)
			return original
		const Renderer = row.type as ReactTypes.FunctionComponent<any>
		let Wrapper = rows.get(Renderer)
		if (!Wrapper) {
			Wrapper = props => {
				const output = Renderer(props)
				return scopeMenuCard(React, output, inner =>
					wrapInner(inner, !customRowSize(props.style)),
				) as ReactTypes.ReactNode
			}
			rows.set(Renderer, Wrapper)
		}
		return React.cloneElement(
			original,
			{},
			React.createElement(Wrapper, { ...row.props, key: row.key }),
		)
	}
	function Styled({ original, kind }: { original: unknown; kind: PolishKind }) {
		const settings = useSettings()
		switch (kind) {
			case 'text-channel':
				return polishTextChannel(React, original, settings)
			case 'base-channel':
				return polishBaseChannel(React, View, original, settings)
			case 'sheet':
				return polishSheet(React, original, settings)
			case 'row':
				return scopeRow(polishRow(React, original, settings))
			case 'handle':
				return polishHandle(React, original, settings)
		}
	}
	return {
		wrap(kind: PolishKind, original: unknown) {
			return alive && View && element(React, original)
				? React.createElement(Styled as any, { kind, original })
				: original
		},
		dispose() {
			alive = false
		},
	}
}
