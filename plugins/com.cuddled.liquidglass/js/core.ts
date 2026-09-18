import { BUILT_IN_PRESET_IDS, SETTINGS_SCHEMA_VERSION } from './types'
import type {
	BuiltInPresetId,
	GradientColors,
	HexColor,
	LiquidGlassCustomProfile,
	LiquidGlassPresetDefinition,
	LiquidGlassSettings,
	LiquidGlassVisualSettings,
	PresetSelection,
} from './types'

const HEX_PATTERN = /^#?([a-f\d]{3}|[a-f\d]{6})$/i
const DISCORD_HEX_PATTERN = /^#[A-F\d]{6}(?:[A-F\d]{2})?$/

function definePreset(
	id: BuiltInPresetId,
	label: string,
	description: string,
	backgroundEnabled: boolean,
	values: LiquidGlassVisualSettings,
): LiquidGlassPresetDefinition {
	const gradientColors = Object.freeze([
		...values.gradientColors,
	]) as unknown as GradientColors
	return Object.freeze({
		id,
		label,
		description,
		backgroundEnabled,
		values: Object.freeze({ ...values, gradientColors }),
	})
}

export const BUILT_IN_PRESETS: Readonly<
	Record<BuiltInPresetId, LiquidGlassPresetDefinition>
> = Object.freeze({
	midnight: definePreset(
		'midnight',
		'Midnight',
		'Deep indigo glass with a soft violet glow.',
		true,
		{
			gradientColors: ['#080A12', '#171B2C', '#30275D'],
			panelColor: '#171B27',
			tintColor: '#343A65',
			accentColor: '#7C8CFF',
			textColor: '#F7F8FF',
			borderColor: '#FFFFFF',
			panelOpacity: 0.55,
			raisedOpacity: 0.72,
			profileOpacity: 0.42,
			overlayOpacity: 0.68,
			controlOpacity: 0.5,
			backgroundSoftness: 0.62,
			angle: 135,
		},
	),
	frost: definePreset(
		'frost',
		'Frost',
		'Bright ice-blue glass that keeps text crisp and readable.',
		true,
		{
			gradientColors: ['#07111D', '#16344D', '#61788F'],
			panelColor: '#D9ECFA',
			tintColor: '#BFE5FF',
			accentColor: '#8ACBFF',
			textColor: '#F8FCFF',
			borderColor: '#FFFFFF',
			panelOpacity: 0.17,
			raisedOpacity: 0.28,
			profileOpacity: 0.14,
			overlayOpacity: 0.25,
			controlOpacity: 0.2,
			backgroundSoftness: 0.78,
			angle: 150,
		},
	),
	ocean: definePreset(
		'ocean',
		'Ocean',
		'Deep teal surfaces with a clear cyan current.',
		true,
		{
			gradientColors: ['#02111D', '#063B56', '#087E8B'],
			panelColor: '#06283C',
			tintColor: '#0F6D8F',
			accentColor: '#34D6FF',
			textColor: '#F2FCFF',
			borderColor: '#BCEEFF',
			panelOpacity: 0.57,
			raisedOpacity: 0.74,
			profileOpacity: 0.44,
			overlayOpacity: 0.7,
			controlOpacity: 0.52,
			backgroundSoftness: 0.66,
			angle: 145,
		},
	),
	rose: definePreset(
		'rose',
		'Rose',
		'Warm berry glass with a polished pink highlight.',
		true,
		{
			gradientColors: ['#170812', '#48182E', '#8A3C61'],
			panelColor: '#2A101E',
			tintColor: '#7A294D',
			accentColor: '#FF7FB7',
			textColor: '#FFF6FA',
			borderColor: '#FFD3E7',
			panelOpacity: 0.58,
			raisedOpacity: 0.75,
			profileOpacity: 0.45,
			overlayOpacity: 0.72,
			controlOpacity: 0.52,
			backgroundSoftness: 0.64,
			angle: 130,
		},
	),
	aurora: definePreset(
		'aurora',
		'Aurora',
		'Emerald and violet light layered over dark glass.',
		true,
		{
			gradientColors: ['#06130F', '#123C32', '#30245F'],
			panelColor: '#0C211C',
			tintColor: '#236452',
			accentColor: '#A889FF',
			textColor: '#F6FFFC',
			borderColor: '#C8FFE9',
			panelOpacity: 0.54,
			raisedOpacity: 0.71,
			profileOpacity: 0.42,
			overlayOpacity: 0.68,
			controlOpacity: 0.5,
			backgroundSoftness: 0.7,
			angle: 120,
		},
	),
	amoled: definePreset(
		'amoled',
		'AMOLED',
		'Pure black foundations with restrained glass highlights.',
		false,
		{
			gradientColors: ['#000000', '#000000', '#080808'],
			panelColor: '#050505',
			tintColor: '#121212',
			accentColor: '#7C8CFF',
			textColor: '#FFFFFF',
			borderColor: '#FFFFFF',
			panelOpacity: 0.86,
			raisedOpacity: 0.94,
			profileOpacity: 0.82,
			overlayOpacity: 0.9,
			controlOpacity: 0.86,
			backgroundSoftness: 0,
			angle: 180,
		},
	),
})

function cloneVisualSettings(
	values: Readonly<LiquidGlassVisualSettings>,
): LiquidGlassVisualSettings {
	return {
		gradientColors: [...values.gradientColors],
		panelColor: values.panelColor,
		tintColor: values.tintColor,
		accentColor: values.accentColor,
		textColor: values.textColor,
		borderColor: values.borderColor,
		panelOpacity: values.panelOpacity,
		raisedOpacity: values.raisedOpacity,
		profileOpacity: values.profileOpacity,
		overlayOpacity: values.overlayOpacity,
		controlOpacity: values.controlOpacity,
		backgroundSoftness: values.backgroundSoftness,
		angle: values.angle,
	}
}

const midnight = BUILT_IN_PRESETS.midnight

export const DEFAULT_SETTINGS: Readonly<LiquidGlassSettings> = Object.freeze({
	schemaVersion: SETTINGS_SCHEMA_VERSION,
	enabled: true,
	selectedPreset: 'midnight',
	...cloneVisualSettings(midnight.values),
	gradientColors: Object.freeze([
		...midnight.values.gradientColors,
	]) as unknown as GradientColors,
	backgroundEnabled: midnight.backgroundEnabled,
	semanticEnabled: true,
	profileGlassEnabled: true,
	overlayGlassEnabled: true,
	controlGlassEnabled: true,
	lowPowerMode: false,
	customProfiles: Object.freeze([]) as unknown as LiquidGlassCustomProfile[],
	activeProfileId: null,
})

export function clamp(
	value: unknown,
	minimum: number,
	maximum: number,
): number {
	const numeric =
		typeof value === 'number' || typeof value === 'string'
			? Number(value)
			: Number.NaN
	if (!Number.isFinite(numeric)) return minimum
	return Math.min(maximum, Math.max(minimum, numeric))
}

function finiteNumberOr(value: unknown, fallback: number): number {
	if (
		value === '' ||
		(typeof value !== 'number' && typeof value !== 'string')
	) {
		return fallback
	}
	const numeric = Number(value)
	return Number.isFinite(numeric) ? numeric : fallback
}

function roundedClamp(
	value: unknown,
	fallback: number,
	minimum: number,
	maximum: number,
	precision: number,
): number {
	const scale = 10 ** precision
	return (
		Math.round(
			clamp(finiteNumberOr(value, fallback), minimum, maximum) * scale,
		) / scale
	)
}

export function normalizeHexColor(
	value: unknown,
	fallback: HexColor = '#000000',
): HexColor {
	const candidate = typeof value === 'string' ? value.trim() : ''
	const match = HEX_PATTERN.exec(candidate)
	if (!match) {
		const safeFallback = HEX_PATTERN.exec(fallback.trim())
		return safeFallback ? expandHex(safeFallback[1]) : ('#000000' as HexColor)
	}
	return expandHex(match[1])
}

function expandHex(value: string): HexColor {
	const expanded =
		value.length === 3
			? value
					.split('')
					.map(character => character.repeat(2))
					.join('')
			: value
	return `#${expanded.toUpperCase()}` as HexColor
}

export function hexToRgba(value: unknown, opacity: unknown = 1): string {
	const hex = normalizeHexColor(value)
	const red = Number.parseInt(hex.slice(1, 3), 16)
	const green = Number.parseInt(hex.slice(3, 5), 16)
	const blue = Number.parseInt(hex.slice(5, 7), 16)
	const alpha = roundedClamp(opacity, 1, 0, 1, 3)
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

/** Discord-compatible #RRGGBBAA for semantic colors that need transparency. */
export function hexWithAlpha(value: unknown, opacity: unknown = 1): HexColor {
	const hex = normalizeHexColor(value)
	const alpha = Math.floor(roundedClamp(opacity, 1, 0, 1, 3) * 255)
		.toString(16)
		.padStart(2, '0')
		.toUpperCase()
	return `${hex}${alpha}` as HexColor
}

export function isDiscordHexColor(value: unknown): value is HexColor {
	return typeof value === 'string' && DISCORD_HEX_PATTERN.test(value)
}

/** Never lets a malformed plugin value escape into Discord's global resolver. */
export function safeSemanticOverride(
	name: string | undefined,
	overrides: Readonly<Record<string, string>>,
): string | undefined {
	if (!name) return undefined
	const candidate = overrides[name]
	return isDiscordHexColor(candidate) ? candidate : undefined
}

function booleanOr(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback
}

function presetSelectionOr(value: unknown): PresetSelection {
	if (value === 'custom') return value
	return BUILT_IN_PRESET_IDS.includes(value as BuiltInPresetId)
		? (value as BuiltInPresetId)
		: DEFAULT_SETTINGS.selectedPreset
}

function normalizeGradient(
	value: unknown,
	fallback: readonly HexColor[],
): GradientColors {
	if (!Array.isArray(value) || value.length !== 3) {
		return [fallback[0], fallback[1], fallback[2]]
	}
	return [
		normalizeHexColor(value[0], fallback[0]),
		normalizeHexColor(value[1], fallback[1]),
		normalizeHexColor(value[2], fallback[2]),
	]
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}
}

function normalizeVisualSettings(
	raw: Record<string, unknown>,
	fallback: Readonly<LiquidGlassVisualSettings>,
): LiquidGlassVisualSettings {
	return {
		gradientColors: normalizeGradient(
			raw.gradientColors ?? raw.gradient,
			fallback.gradientColors,
		),
		panelColor: normalizeHexColor(raw.panelColor, fallback.panelColor),
		tintColor: normalizeHexColor(raw.tintColor, fallback.tintColor),
		accentColor: normalizeHexColor(raw.accentColor, fallback.accentColor),
		textColor: normalizeHexColor(raw.textColor, fallback.textColor),
		borderColor: normalizeHexColor(raw.borderColor, fallback.borderColor),
		panelOpacity: roundedClamp(
			raw.panelOpacity ?? raw.glassOpacity,
			fallback.panelOpacity,
			0,
			1,
			3,
		),
		raisedOpacity: roundedClamp(
			raw.raisedOpacity,
			fallback.raisedOpacity,
			0,
			1,
			3,
		),
		profileOpacity: roundedClamp(
			raw.profileOpacity,
			fallback.profileOpacity,
			0,
			1,
			3,
		),
		overlayOpacity: roundedClamp(
			raw.overlayOpacity,
			fallback.overlayOpacity,
			0,
			1,
			3,
		),
		controlOpacity: roundedClamp(
			raw.controlOpacity,
			fallback.controlOpacity,
			0,
			1,
			3,
		),
		backgroundSoftness: roundedClamp(
			raw.backgroundSoftness ?? raw.softness,
			fallback.backgroundSoftness,
			0,
			1,
			3,
		),
		angle: roundedClamp(raw.angle, fallback.angle, 0, 360, 0),
	}
}

export const MAX_CUSTOM_PROFILES = 20

function normalizeProfileId(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 32)
	return normalized || undefined
}

function normalizeProfileName(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined
	const normalized = value.replace(/\s+/g, ' ').trim().slice(0, 32)
	return normalized || undefined
}

export function normalizeCustomProfiles(
	value: unknown,
): LiquidGlassCustomProfile[] {
	if (!Array.isArray(value)) return []
	const profiles = new Map<string, LiquidGlassCustomProfile>()
	for (const candidate of value) {
		const raw = objectOrEmpty(candidate)
		const id = normalizeProfileId(raw.id)
		const name = normalizeProfileName(raw.name)
		if (!id || !name) continue
		const nested = objectOrEmpty(raw.values)
		const visual = normalizeVisualSettings(
			{ ...nested, ...raw },
			BUILT_IN_PRESETS.midnight.values,
		)
		const profile: LiquidGlassCustomProfile = {
			id,
			name,
			...visual,
			backgroundEnabled: booleanOr(raw.backgroundEnabled, true),
		}
		profiles.delete(id)
		profiles.set(id, profile)
	}
	return [...profiles.values()].slice(-MAX_CUSTOM_PROFILES)
}

/**
 * Migrates unknown/older storage into a complete settings object. Stored values
 * are never returned by reference, which keeps presets and defaults immutable.
 */
export function normalizeSettings(value: unknown): LiquidGlassSettings {
	const raw = objectOrEmpty(value)
	const selectedPreset = presetSelectionOr(
		raw.selectedPreset ?? raw.preset ?? raw.presetId,
	)
	const presetFallback =
		selectedPreset === 'custom'
			? BUILT_IN_PRESETS.midnight
			: BUILT_IN_PRESETS[selectedPreset]
	const fallback = presetFallback.values
	const visual = normalizeVisualSettings(raw, fallback)
	const customProfiles = normalizeCustomProfiles(raw.customProfiles)
	const candidateActiveProfileId = normalizeProfileId(raw.activeProfileId)
	const activeProfileId = customProfiles.some(
		profile => profile.id === candidateActiveProfileId,
	)
		? (candidateActiveProfileId ?? null)
		: null

	return {
		schemaVersion: SETTINGS_SCHEMA_VERSION,
		enabled: booleanOr(raw.enabled, DEFAULT_SETTINGS.enabled),
		selectedPreset,
		...visual,
		backgroundEnabled: booleanOr(
			raw.backgroundEnabled ?? raw.useBackground,
			presetFallback.backgroundEnabled,
		),
		semanticEnabled: booleanOr(
			raw.semanticEnabled ?? raw.applySemanticColors,
			DEFAULT_SETTINGS.semanticEnabled,
		),
		profileGlassEnabled: booleanOr(
			raw.profileGlassEnabled,
			DEFAULT_SETTINGS.profileGlassEnabled,
		),
		overlayGlassEnabled: booleanOr(
			raw.overlayGlassEnabled,
			DEFAULT_SETTINGS.overlayGlassEnabled,
		),
		controlGlassEnabled: booleanOr(
			raw.controlGlassEnabled,
			DEFAULT_SETTINGS.controlGlassEnabled,
		),
		lowPowerMode: booleanOr(raw.lowPowerMode, DEFAULT_SETTINGS.lowPowerMode),
		customProfiles,
		activeProfileId,
	}
}

/** Applies a built-in look while preserving feature, bridge, and power toggles. */
export function applyPreset(
	current: unknown,
	presetId: BuiltInPresetId,
): LiquidGlassSettings {
	const normalized = normalizeSettings(current)
	const preset = BUILT_IN_PRESETS[presetId] ?? BUILT_IN_PRESETS.midnight
	return {
		...normalized,
		selectedPreset: preset.id,
		...cloneVisualSettings(preset.values),
		backgroundEnabled: preset.backgroundEnabled,
		activeProfileId: null,
	}
}

/** Applies visual edits and marks the look as custom without mutating storage. */
export function applyCustomSettings(
	current: unknown,
	changes: Partial<LiquidGlassVisualSettings> & {
		backgroundEnabled?: boolean
	},
): LiquidGlassSettings {
	return normalizeSettings({
		...normalizeSettings(current),
		...changes,
		selectedPreset: 'custom',
		activeProfileId: null,
	})
}

function availableProfileId(
	name: string,
	profiles: readonly LiquidGlassCustomProfile[],
): string {
	const base = normalizeProfileId(name) ?? 'custom-glass'
	const ids = new Set(profiles.map(profile => profile.id))
	if (!ids.has(base)) return base
	for (let suffix = 2; suffix < 10_000; suffix += 1) {
		const marker = `-${suffix}`
		const candidate = `${base.slice(0, 32 - marker.length)}${marker}`
		if (!ids.has(candidate)) return candidate
	}
	return `profile-${profiles.length + 1}`
}

/** Saves a normalized snapshot, replacing the same explicit ID when supplied. */
export function saveCustomProfile(
	current: unknown,
	name: string,
	profileId?: string,
): LiquidGlassSettings {
	const settings = normalizeSettings(current)
	const safeName = normalizeProfileName(name) ?? 'Custom Glass'
	const explicitId = normalizeProfileId(profileId)
	const id = explicitId ?? availableProfileId(safeName, settings.customProfiles)
	const profile: LiquidGlassCustomProfile = {
		id,
		name: safeName,
		...cloneVisualSettings(settings),
		backgroundEnabled: settings.backgroundEnabled,
	}
	const customProfiles = settings.customProfiles
		.filter(existing => existing.id !== id)
		.concat(profile)
		.slice(-MAX_CUSTOM_PROFILES)
	return {
		...settings,
		selectedPreset: 'custom',
		customProfiles,
		activeProfileId: id,
	}
}

export function applyCustomProfile(
	current: unknown,
	profileId: string,
): LiquidGlassSettings {
	const settings = normalizeSettings(current)
	const id = normalizeProfileId(profileId)
	const profile = settings.customProfiles.find(candidate => candidate.id === id)
	if (!profile) return settings
	return {
		...settings,
		selectedPreset: 'custom',
		...cloneVisualSettings(profile),
		backgroundEnabled: profile.backgroundEnabled,
		activeProfileId: profile.id,
	}
}

export function removeCustomProfile(
	current: unknown,
	profileId: string,
): LiquidGlassSettings {
	const settings = normalizeSettings(current)
	const id = normalizeProfileId(profileId)
	return {
		...settings,
		customProfiles: settings.customProfiles.filter(
			profile => profile.id !== id,
		),
		activeProfileId:
			settings.activeProfileId === id ? null : settings.activeProfileId,
	}
}

export const BASE_SEMANTIC_COLOR_KEYS = [
	'BACKGROUND_BASE_LOWEST',
	'BACKGROUND_BASE_LOWER',
	'BACKGROUND_BASE_LOW',
	'BACKGROUND_SECONDARY_ALT',
	'BACKGROUND_SURFACE_HIGH',
	'BACKGROUND_SURFACE_HIGHEST',
	'BG_SURFACE_RAISED',
	'CARD_BACKGROUND_DEFAULT',
	'CARD_SECONDARY_BG',
	'CARD_SECONDARY_BACKGROUND_DEFAULT',
	'CHANNEL_BACKGROUND_DEFAULT',
	'STANDALONE_CHANNEL_CONTENT_BACKGROUND',
	'PANEL_BG',
	'BACKGROUND_ACCENT',
	'BACKGROUND_CODE',
	'BACKGROUND_APP_LAUNCHER_CARD_DEFAULT',
	'BACKGROUND_APP_LAUNCHER_ROW_DEFAULT',
	'GUILD_FOLDER_BACKGROUND',
	'CHAT_BANNER_BG',
	'EMBED_BACKGROUND',
	'EMBED_BACKGROUND_ALTERNATE',
	'MOBILE_EMBED_BACKGROUND_DEFAULT',
	'MOBILE_THREAD_EMBED_BACKGROUND',
	'MOBILE_VOICE_PANEL_BACKGROUND',
	'MOBILE_VOICE_PANEL_BADGE_BACKGROUND',
	'VOICE_VIDEO_VIDEO_TILE_BACKGROUND',
	'VOICE_VIDEO_VIDEO_TILE_BLUR_FALLBACK',
	'ANDROID_NAVIGATION_BAR_BACKGROUND',
	'ANDROID_NAVIGATION_SCRIM_BACKGROUND',
] as const

export const PROFILE_SEMANTIC_COLOR_KEYS = [
	'USER_PROFILE_CONTAINER_BACKGROUND',
	'USER_PROFILE_GRADIENT_BACKGROUND',
	'CARD_MUTED_BG',
	'CARD_MUTED_PRESSED_BG',
	'BACKGROUND_MOD_MUTED',
	'BACKGROUND_MOD_NORMAL',
	'BACKGROUND_MOD_STRONG',
	'BACKGROUND_MOD_SUBTLE',
	'PROFILE_GRADIENT_NOTE_BACKGROUND',
	'PROFILE_GRADIENT_OVERLAY',
	'PROFILE_GRADIENT_OVERLAY_SYNCED_WITH_USER_THEME',
	'PROFILE_GRADIENT_ROLE_PILL_BACKGROUND',
	'PROFILE_GRADIENT_ROLE_PILL_BORDER',
	'PROFILE_GRADIENT_SECTION_BOX',
	'CUSTOM_STATUS_BUBBLE_BG',
	'GUILD_PROFILE_BANNER_BACKGROUND_DEFAULT',
] as const

export const OVERLAY_SEMANTIC_COLOR_KEYS = [
	'MODAL_BACKGROUND',
	'MODAL_FOOTER_BACKGROUND',
	'MOBILE_ACTIONSHEET_BACKGROUND',
	'MOBILE_ACTIONSHEET_GRADIENT_BACKGROUND_DEFAULT',
	'MOBILE_ALERT_BACKGROUND_DEFAULT',
	'MOBILE_FLOATINGBAR_BACKGROUND',
	'MOBILE_FLOATINGBAR_BACKGROUND_HIGHER',
	'MOBILE_FLOATINGBAR_BACKGROUND_NAMEPLATE',
	'MOBILE_FLOATINGBAR_BACKGROUND_SCRIM',
	'MOBILE_EXPRESSION_PICKER_BACKGROUND_DEFAULT',
	'MOBILE_KEYBOARD_PANEL_BACKGROUND',
	'MOBILE_KEYBOARD_GAP_BACKGROUND',
	'MOBILE_COMMAND_BAR_BACKGROUND',
	'MOBILE_COMMAND_CATEGORIES_BACKGROUND',
	'MOBILE_SEARCHBAR_GRADIENT_BACKGROUND',
	'MOBILE_TOAST_BACKGROUND_DEFAULT',
	'MOBILE_COACHMARK_BACKGROUND_DEFAULT',
	'CONTEXT_MENU_BACKDROP_BACKGROUND',
	'BACKGROUND_SCRIM',
	'BACKGROUND_SCRIM_LIGHTBOX',
	'OVERLAY_BACKDROP_LIGHTBOX',
	'BLUR_FALLBACK',
	'BLUR_FALLBACK_PRESSED',
	'LEGACY_ANDROID_BLUR_OVERLAY_DEFAULT',
	'LEGACY_ANDROID_BLUR_OVERLAY_ULTRA_THIN',
	'LEGACY_BLUR_FALLBACK_DEFAULT',
	'LEGACY_BLUR_FALLBACK_ULTRA_THIN',
	'THEME_LOCKED_BLUR_FALLBACK',
] as const

export const CONTROL_SEMANTIC_COLOR_KEYS = [
	'TAB_BAR_BACKGROUND',
	'CHANNELTEXTAREA_BACKGROUND',
	'CHAT_INPUT_BACKGROUND',
	'REDESIGN_CHAT_INPUT_BACKGROUND',
	'INPUT_BACKGROUND_DEFAULT',
	'MOBILE_CHATINPUT_BACKGROUND_DEFAULT',
	'MOBILE_CHATINPUT_BACKGROUND_ACTIVE',
	'SHARE_CHAT_INPUT_BACKGROUND',
	'CHAT_INPUT_ACTION_BUTTON_BACKGROUND',
	'MOBILE_EMOJI_BUTTON_BACKGROUND',
	'MOBILE_FLOATING_ACCESSORY_BACKGROUND',
	'MOBILE_SEGMENTED_CONTROL_BACKGROUND',
	'MOBILE_SEGMENTED_CONTROL_INDICATOR_BACKGROUND',
	'MOBILE_GUILDBAR_ICON_BACKGROUND_DEFAULT',
	'MOBILE_LEGACY_BUTTON_SECONDARY_BACKGROUND_DEFAULT',
	'TABLEROW_BACKGROUND_DEFAULT',
	'TABLEROW_BACKGROUND_PRESSED',
	'INTERACTIVE_BACKGROUND_DEFAULT',
	'INTERACTIVE_BACKGROUND_HOVER',
	'INTERACTIVE_BACKGROUND_ACTIVE',
	'INTERACTIVE_BACKGROUND_SELECTED',
	'CONTROL_PRIMARY_BACKGROUND_DEFAULT',
	'CONTROL_PRIMARY_BACKGROUND_ACTIVE',
	'CONTROL_SECONDARY_BACKGROUND_DEFAULT',
	'CONTROL_SECONDARY_BACKGROUND_ACTIVE',
	'CONTROL_ICON_ONLY_BACKGROUND_ACTIVE',
	'CONTROL_OVERLAY_PRIMARY_BACKGROUND_DEFAULT',
	'CONTROL_OVERLAY_PRIMARY_BACKGROUND_ACTIVE',
	'CONTROL_OVERLAY_SECONDARY_BACKGROUND_DEFAULT',
	'CONTROL_OVERLAY_SECONDARY_BACKGROUND_ACTIVE',
	'REDESIGN_BUTTON_TERTIARY_BACKGROUND',
	'REDESIGN_BUTTON_TERTIARY_PRESSED_BACKGROUND',
	'REDESIGN_IMAGE_BUTTON_PRESSED_BACKGROUND',
	'REDESIGN_INPUT_CONTROL_ACTIVE_BG',
	'REDESIGN_INPUT_CONTROL_SELECTED',
	'CARD_PRIMARY_PRESSED_BG',
	'CARD_SECONDARY_BACKGROUND_ACTIVE',
	'CARD_SECONDARY_PRESSED_BG',
	'MOBILE_CHANNEL_ITEM_BACKGROUND_SELECTED',
	'BACKGROUND_VOICE_MUTED',
] as const

export const CONTENT_SEMANTIC_COLOR_KEYS = [
	'TEXT_DEFAULT',
	'TEXT_STRONG',
	'TEXT_MUTED',
	'TEXT_SUBTLE',
	'BORDER_MUTED',
	'BORDER_NORMAL',
	'BORDER_SUBTLE',
	'BORDER_STRONG',
	'TEXT_BRAND',
	'CONTROL_BRAND_FOREGROUND',
	'CONTROL_BRAND_FOREGROUND_NEW',
	'ICON_DEFAULT',
	'ICON_STRONG',
	'ICON_MUTED',
	'ICON_SUBTLE',
] as const

export const SEMANTIC_COLOR_KEYS = [
	...BASE_SEMANTIC_COLOR_KEYS,
	...PROFILE_SEMANTIC_COLOR_KEYS,
	...OVERLAY_SEMANTIC_COLOR_KEYS,
	...CONTROL_SEMANTIC_COLOR_KEYS,
	...CONTENT_SEMANTIC_COLOR_KEYS,
] as const

export type LiquidGlassSemanticKey = (typeof SEMANTIC_COLOR_KEYS)[number]

export function isLiquidGlassSemanticKey(
	value: unknown,
): value is LiquidGlassSemanticKey {
	return (
		typeof value === 'string' &&
		(SEMANTIC_COLOR_KEYS as readonly string[]).includes(value)
	)
}

function semanticColor(value: HexColor, opacity: number): HexColor {
	return hexWithAlpha(value, opacity)
}

const PROFILE_COLOR_FIELDS = [
	'gradientFallbackBackground',
	'gradientSecondaryBackground',
	'containerBackground',
	'containerBorderColor',
	'avatarBackground',
	'statusBackground',
] as const

/** Converts a supported Discord color to alpha hex while preserving its RGB. */
export function replaceDiscordHexAlpha(
	value: unknown,
	opacity: unknown,
): unknown {
	if (typeof value !== 'string') return value
	const candidate = value.trim()
	const rgba =
		/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0?(?:\.\d+)|1(?:\.0+)?))?\s*\)$/i.exec(
			candidate,
		)
	if (rgba) {
		const channels = rgba.slice(1, 4).map(Number)
		if (channels.every(channel => channel >= 0 && channel <= 255)) {
			const rgb = channels
				.map(channel => channel.toString(16).padStart(2, '0'))
				.join('')
			return hexWithAlpha(`#${rgb}`, opacity)
		}
		return value
	}

	const hex = /^#?([A-F\d]{3}|[A-F\d]{4}|[A-F\d]{6}|[A-F\d]{8})$/i.exec(
		candidate,
	)
	if (!hex) return value
	const source = hex[1]
	const rgb =
		source.length === 3 || source.length === 4
			? source
					.slice(0, 3)
					.split('')
					.map(character => character.repeat(2))
					.join('')
			: source.slice(0, 6)
	return hexWithAlpha(`#${rgb}`, opacity)
}

/** Makes Discord's final profile color object translucent without changing hue. */
export function applyProfileGlassToColors(
	settings: LiquidGlassSettings,
	result: unknown,
): unknown {
	if (
		!settings.enabled ||
		!settings.semanticEnabled ||
		!settings.profileGlassEnabled ||
		!result ||
		typeof result !== 'object' ||
		Array.isArray(result)
	) {
		return result
	}

	const original = result as Record<string, unknown>
	let changed = false
	const next = { ...original }
	for (const field of PROFILE_COLOR_FIELDS) {
		if (!(field in original)) continue
		const opacity =
			field === 'containerBorderColor'
				? Math.min(0.42, settings.profileOpacity * 0.7)
				: settings.profileOpacity
		const color = replaceDiscordHexAlpha(original[field], opacity)
		if (color !== original[field]) {
			next[field] = color
			changed = true
		}
	}
	return changed ? next : result
}

/** Makes Discord's own/member profile gradient translucent without mutation. */
export function applyProfileGlassToGradient(
	settings: LiquidGlassSettings,
	result: unknown,
): unknown {
	if (
		!settings.enabled ||
		!settings.semanticEnabled ||
		!settings.profileGlassEnabled ||
		!Array.isArray(result)
	) {
		return result
	}
	let changed = false
	const next = result.map(color => {
		const updated = replaceDiscordHexAlpha(color, settings.profileOpacity)
		if (updated !== color) changed = true
		return updated
	})
	return changed ? next : result
}

/**
 * Builds only audited Discord 347 UPPER_SNAKE tokens. The global semantic
 * resolver must return hex because Discord passes some resolved values through
 * hexWithOpacity. #RRGGBBAA preserves transparency and is supported by that
 * helper; rgba() is not.
 */
export function buildSemanticOverrides(value: unknown): Record<string, string> {
	const settings = normalizeSettings(value)
	if (!settings.enabled || !settings.semanticEnabled) return {}

	const panel = settings.panelColor
	const raised = settings.tintColor
	const baseOpacity = settings.panelOpacity
	const raisedOpacity = settings.raisedOpacity
	const text = settings.textColor
	const border = settings.borderColor
	const accent = settings.accentColor

	const overrides: Record<string, string> = {
		BACKGROUND_BASE_LOWEST: semanticColor(panel, baseOpacity * 0.44),
		BACKGROUND_BASE_LOWER: semanticColor(panel, baseOpacity * 0.64),
		BACKGROUND_BASE_LOW: semanticColor(panel, baseOpacity * 0.82),
		BACKGROUND_SECONDARY_ALT: semanticColor(panel, baseOpacity),
		BACKGROUND_SURFACE_HIGH: semanticColor(panel, baseOpacity),
		BACKGROUND_SURFACE_HIGHEST: semanticColor(raised, raisedOpacity),
		BG_SURFACE_RAISED: semanticColor(raised, raisedOpacity),
		CARD_BACKGROUND_DEFAULT: semanticColor(panel, baseOpacity),
		CARD_SECONDARY_BG: semanticColor(panel, baseOpacity * 0.86),
		CARD_SECONDARY_BACKGROUND_DEFAULT: semanticColor(panel, baseOpacity * 0.86),
		CHANNEL_BACKGROUND_DEFAULT: semanticColor(panel, baseOpacity),
		STANDALONE_CHANNEL_CONTENT_BACKGROUND: semanticColor(panel, baseOpacity),
		PANEL_BG: semanticColor(panel, baseOpacity),
		BACKGROUND_ACCENT: semanticColor(raised, baseOpacity),
		BACKGROUND_CODE: semanticColor(panel, baseOpacity * 0.82),
		BACKGROUND_APP_LAUNCHER_CARD_DEFAULT: semanticColor(panel, baseOpacity),
		BACKGROUND_APP_LAUNCHER_ROW_DEFAULT: semanticColor(
			panel,
			baseOpacity * 0.82,
		),
		GUILD_FOLDER_BACKGROUND: semanticColor(panel, baseOpacity * 0.82),
		CHAT_BANNER_BG: semanticColor(panel, baseOpacity),
		EMBED_BACKGROUND: semanticColor(panel, baseOpacity),
		EMBED_BACKGROUND_ALTERNATE: semanticColor(panel, baseOpacity * 0.82),
		MOBILE_EMBED_BACKGROUND_DEFAULT: semanticColor(panel, baseOpacity),
		MOBILE_THREAD_EMBED_BACKGROUND: semanticColor(panel, baseOpacity),
		MOBILE_VOICE_PANEL_BACKGROUND: semanticColor(panel, baseOpacity),
		MOBILE_VOICE_PANEL_BADGE_BACKGROUND: semanticColor(raised, raisedOpacity),
		VOICE_VIDEO_VIDEO_TILE_BACKGROUND: semanticColor(panel, baseOpacity),
		VOICE_VIDEO_VIDEO_TILE_BLUR_FALLBACK: semanticColor(panel, baseOpacity),
		ANDROID_NAVIGATION_BAR_BACKGROUND: semanticColor(panel, baseOpacity),
		ANDROID_NAVIGATION_SCRIM_BACKGROUND: semanticColor(
			panel,
			baseOpacity * 0.74,
		),
	}

	if (settings.profileGlassEnabled) {
		const opacity = settings.profileOpacity
		Object.assign(overrides, {
			USER_PROFILE_CONTAINER_BACKGROUND: semanticColor(panel, opacity),
			USER_PROFILE_GRADIENT_BACKGROUND: semanticColor(panel, opacity),
			CARD_MUTED_BG: semanticColor(panel, opacity),
			CARD_MUTED_PRESSED_BG: semanticColor(raised, Math.min(1, opacity + 0.1)),
			BACKGROUND_MOD_MUTED: semanticColor(panel, opacity * 0.46),
			BACKGROUND_MOD_NORMAL: semanticColor(panel, opacity * 0.68),
			BACKGROUND_MOD_STRONG: semanticColor(raised, opacity),
			BACKGROUND_MOD_SUBTLE: semanticColor(panel, opacity * 0.3),
			PROFILE_GRADIENT_NOTE_BACKGROUND: semanticColor(panel, opacity),
			PROFILE_GRADIENT_OVERLAY: semanticColor(panel, opacity * 0.74),
			PROFILE_GRADIENT_OVERLAY_SYNCED_WITH_USER_THEME: semanticColor(
				panel,
				opacity * 0.74,
			),
			PROFILE_GRADIENT_ROLE_PILL_BACKGROUND: semanticColor(raised, opacity),
			PROFILE_GRADIENT_ROLE_PILL_BORDER: semanticColor(border, opacity * 0.55),
			PROFILE_GRADIENT_SECTION_BOX: semanticColor(panel, opacity),
			CUSTOM_STATUS_BUBBLE_BG: semanticColor(raised, opacity),
			GUILD_PROFILE_BANNER_BACKGROUND_DEFAULT: semanticColor(panel, opacity),
		})
	}

	if (settings.overlayGlassEnabled) {
		const opacity = settings.overlayOpacity
		const scrimOpacity = Math.max(0.48, opacity * 0.82)
		Object.assign(overrides, {
			MODAL_BACKGROUND: semanticColor(panel, opacity),
			MODAL_FOOTER_BACKGROUND: semanticColor(raised, opacity),
			MOBILE_ACTIONSHEET_BACKGROUND: semanticColor(raised, opacity),
			MOBILE_ACTIONSHEET_GRADIENT_BACKGROUND_DEFAULT: semanticColor(
				panel,
				opacity,
			),
			MOBILE_ALERT_BACKGROUND_DEFAULT: semanticColor(raised, opacity),
			MOBILE_FLOATINGBAR_BACKGROUND: semanticColor(raised, opacity),
			MOBILE_FLOATINGBAR_BACKGROUND_HIGHER: semanticColor(raised, opacity),
			MOBILE_FLOATINGBAR_BACKGROUND_NAMEPLATE: semanticColor(panel, opacity),
			MOBILE_FLOATINGBAR_BACKGROUND_SCRIM: semanticColor(panel, scrimOpacity),
			MOBILE_EXPRESSION_PICKER_BACKGROUND_DEFAULT: semanticColor(
				panel,
				opacity,
			),
			MOBILE_KEYBOARD_PANEL_BACKGROUND: semanticColor(raised, opacity),
			MOBILE_KEYBOARD_GAP_BACKGROUND: semanticColor(panel, opacity),
			MOBILE_COMMAND_BAR_BACKGROUND: semanticColor(raised, opacity),
			MOBILE_COMMAND_CATEGORIES_BACKGROUND: semanticColor(panel, opacity),
			MOBILE_SEARCHBAR_GRADIENT_BACKGROUND: semanticColor(panel, opacity),
			MOBILE_TOAST_BACKGROUND_DEFAULT: semanticColor(raised, opacity),
			MOBILE_COACHMARK_BACKGROUND_DEFAULT: semanticColor(raised, opacity),
			CONTEXT_MENU_BACKDROP_BACKGROUND: semanticColor(panel, scrimOpacity),
			BACKGROUND_SCRIM: semanticColor(panel, scrimOpacity),
			BACKGROUND_SCRIM_LIGHTBOX: semanticColor(panel, Math.max(0.66, opacity)),
			OVERLAY_BACKDROP_LIGHTBOX: semanticColor(panel, Math.max(0.66, opacity)),
			BLUR_FALLBACK: semanticColor(raised, opacity),
			BLUR_FALLBACK_PRESSED: semanticColor(raised, Math.min(1, opacity + 0.1)),
			LEGACY_ANDROID_BLUR_OVERLAY_DEFAULT: semanticColor(raised, opacity),
			LEGACY_ANDROID_BLUR_OVERLAY_ULTRA_THIN: semanticColor(
				panel,
				opacity * 0.55,
			),
			LEGACY_BLUR_FALLBACK_DEFAULT: semanticColor(raised, opacity),
			LEGACY_BLUR_FALLBACK_ULTRA_THIN: semanticColor(panel, opacity * 0.55),
			THEME_LOCKED_BLUR_FALLBACK: semanticColor(raised, opacity),
		})
	}

	if (settings.controlGlassEnabled) {
		const opacity = settings.controlOpacity
		const pressed = Math.min(1, opacity + 0.12)
		Object.assign(overrides, {
			TAB_BAR_BACKGROUND: semanticColor(raised, opacity),
			CHANNELTEXTAREA_BACKGROUND: semanticColor(raised, opacity),
			CHAT_INPUT_BACKGROUND: semanticColor(raised, opacity),
			REDESIGN_CHAT_INPUT_BACKGROUND: semanticColor(raised, opacity),
			INPUT_BACKGROUND_DEFAULT: semanticColor(raised, opacity),
			MOBILE_CHATINPUT_BACKGROUND_DEFAULT: semanticColor(raised, opacity),
			MOBILE_CHATINPUT_BACKGROUND_ACTIVE: semanticColor(raised, pressed),
			SHARE_CHAT_INPUT_BACKGROUND: semanticColor(raised, opacity),
			CHAT_INPUT_ACTION_BUTTON_BACKGROUND: semanticColor(raised, opacity),
			MOBILE_EMOJI_BUTTON_BACKGROUND: semanticColor(raised, opacity),
			MOBILE_FLOATING_ACCESSORY_BACKGROUND: semanticColor(raised, opacity),
			MOBILE_SEGMENTED_CONTROL_BACKGROUND: semanticColor(panel, opacity),
			MOBILE_SEGMENTED_CONTROL_INDICATOR_BACKGROUND: semanticColor(
				raised,
				pressed,
			),
			MOBILE_GUILDBAR_ICON_BACKGROUND_DEFAULT: semanticColor(panel, opacity),
			MOBILE_LEGACY_BUTTON_SECONDARY_BACKGROUND_DEFAULT: semanticColor(
				raised,
				opacity,
			),
			TABLEROW_BACKGROUND_DEFAULT: semanticColor(panel, opacity),
			TABLEROW_BACKGROUND_PRESSED: semanticColor(raised, pressed),
			INTERACTIVE_BACKGROUND_DEFAULT: semanticColor(panel, opacity * 0.62),
			INTERACTIVE_BACKGROUND_HOVER: semanticColor(raised, opacity),
			INTERACTIVE_BACKGROUND_ACTIVE: semanticColor(raised, pressed),
			INTERACTIVE_BACKGROUND_SELECTED: semanticColor(raised, pressed),
			CONTROL_PRIMARY_BACKGROUND_DEFAULT: semanticColor(raised, opacity),
			CONTROL_PRIMARY_BACKGROUND_ACTIVE: semanticColor(raised, pressed),
			CONTROL_SECONDARY_BACKGROUND_DEFAULT: semanticColor(panel, opacity),
			CONTROL_SECONDARY_BACKGROUND_ACTIVE: semanticColor(raised, pressed),
			CONTROL_ICON_ONLY_BACKGROUND_ACTIVE: semanticColor(raised, pressed),
			CONTROL_OVERLAY_PRIMARY_BACKGROUND_DEFAULT: semanticColor(
				raised,
				opacity,
			),
			CONTROL_OVERLAY_PRIMARY_BACKGROUND_ACTIVE: semanticColor(raised, pressed),
			CONTROL_OVERLAY_SECONDARY_BACKGROUND_DEFAULT: semanticColor(
				panel,
				opacity,
			),
			CONTROL_OVERLAY_SECONDARY_BACKGROUND_ACTIVE: semanticColor(
				raised,
				pressed,
			),
			REDESIGN_BUTTON_TERTIARY_BACKGROUND: semanticColor(panel, opacity),
			REDESIGN_BUTTON_TERTIARY_PRESSED_BACKGROUND: semanticColor(
				raised,
				pressed,
			),
			REDESIGN_IMAGE_BUTTON_PRESSED_BACKGROUND: semanticColor(raised, pressed),
			REDESIGN_INPUT_CONTROL_ACTIVE_BG: semanticColor(raised, pressed),
			REDESIGN_INPUT_CONTROL_SELECTED: semanticColor(raised, pressed),
			CARD_PRIMARY_PRESSED_BG: semanticColor(raised, pressed),
			CARD_SECONDARY_BACKGROUND_ACTIVE: semanticColor(raised, pressed),
			CARD_SECONDARY_PRESSED_BG: semanticColor(raised, pressed),
			MOBILE_CHANNEL_ITEM_BACKGROUND_SELECTED: semanticColor(raised, pressed),
			BACKGROUND_VOICE_MUTED: semanticColor(panel, opacity),
		})
	}

	Object.assign(overrides, {
		TEXT_DEFAULT: semanticColor(text, 1),
		TEXT_STRONG: semanticColor(text, 1),
		TEXT_MUTED: semanticColor(text, 0.72),
		TEXT_SUBTLE: semanticColor(text, 0.58),
		BORDER_MUTED: semanticColor(border, 0.1),
		BORDER_NORMAL: semanticColor(border, 0.18),
		BORDER_SUBTLE: semanticColor(border, 0.14),
		BORDER_STRONG: semanticColor(border, 0.22),
		TEXT_BRAND: semanticColor(accent, 1),
		CONTROL_BRAND_FOREGROUND: semanticColor(accent, 1),
		CONTROL_BRAND_FOREGROUND_NEW: semanticColor(accent, 1),
		ICON_DEFAULT: semanticColor(text, 0.86),
		ICON_STRONG: semanticColor(text, 1),
		ICON_MUTED: semanticColor(text, 0.62),
		ICON_SUBTLE: semanticColor(text, 0.52),
	})

	return overrides
}

/** Stable short key used to invalidate Discord's semantic-token memoization. */
export function semanticFingerprintFor(
	settings: LiquidGlassSettings,
	overrides: Readonly<Record<string, string>>,
): string {
	if (!settings.enabled || !settings.semanticEnabled) return 'off'
	return shortFingerprint(JSON.stringify(overrides))
}

/** Stable short key for the plugin-owned live gradient subscription. */
export function backgroundFingerprintFor(
	settings: LiquidGlassSettings,
): string {
	if (!settings.enabled || !settings.backgroundEnabled) return 'off'
	return shortFingerprint(
		JSON.stringify({
			gradientColors: settings.gradientColors,
			angle: settings.angle,
			backgroundSoftness: settings.backgroundSoftness,
			lowPowerMode: settings.lowPowerMode,
		}),
	)
}

function shortFingerprint(value: string): string {
	let hash = 2_166_136_261
	for (let index = 0; index < value.length; index += 1) {
		hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619)
	}
	return (hash >>> 0).toString(36)
}
