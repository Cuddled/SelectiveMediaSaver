import { WALLPAPER_SOURCE } from '../../com.cuddled.liquidglass/js/wallpaper'
import type { Settings } from './core'

export const MOODS = {
	waves: {
		name: 'Waves',
		description: 'Original waves image · violet and blue glass',
		accent: '#B8A1FF',
		secondary: '#6DCAEF',
		panel: '#171B2B',
		menu: '#111321',
		base: '#0B0D19',
		transparency: 0.8,
		darkness: 0.28,
	},
	frosted: {
		name: 'Frosted Glass',
		description: 'Blurred waves · clear panels · icy edges',
		accent: '#C4E8FF',
		secondary: '#B8A1FF',
		panel: '#151B2C',
		menu: '#111827',
		base: '#090F1D',
		transparency: 0.9,
		darkness: 0.18,
	},
	midnight: {
		name: 'Midnight',
		description: 'Violet light · deep blue glass',
		accent: '#B8A1FF',
		secondary: '#6DCAEF',
		panel: '#171B2B',
		menu: '#111321',
		base: '#0B0D19',
		transparency: 0.8,
		darkness: 0.28,
	},
	ice: {
		name: 'Ice',
		description: 'Cool cyan · smoked navy',
		accent: '#99E4FF',
		secondary: '#8AABFF',
		panel: '#122232',
		menu: '#101D2A',
		base: '#08141F',
		transparency: 0.72,
		darkness: 0.24,
	},
	rose: {
		name: 'Rose',
		description: 'Soft pink · plum glass',
		accent: '#FFAFD4',
		secondary: '#B5A1FF',
		panel: '#2B1929',
		menu: '#201421',
		base: '#170C17',
		transparency: 0.74,
		darkness: 0.3,
	},
	oled: {
		name: 'OLED',
		description: 'Black surfaces · silver accents',
		accent: '#DCE3F5',
		secondary: '#DCE3F5',
		panel: '#000000',
		menu: '#08090C',
		base: '#000000',
		transparency: 0,
		darkness: 1,
	},
} as const
export type Mood = keyof typeof MOODS
export const moodColors = (settings: Settings) =>
	settings.studio.mood === 'custom'
		? { base: '#0B0D17', secondary: '#6DCAEF' }
		: MOODS[settings.studio.mood]

/** Presets retain pins, scopes and scenes. Frosted explicitly enables wallpaper blur. */
export function applyMood(settings: Settings, mood: Mood): Partial<Settings> {
	const value = MOODS[mood]
	const imagePreset = mood === 'waves' || mood === 'frosted'
	return {
		panelColor: value.panel,
		menuColor: value.menu,
		accentColor: value.accent,
		textColor: '#F7F8FF',
		transparency: value.transparency,
		darkness: value.darkness,
		accentOpacity: mood === 'frosted' ? 0.85 : 0.65,
		blur: mood === 'frosted' ? 10 : 0,
		...(mood === 'frosted' ? { lowPower: false } : {}),
		studio: {
			...settings.studio,
			mood,
			wallpaper: imagePreset ? WALLPAPER_SOURCE.uri : '',
			homeWallpaper: imagePreset ? WALLPAPER_SOURCE.uri : '',
			...(imagePreset ? { focus: false } : {}),
		},
	}
}

export function moodSnapshot(settings: Settings): Partial<Settings> {
	return {
		panelColor: settings.panelColor,
		menuColor: settings.menuColor,
		accentColor: settings.accentColor,
		textColor: settings.textColor,
		transparency: settings.transparency,
		darkness: settings.darkness,
		blur: settings.blur,
		lowPower: settings.lowPower,
		accentOpacity: settings.accentOpacity,
	}
}

export const isFocused = (settings: Settings) =>
	settings.enabled && settings.studio.focus
export const generatedBackdrop = (settings: Settings, uri: string) =>
	isFocused(settings) ||
	(!['custom', 'waves', 'frosted'].includes(settings.studio.mood) &&
		uri === WALLPAPER_SOURCE.uri)
export function motionAllowed(
	settings: Settings,
	reduced: boolean,
	foreground: boolean,
) {
	return (
		settings.enabled &&
		!settings.lowPower &&
		!reduced &&
		foreground &&
		!settings.studio.focus &&
		settings.studio.mood !== 'oled'
	)
}

/** Focus is a presentation override, never a rewrite of the user's saved look. */
export function focusAppearance(settings: Settings): Settings {
	if (!isFocused(settings)) return settings
	return {
		...settings,
		transparency: 0,
		darkness: 1,
		studio: {
			...settings.studio,
			ambient: false,
			softMotion: false,
			emptyArt: false,
			hideGift: true,
			hideApps: true,
			music: false,
		},
	}
}

/** Unknown accessibility state stays still; late promises cannot undo a newer OS event. */
export function createMotionPolicy(native: Record<string, any>) {
	let reduced = true
	let foreground = native.AppState?.currentState === 'active'
	let alive = true
	let eventRevision = 0
	const listeners = new Set<() => void>()
	const cleanup: Array<() => void> = []
	const notify = () => {
		if (alive) for (const listener of listeners) listener()
	}
	try {
		const subscription = native.AccessibilityInfo?.addEventListener?.(
			'reduceMotionChanged',
			(value: boolean) => {
				eventRevision++
				reduced = value !== false
				notify()
			},
		)
		if (subscription?.remove) cleanup.push(() => subscription.remove())
		const requestRevision = eventRevision
		Promise.resolve(native.AccessibilityInfo?.isReduceMotionEnabled?.())
			.then(value => {
				if (alive && eventRevision === requestRevision) {
					reduced = value !== false
					notify()
				}
			})
			.catch(() => {})
		const app = native.AppState?.addEventListener?.(
			'change',
			(value: string) => {
				foreground = value === 'active'
				notify()
			},
		)
		if (app?.remove) cleanup.push(() => app.remove())
	} catch {
		/* Static fallback when the platform does not expose these APIs. */
	}
	return {
		getSnapshot: () => `${reduced}:${foreground}`,
		subscribe(listener: () => void) {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		allows: (settings: Settings) =>
			alive && motionAllowed(settings, reduced, foreground),
		dispose() {
			alive = false
			for (const remove of cleanup) remove()
			listeners.clear()
		},
	}
}

/** All mounted surfaces share one OS listener pair, released with the last subscriber. */
export function createSharedMotionPolicy(native: Record<string, any>) {
	let policy: ReturnType<typeof createMotionPolicy> | undefined
	const listeners = new Set<() => void>()
	return {
		getSnapshot: () => policy?.getSnapshot() ?? 'true:false',
		allows: (settings: Settings) => policy?.allows(settings) ?? false,
		subscribe(listener: () => void) {
			listeners.add(listener)
			if (!policy) {
				policy = createMotionPolicy(native)
				policy.subscribe(() => {
					for (const notify of listeners) notify()
				})
			}
			return () => {
				listeners.delete(listener)
				if (!listeners.size) {
					policy?.dispose()
					policy = undefined
				}
			}
		},
	}
}
const motionPolicies = new WeakMap<
	object,
	ReturnType<typeof createSharedMotionPolicy>
>()
export function getMotionPolicy(native: Record<string, any>) {
	let policy = motionPolicies.get(native)
	if (!policy) {
		policy = createSharedMotionPolicy(native)
		motionPolicies.set(native, policy)
	}
	return policy
}
