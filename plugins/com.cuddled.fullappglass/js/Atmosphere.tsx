import { hexWithAlpha } from '../../com.cuddled.liquidglass/js/core'
import { ABSOLUTE_FILL } from '../../com.cuddled.liquidglass/js/wallpaper'
import { getMotionPolicy, moodColors } from './experience'
import type { ComponentType } from 'react'
import type { Settings } from './core'

let customGradient: ComponentType<any> | undefined
let motionActive = true
let environmentRevision = 0
const animations = new Set<() => void>()
const gradientListeners = new Set<() => void>()
function notifyEnvironment() {
	environmentRevision++
	for (const notify of gradientListeners) notify()
}
export function setAtmosphereActive(active: boolean) {
	motionActive = active
	if (!active) for (const stop of [...animations]) stop()
	notifyEnvironment()
}
export function setAtmosphereGradient(
	component: ComponentType<any> | undefined,
) {
	customGradient = component
	notifyEnvironment()
}
const subscribeGradient = (listener: () => void) => {
	gradientListeners.add(listener)
	return () => {
		gradientListeners.delete(listener)
	}
}
const gradientSnapshot = () => environmentRevision

export function useMotion(settings: Settings) {
	const React = revenge.react.React
	const policy = getMotionPolicy(revenge.react.ReactNative)
	React.useSyncExternalStore(
		subscribeGradient,
		gradientSnapshot,
		gradientSnapshot,
	)
	React.useSyncExternalStore(
		policy.subscribe,
		policy.getSnapshot,
		policy.getSnapshot,
	)
	return motionActive && policy.allows(settings)
}

/** Native opacity/transform animation only; no JS frame loop, blur or touch interception. */
export function Atmosphere({
	settings,
	backdrop = false,
}: {
	settings: Settings
	backdrop?: boolean
}) {
	const React = revenge.react.React
	const { View, Animated, Easing } = revenge.react.ReactNative
	const motion = useMotion(settings)
	const Gradient = customGradient
	const animate = motion && settings.studio.ambient && !!Gradient
	const [phase] = React.useState(() =>
		Animated?.Value ? new Animated.Value(0) : null,
	)
	React.useEffect(() => {
		if (
			!phase ||
			!animate ||
			!Animated?.loop ||
			!Animated?.sequence ||
			!Animated?.timing
		)
			return
		const animation = Animated.loop(
			Animated.sequence([
				Animated.timing(phase, {
					toValue: 1,
					duration: 12000,
					easing: Easing?.inOut?.(Easing.sin),
					useNativeDriver: true,
					isInteraction: false,
				}),
				Animated.timing(phase, {
					toValue: 0,
					duration: 12000,
					easing: Easing?.inOut?.(Easing.sin),
					useNativeDriver: true,
					isInteraction: false,
				}),
			]),
		)
		let stopped = false
		const stop = () => {
			if (stopped) return
			stopped = true
			animations.delete(stop)
			animation.stop()
			phase.stopAnimation()
			phase.setValue(0)
		}
		animations.add(stop)
		animation.start()
		return stop
	}, [phase, animate])
	if (!settings.enabled) return null
	const colors = moodColors(settings)
	const quiet = settings.studio.focus || settings.studio.mood === 'oled'
	if (!backdrop && (!settings.studio.ambient || quiet)) return null
	const Layer = Animated?.View ?? View
	const drift =
		animate && phase
			? {
					transform: [
						{
							translateX: phase.interpolate({
								inputRange: [0, 1],
								outputRange: [-18, 28],
							}),
						},
						{
							translateY: phase.interpolate({
								inputRange: [0, 1],
								outputRange: [12, -28],
							}),
						},
					],
				}
			: undefined
	return (
		<View
			pointerEvents="none"
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			style={[
				ABSOLUTE_FILL,
				{
					overflow: 'hidden',
					backgroundColor: backdrop
						? quiet
							? settings.panelColor
							: colors.base
						: undefined,
				},
			]}
		>
			{!quiet ? (
				<Layer
					style={[
						ABSOLUTE_FILL,
						{
							top: -40,
							left: -40,
							right: -40,
							bottom: -40,
							opacity: backdrop ? 0.22 : 0.1,
						},
						drift,
					]}
				>
					{Gradient ? (
						<Gradient
							absolute
							componentStyles={ABSOLUTE_FILL}
							mix={false}
							withOverlay={false}
							customTheme={{
								theme: 'dark',
								customThemeSettings: {
									colors: [settings.accentColor, colors.base, colors.secondary],
									gradientColorStops: [0, 52, 100],
									gradientAngle: 135,
								},
							}}
						/>
					) : (
						<View
							style={[
								ABSOLUTE_FILL,
								{ backgroundColor: hexWithAlpha(settings.accentColor, 0.4) },
							]}
						/>
					)}
				</Layer>
			) : null}
			{backdrop && !quiet ? (
				<View
					style={[
						ABSOLUTE_FILL,
						{ backgroundColor: hexWithAlpha('#000000', settings.darkness) },
					]}
				/>
			) : null}
		</View>
	)
}
