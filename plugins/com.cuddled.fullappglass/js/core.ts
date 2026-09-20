import {
	BASE_SEMANTIC_COLOR_KEYS,
	buildSemanticOverrides,
	DEFAULT_SETTINGS as GLASS_DEFAULTS,
	hexWithAlpha,
	normalizeHexColor,
	readableChatForeground,
} from '../../com.cuddled.liquidglass/js/core'
import { PROFILE_ACCENT, profileAccent } from './profileAccents'
import { normalizeStudio, STUDIO_DEFAULTS } from './studioModel'
import type {
	HexColor,
	LiquidGlassSettings,
} from '../../com.cuddled.liquidglass/js/types'
import type { StudioSettings } from './studioModel'

export interface Settings {
	schemaVersion: 1
	enabled: boolean
	transparency: number
	darkness: number
	blur: number
	lowPower: boolean
	panelColor: HexColor
	textColor: HexColor
	mainScreens: boolean
	chats: boolean
	profiles: boolean
	menus: boolean
	controls: boolean
	accentColor: HexColor
	accentOpacity: number
	polishChannels: boolean
	polishComposer: boolean
	polishMenus: boolean
	menuColor: HexColor
	compactMenus: boolean
	studio: StudioSettings
}

// Start paused so the user can turn their other appearance plugin off first.
export const DEFAULT_SETTINGS: Settings = {
	schemaVersion: 1,
	enabled: false,
	transparency: 0.8,
	darkness: 0.28,
	blur: 0,
	lowPower: true,
	panelColor: '#171B2B',
	textColor: '#F7F8FF',
	mainScreens: true,
	chats: true,
	profiles: true,
	menus: true,
	controls: true,
	accentColor: '#B8A1FF',
	accentOpacity: 0.65,
	polishChannels: true,
	polishComposer: true,
	polishMenus: true,
	menuColor: '#111321',
	compactMenus: true,
	studio: STUDIO_DEFAULTS,
}

const clamp = (value: unknown, fallback: number, max = 1) =>
	typeof value === 'number' && Number.isFinite(value)
		? Math.min(max, Math.max(0, value))
		: fallback

export function normalize(value: unknown): Settings {
	const raw =
		value && typeof value === 'object' ? (value as Partial<Settings>) : {}
	const result = { ...DEFAULT_SETTINGS }
	for (const key of [
		'enabled',
		'lowPower',
		'mainScreens',
		'chats',
		'profiles',
		'menus',
		'controls',
		'polishChannels',
		'polishComposer',
		'polishMenus',
		'compactMenus',
	] as const)
		if (typeof raw[key] === 'boolean') result[key] = raw[key]
	result.transparency = clamp(raw.transparency, result.transparency)
	result.darkness = clamp(raw.darkness, result.darkness)
	result.blur = clamp(raw.blur, result.blur, 10)
	result.panelColor = normalizeHexColor(raw.panelColor, result.panelColor)
	result.textColor = normalizeHexColor(raw.textColor, result.textColor)
	result.accentColor = normalizeHexColor(raw.accentColor, result.accentColor)
	result.menuColor = normalizeHexColor(raw.menuColor, result.menuColor)
	result.accentOpacity = clamp(raw.accentOpacity, result.accentOpacity)
	result.studio = normalizeStudio(raw.studio)
	return result
}

/** Bundled pure helpers only; no dependency on Liquid Glass installation/storage. */
export function asGlass(value: Settings): LiquidGlassSettings {
	const settings = normalize(value)
	const opacity = 1 - settings.transparency
	return {
		...GLASS_DEFAULTS,
		gradientColors: [...GLASS_DEFAULTS.gradientColors],
		customProfiles: [],
		enabled: settings.enabled,
		backgroundEnabled: settings.mainScreens,
		backgroundMode: 'midnight-waves',
		semanticEnabled: true,
		profileGlassEnabled: settings.profiles,
		overlayGlassEnabled: settings.menus,
		controlGlassEnabled: settings.controls,
		chatWallpaperEnabled: settings.chats,
		panelColor: settings.panelColor,
		tintColor: settings.panelColor,
		textColor: readableChatForeground(settings.textColor),
		panelOpacity: opacity,
		raisedOpacity: opacity,
		profileOpacity: opacity,
		overlayOpacity: opacity,
		controlOpacity: opacity,
		wallpaperOpacity: 1,
		wallpaperDim: settings.darkness,
		wallpaperTintOpacity: 0,
		wallpaperBlur: settings.blur,
		chatWallpaperOpacity: 1,
		chatWallpaperDim: settings.darkness,
		lowPowerMode: settings.lowPower,
	}
}

const CHAT_BASE_KEYS = new Set<string>([
	'CHANNEL_BACKGROUND_DEFAULT',
	'STANDALONE_CHANNEL_CONTENT_BACKGROUND',
	'CHAT_BANNER_BG',
	'EMBED_BACKGROUND',
	'EMBED_BACKGROUND_ALTERNATE',
	'MOBILE_EMBED_BACKGROUND_DEFAULT',
	'MOBILE_THREAD_EMBED_BACKGROUND',
])

export function palette(value: Settings): Record<string, string> {
	const settings = normalize(value)
	const result = buildSemanticOverrides(asGlass(settings))
	// Shared base surfaces form the main lists/settings group; chat surfaces have
	// their own switch. This never guesses or traverses arbitrary native Views.
	for (const key of BASE_SEMANTIC_COLOR_KEYS) {
		if (!(CHAT_BASE_KEYS.has(key) ? settings.chats : settings.mainScreens))
			delete result[key]
	}
	if (settings.enabled && settings.chats && settings.studio.reactions) {
		Object.assign(result, {
			REACTION_BACKGROUND_DEFAULT: '#181C2BDD',
			REACTION_BORDER_DEFAULT: hexWithAlpha(settings.accentColor, 0.2),
			REACTION_TEXT_DEFAULT: '#E8EAF5FF',
			REACTION_BACKGROUND_REACTED_DEFAULT: hexWithAlpha(
				settings.accentColor,
				0.26,
			),
			REACTION_BORDER_REACTED_DEFAULT: hexWithAlpha(settings.accentColor, 0.75),
			REACTION_TEXT_REACTED_DEFAULT: '#F7F8FFFF',
		})
	}
	return result
}

export const surfaceColor = (settings: Settings) =>
	hexWithAlpha(settings.panelColor, 1 - settings.transparency)

// Overlapping text needs a stronger backing than ordinary wallpaper-backed cards.
export const headerColor = (settings: Settings) =>
	hexWithAlpha(settings.panelColor, Math.max(0.97, 1 - settings.transparency))

export const toolbarColor = (settings: Settings) =>
	hexWithAlpha(settings.panelColor, Math.max(0.82, 1 - settings.transparency))

/** Only used around profile button groups, never the profile/banner itself. */
export function profileButtonTheme(
	settings: Settings,
	parent: unknown,
): unknown {
	if (
		!settings.enabled ||
		!settings.profiles ||
		!settings.controls ||
		!parent ||
		typeof parent !== 'object' ||
		Array.isArray(parent)
	)
		return parent
	const original = parent as Record<string, unknown>
	const accent = profileAccent(
		original[PROFILE_ACCENT] ?? original.primaryColor,
	)
	return {
		...original,
		theme: 'dark',
		primaryColor: null,
		secondaryColor: null,
		gradient: null,
		[PROFILE_ACCENT]: accent,
		key: `${original.key ?? ''}|fullapp-profile-controls:${accent}:${JSON.stringify(settings)}`,
	}
}

export function navigationTheme(
	settings: Settings,
	original: unknown,
): unknown {
	if (
		!settings.enabled ||
		!settings.mainScreens ||
		!original ||
		typeof original !== 'object'
	)
		return original
	const theme = original as Record<string, any>
	if (
		!theme.colors ||
		typeof theme.colors !== 'object' ||
		Array.isArray(theme.colors)
	)
		return original
	return {
		...theme,
		dark: true,
		colors: { ...theme.colors, background: '#00000000', card: '#00000000' },
	}
}

export function createState(initial: unknown = DEFAULT_SETTINGS) {
	let settings = normalize(initial)
	let revision = JSON.stringify(settings)
	const listeners = new Set<() => void>()
	return {
		getSettings: () => settings,
		getSnapshot: () => revision,
		subscribe(listener: () => void) {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		update(value: unknown) {
			const next = normalize(value)
			const key = JSON.stringify(next)
			if (key === revision) return
			settings = next
			revision = key
			for (const listener of listeners) listener()
		},
	}
}

export const runtime = createState()
