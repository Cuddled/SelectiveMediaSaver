import type * as ReactTypes from 'react'

type ReactApi = typeof ReactTypes
type Element = ReactTypes.ReactElement<Record<string, any>>

function backing(
	React: ReactApi,
	original: Element,
	enabled: boolean,
	wallpaper: ReactTypes.ReactNode,
) {
	return React.cloneElement(original, {
		style: enabled
			? [
					original.props.style,
					{ backgroundColor: '#0B0D17', overflow: 'hidden' },
				]
			: original.props.style,
		children: [
			wallpaper,
			React.createElement(
				React.Fragment,
				{ key: 'bottom-bar-content' },
				original.props.children,
			),
		],
	})
}

/** Discord 347 FloatingChatInputContainer: only the inner input pill, not its
 * keyboard-padding wrapper, autocomplete, nudge, or emoji-suggestion siblings.
 */
export function backFloatingInput(
	React: ReactApi,
	original: unknown,
	enabled: boolean,
	wallpaper: ReactTypes.ReactNode,
): unknown {
	if (
		!React.isValidElement<Record<string, any>>(original) ||
		!Object.hasOwn(original.props, 'style') ||
		typeof original.props.onLayout !== 'function'
	)
		return original
	const fragment = original.props.children
	if (
		!React.isValidElement<Record<string, any>>(fragment) ||
		fragment.type !== React.Fragment
	)
		return original
	const children = fragment.props.children
	if (!Array.isArray(children) || children.length !== 4) return original
	const box = children[2]
	if (
		!React.isValidElement<Record<string, any>>(box) ||
		!Object.hasOwn(box.props, 'style') ||
		box.props.collapsable !== false ||
		typeof box.props.onLayout !== 'function' ||
		typeof box.props.onStartShouldSetResponder !== 'function' ||
		typeof box.props.onResponderRelease !== 'function' ||
		!Array.isArray(box.props.children) ||
		box.props.children.length !== 3
	)
		return original
	const next = [...children]
	next[2] = backing(React, box, enabled, wallpaper)
	return React.cloneElement(
		original,
		{},
		React.cloneElement(fragment, {}, next),
	)
}

/** Only the decorative output of YouBarMasked/AnimatedBackground is changed.
 * Preserve the original avatar mask, radius animation, nameplate and controls.
 */
export function backAccountBar(
	React: ReactApi,
	original: unknown,
	enabled: boolean,
	wallpaper: ReactTypes.ReactNode,
): unknown {
	if (
		!React.isValidElement<Record<string, any>>(original) ||
		!Object.hasOwn(original.props, 'style')
	)
		return original
	if (Object.hasOwn(original.props, 'maskElement')) {
		const fill = original.props.children
		if (
			!React.isValidElement(original.props.maskElement) ||
			!React.isValidElement<Record<string, any>>(fill) ||
			!Object.hasOwn(fill.props, 'style') ||
			fill.props.children != null
		)
			return original
		return React.cloneElement(
			original,
			{},
			backing(React, fill, enabled, wallpaper),
		)
	}
	if (original.props.children != null) return original
	return backing(React, original, enabled, wallpaper)
}

/** YouBarFloatingShade already blocks touches over the measured bar footprint.
 * Give that invisible backing a wallpaper fill so channel names cannot bleed
 * around the avatar cutout. Keep its dimensions and gradient siblings intact.
 */
export function backAccountShade(
	React: ReactApi,
	original: unknown,
	enabled: boolean,
	wallpaper: ReactTypes.ReactNode,
): unknown {
	if (
		!React.isValidElement<Record<string, any>>(original) ||
		original.type !== React.Fragment
	)
		return original
	const children = original.props.children
	if (!Array.isArray(children) || children.length !== 3) return original
	const [blocker, gradient, fill] = children
	if (
		!React.isValidElement<Record<string, any>>(blocker) ||
		blocker.props.pointerEvents !== 'box-only' ||
		blocker.props.children != null ||
		!Array.isArray(blocker.props.style) ||
		!React.isValidElement<Record<string, any>>(gradient) ||
		gradient.props.pointerEvents !== 'none' ||
		!Array.isArray(gradient.props.colors) ||
		gradient.props.colors.length !== 2 ||
		!React.isValidElement<Record<string, any>>(fill) ||
		!Object.hasOwn(fill.props, 'style') ||
		fill.props.children != null
	)
		return original
	const measured = blocker.props.style.at(-1)
	if (
		measured?.opacity !== 0 ||
		typeof measured.height !== 'number' ||
		!Number.isFinite(measured.height) ||
		measured.height <= 0
	)
		return original
	return React.cloneElement(original, {}, [
		React.cloneElement(blocker, {
			style: enabled
				? [
						blocker.props.style,
						{
							opacity: 1,
							backgroundColor: '#0B0D17',
							overflow: 'hidden',
						},
					]
				: blocker.props.style,
			children: wallpaper,
		}),
		gradient,
		fill,
	])
}
