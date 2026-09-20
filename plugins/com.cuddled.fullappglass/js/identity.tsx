import { hexWithAlpha } from '../../com.cuddled.liquidglass/js/core'
import type * as ReactTypes from 'react'
import type { Settings } from './core'
import type { Access } from './surfaces'

type ReactApi = typeof ReactTypes
type Element = ReactTypes.ReactElement<Record<string, any>>
export type IdentityKind =
	| 'avatar'
	| 'avatar-image'
	| 'profile-avatar'
	| 'banner'
	| 'card'
	| 'section'
	| 'connections'
	| 'connection-row'
const MARKER = '__fullAppGlassAvatar'
const element = (React: ReactApi, value: unknown): value is Element =>
	React.isValidElement(value)
export const avatarRadius = (
	shape: Settings['studio']['avatarShape'],
	size: number,
) =>
	shape === 'rounded' ? size * 0.24 : shape === 'soft' ? size * 0.36 : size / 2
export function avatarFrame(settings: Settings, size: number) {
	return {
		...(settings.studio.avatarShape === 'native'
			? {}
			: { borderRadius: avatarRadius(settings.studio.avatarShape, size) }),
		...(settings.studio.avatarBorder === 'none'
			? {}
			: {
					borderWidth: size >= 64 ? 1.5 : 1,
					borderColor: hexWithAlpha(
						settings.accentColor,
						settings.studio.avatarBorder === 'accent' ? 0.8 : 0.28,
					),
				}),
	}
}
export const profileEnabled = (settings: Settings) =>
	settings.enabled && settings.profiles && settings.studio.profileLayout
export function profileCardStyle(settings: Settings) {
	return {
		borderRadius: 24,
		borderWidth: 1,
		borderColor: hexWithAlpha(settings.accentColor, 0.22),
		backgroundColor: hexWithAlpha(
			settings.panelColor,
			settings.studio.focus ? 1 : 0.9,
		),
		padding: 16,
	}
}

/** Mark only the native Avatar's image slot, never status, decoration, server or call layers. */
export function markAvatar(
	React: ReactApi,
	original: unknown,
	props: any,
	settings: Settings,
) {
	if (
		!settings.enabled ||
		!settings.studio.avatarStyles ||
		!element(React, original) ||
		props?.channel ||
		props?.speaking ||
		props?.isStageCall ||
		props?.mute ||
		props?.deaf ||
		props?.avatarDecoration
	)
		return original
	const children = original.props.children
	if (
		!Array.isArray(children) ||
		children.length !== 5 ||
		!element(React, children[1]) ||
		!Object.hasOwn(children[1].props, 'cutout') ||
		!children[1].props.size
	)
		return original
	return React.cloneElement(
		original,
		{},
		children.map((child, index) =>
			index === 1 ? React.cloneElement(child, { [MARKER]: true }) : child,
		),
	)
}

/** Change only the raster image radius; native status cutouts and image loading remain in charge. */
export function styleAvatarImage(
	React: ReactApi,
	original: unknown,
	props: any,
	settings: Settings,
	sizes: Record<string, number>,
) {
	const size = sizes[props?.size]
	if (
		!settings.enabled ||
		!settings.studio.avatarStyles ||
		!props?.[MARKER] ||
		!element(React, original) ||
		!Number.isFinite(size) ||
		size < 16 ||
		size > 128 ||
		!Object.hasOwn(original.props, 'source') ||
		!Object.hasOwn(original.props, 'style')
	)
		return original
	const frame = avatarFrame(settings, size)
	if (
		Object.hasOwn(original.props, 'imageStyle') &&
		original.props.cutout &&
		props.cutout?.nativeCutouts?.length === 1
	) {
		return React.cloneElement(original, {
			style: [
				original.props.style,
				settings.studio.avatarShape === 'native'
					? {}
					: {
							borderRadius: avatarRadius(settings.studio.avatarShape, size),
							overflow: 'hidden',
						},
			],
			imageStyle: [original.props.imageStyle, frame],
		})
	}
	// The older SVG mask has its own geometry: leave that renderer unchanged.
	if (props.cutout != null || !Object.hasOwn(original.props, 'usesSmallCache'))
		return original
	return React.cloneElement(original, { style: [original.props.style, frame] })
}

/** Exact profile slots; the avatar/media-viewer ref and original overlap geometry stay native. */
export function styleProfileAvatar(
	React: ReactApi,
	original: unknown,
	props: any,
	settings: Settings,
	flatten: (style: any) => any,
) {
	if (
		!profileEnabled(settings) ||
		!settings.studio.profileFloatAvatar ||
		props?.pendingAvatarSrc !== undefined ||
		!element(React, original) ||
		original.type !== React.Fragment
	)
		return original
	const children = original.props.children
	if (
		!Array.isArray(children) ||
		children.length !== 2 ||
		!element(React, children[0]) ||
		!element(React, children[1]) ||
		!children[1].props.size ||
		!Object.hasOwn(children[0].props, 'style')
	)
		return original
	const backing = flatten(children[0].props.style)
	if (!Number.isFinite(backing?.width) || backing.width !== backing.height)
		return original
	return React.cloneElement(original, {}, [
		React.cloneElement(children[0], {
			pointerEvents: 'none',
			accessible: false,
			style: [
				children[0].props.style,
				{
					backgroundColor: settings.panelColor,
					...(settings.studio.avatarStyles &&
					settings.studio.avatarShape !== 'native' &&
					!props?.user?.avatarDecoration &&
					!props?.pendingAvatarDecoration
						? {
								borderRadius:
									avatarRadius(
										settings.studio.avatarShape,
										Math.max(0, backing.width - 12),
									) + 6,
							}
						: {}),
					borderColor: hexWithAlpha(settings.accentColor, 0.42),
					borderWidth: 1,
					shadowColor: '#000000',
					shadowOpacity: 0.3,
					shadowRadius: 12,
					shadowOffset: { width: 0, height: 6 },
					elevation: 4,
				},
			],
		}),
		children[1],
	])
}

export function createIdentitySurfaces(
	React: ReactApi,
	native: Record<string, any>,
	access: Access,
) {
	let alive = true
	let sizes: Record<string, number> = {}
	const DetailContext = React.createContext<{ key: string } | null>(null)
	const current = () =>
		alive && access.isActive()
			? access.getSettings()
			: { ...access.getSettings(), enabled: false }
	const flatten = (value: any): any =>
		native.StyleSheet?.flatten(value) ??
		(Array.isArray(value) ? Object.assign({}, ...value.map(flatten)) : value)
	function BannerFade({ settings }: { settings: Settings }) {
		// Small static native strips avoid another module dependency or an image download.
		return React.createElement(
			native.View,
			{
				key: 'fullappglass-banner-fade',
				pointerEvents: 'none',
				accessible: false,
				accessibilityElementsHidden: true,
				importantForAccessibility: 'no-hide-descendants',
				style: {
					position: 'absolute',
					left: 0,
					right: 0,
					bottom: 0,
					height: 72,
				},
			},
			Array.from({ length: 32 }, (_, i) =>
				React.createElement(native.View, {
					key: i,
					style: {
						flex: 1,
						backgroundColor: hexWithAlpha(
							settings.panelColor,
							0.92 * ((i + 1) / 32) ** 1.8,
						),
					},
				}),
			),
		)
	}
	function Surface({
		kind,
		original,
		props = {},
	}: {
		kind: IdentityKind
		original: unknown
		props?: Record<string, any>
	}): any {
		React.useSyncExternalStore(
			access.subscribe,
			access.getSnapshot,
			access.getSnapshot,
		)
		const detail = React.useContext(DetailContext)
		const [fold, setFold] = React.useState({ key: '', closed: false })
		const settings = current()
		if (kind === 'avatar') return markAvatar(React, original, props, settings)
		if (kind === 'avatar-image')
			return styleAvatarImage(React, original, props, settings, sizes)
		if (kind === 'profile-avatar')
			return styleProfileAvatar(React, original, props, settings, flatten)
		if (!element(React, original)) return original
		if (kind === 'connections') {
			const group = original.props.children
			if (
				typeof original.props.title !== 'string' ||
				!element(React, group) ||
				group.props.hasIcons !== true ||
				!props.userId
			)
				return original
			// Keep the provider mounted across live toggles. Native privacy filtering already ran.
			return React.createElement(
				DetailContext.Provider,
				{ value: { key: `${props.userId}:${original.props.title}` } },
				original,
			)
		}
		if (!profileEnabled(settings)) return original
		if (kind === 'connection-row') {
			if (
				!detail ||
				!settings.studio.profileCompactConnections ||
				props.height != null ||
				!Object.hasOwn(original.props, 'style') ||
				!Array.isArray(original.props.children) ||
				!Object.hasOwn(props, 'label')
			)
				return original
			return React.cloneElement(original, {
				style: [
					original.props.style,
					{ paddingVertical: 8, paddingHorizontal: 10, minHeight: 48 },
				],
			})
		}
		if (kind === 'banner') {
			if (
				!settings.studio.profileBannerFade ||
				props.pendingBanner !== undefined ||
				!props.displayProfile ||
				!Object.hasOwn(original.props, 'style') ||
				!element(React, original.props.children)
			)
				return original
			return React.cloneElement(original, {}, [
				original.props.children,
				React.createElement(BannerFade, { key: 'fade', settings }),
			])
		}
		if (kind === 'section') {
			if (
				!Array.isArray(original.props.children) ||
				original.props.children.length !== 2 ||
				!Object.hasOwn(original.props, 'style')
			)
				return original
			return React.cloneElement(original, {
				style: [original.props.style, profileCardStyle(settings)],
			})
		}
		if (kind === 'card') {
			const children = original.props.children
			if (
				!Array.isArray(children) ||
				children.length !== 2 ||
				!Object.hasOwn(original.props, 'style')
			)
				return original
			const styled = React.cloneElement(original, {
				style: [original.props.style, profileCardStyle(settings)],
			})
			const header = children[0]
			if (
				!detail ||
				!element(React, header) ||
				!Array.isArray(header.props.children) ||
				header.props.children.length !== 2 ||
				!element(React, header.props.children[0]) ||
				typeof props.title !== 'string'
			)
				return styled
			const canFold = settings.studio.profileCollapsible
			const closed = canFold && fold.key === detail.key && fold.closed
			const title = header.props.children[0]
			const titleButton = React.createElement(
				native.Pressable,
				{
					key: 'detail-toggle',
					disabled: !canFold,
					accessibilityRole: canFold ? 'button' : 'header',
					accessibilityLabel: props.title,
					accessibilityState: canFold ? { expanded: !closed } : undefined,
					onPress: () => setFold({ key: detail.key, closed: !closed }),
					style: {
						flex: 1,
						flexDirection: 'row',
						alignItems: 'center',
						minHeight: 44,
						gap: 8,
					},
				},
				title,
				canFold
					? React.createElement(
							native.Text,
							{
								accessible: false,
								importantForAccessibility: 'no-hide-descendants',
								style: { color: settings.accentColor, fontSize: 20 },
							},
							closed ? '+' : '−',
						)
					: null,
			)
			const titleRow = React.cloneElement(
				header,
				{ style: [header.props.style, { marginBottom: closed ? 0 : 8 }] },
				[titleButton, header.props.children[1]],
			)
			const body = React.createElement(
				native.View,
				{
					key: 'detail-body',
					style: closed ? { display: 'none' } : undefined,
					accessibilityElementsHidden: closed,
					importantForAccessibility: closed ? 'no-hide-descendants' : 'auto',
				},
				children[1],
			)
			return React.cloneElement(styled, {}, [titleRow, body])
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
			console.warn('[FullAppGlass] Avatar/profile styling unavailable:', error)
		}
		render() {
			return this.state.failed
				? (this.props.original as ReactTypes.ReactNode)
				: this.props.children
		}
	}
	return {
		setAvatarSizes(value: unknown) {
			if (value && typeof value === 'object')
				sizes = { ...(value as Record<string, number>) }
		},
		wrap(kind: IdentityKind, original: unknown, props?: Record<string, any>) {
			return alive && element(React, original)
				? React.createElement(
						Guard,
						{ original },
						React.createElement(Surface, { kind, original, props }),
					)
				: original
		},
		dispose() {
			alive = false
			sizes = {}
		},
	}
}
