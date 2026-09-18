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

export const SEMANTIC_COLOR_KEYS = [
	'BACKGROUND_BASE_LOWEST',
	'BACKGROUND_BASE_LOWER',
	'BACKGROUND_BASE_LOW',
	'BACKGROUND_SECONDARY_ALT',
	'BACKGROUND_SURFACE_HIGH',
	'BACKGROUND_SURFACE_HIGHEST',
	'BACKGROUND_PRIMARY',
	'BACKGROUND_SECONDARY',
	'BACKGROUND_FLOATING',
	'BG_SURFACE_OVERLAY_TMP',
	'BG_SURFACE_RAISED',
	'CARD_BACKGROUND_DEFAULT',
	'CARD_SECONDARY_BG',
	'CARD_SECONDARY_BACKGROUND_DEFAULT',
	'CHANNEL_BACKGROUND_DEFAULT',
	'STANDALONE_CHANNEL_CONTENT_BACKGROUND',
	'TAB_BAR_BACKGROUND',
	'CHANNELTEXTAREA_BACKGROUND',
	'CHAT_INPUT_BACKGROUND',
	'REDESIGN_CHAT_INPUT_BACKGROUND',
	'INPUT_BACKGROUND_DEFAULT',
	'MODAL_BACKGROUND',
	'MODAL_FOOTER_BACKGROUND',
	'PANEL_BG',
	'MOBILE_CHATINPUT_BACKGROUND_DEFAULT',
	'MOBILE_ACTIONSHEET_BACKGROUND',
	'MOBILE_ALERT_BACKGROUND_DEFAULT',
	'MOBILE_FLOATINGBAR_BACKGROUND',
	'MOBILE_FLOATINGBAR_BACKGROUND_HIGHER',
	'MOBILE_FLOATINGBAR_BACKGROUND_NAMEPLATE',
	'USER_PROFILE_CONTAINER_BACKGROUND',
	'MOBILE_EXPRESSION_PICKER_BACKGROUND_DEFAULT',
	'MOBILE_KEYBOARD_PANEL_BACKGROUND',
	'EMBED_BACKGROUND',
	'LEGACY_ANDROID_BLUR_OVERLAY_DEFAULT',
	'LEGACY_ANDROID_BLUR_OVERLAY_ULTRA_THIN',
	'LEGACY_BLUR_FALLBACK_DEFAULT',
	'LEGACY_BLUR_FALLBACK_ULTRA_THIN',
	'THEME_LOCKED_BLUR_FALLBACK',
	'TEXT_DEFAULT',
	'TEXT_STRONG',
	'TEXT_MUTED',
	'TEXT_SUBTLE',
	'BORDER_MUTED',
	'BORDER_SUBTLE',
	'BORDER_STRONG',
	'TEXT_BRAND',
	'CONTROL_BRAND_FOREGROUND',
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

	return {
		BACKGROUND_BASE_LOWEST: semanticColor(panel, baseOpacity * 0.44),
		BACKGROUND_BASE_LOWER: semanticColor(panel, baseOpacity * 0.64),
		BACKGROUND_BASE_LOW: semanticColor(panel, baseOpacity * 0.82),
		BACKGROUND_SECONDARY_ALT: semanticColor(panel, baseOpacity),
		BACKGROUND_SURFACE_HIGH: semanticColor(panel, baseOpacity),
		BACKGROUND_SURFACE_HIGHEST: semanticColor(raised, raisedOpacity),
		BACKGROUND_PRIMARY: semanticColor(panel, baseOpacity),
		BACKGROUND_SECONDARY: semanticColor(panel, baseOpacity),
		BACKGROUND_FLOATING: semanticColor(raised, raisedOpacity),
		BG_SURFACE_OVERLAY_TMP: semanticColor(raised, raisedOpacity),
		BG_SURFACE_RAISED: semanticColor(raised, raisedOpacity),
		CARD_BACKGROUND_DEFAULT: semanticColor(panel, baseOpacity),
		CARD_SECONDARY_BG: semanticColor(panel, baseOpacity * 0.86),
		CARD_SECONDARY_BACKGROUND_DEFAULT: semanticColor(panel, baseOpacity * 0.86),
		CHANNEL_BACKGROUND_DEFAULT: semanticColor(panel, baseOpacity),
		STANDALONE_CHANNEL_CONTENT_BACKGROUND: semanticColor(panel, baseOpacity),
		TAB_BAR_BACKGROUND: semanticColor(raised, raisedOpacity),
		CHANNELTEXTAREA_BACKGROUND: semanticColor(raised, raisedOpacity),
		CHAT_INPUT_BACKGROUND: semanticColor(raised, raisedOpacity),
		REDESIGN_CHAT_INPUT_BACKGROUND: semanticColor(raised, raisedOpacity),
		INPUT_BACKGROUND_DEFAULT: semanticColor(raised, raisedOpacity),
		MODAL_BACKGROUND: semanticColor(panel, raisedOpacity),
		MODAL_FOOTER_BACKGROUND: semanticColor(raised, raisedOpacity),
		PANEL_BG: semanticColor(panel, baseOpacity),
		MOBILE_CHATINPUT_BACKGROUND_DEFAULT: semanticColor(raised, raisedOpacity),
		MOBILE_ACTIONSHEET_BACKGROUND: semanticColor(raised, raisedOpacity),
		MOBILE_ALERT_BACKGROUND_DEFAULT: semanticColor(raised, raisedOpacity),
		MOBILE_FLOATINGBAR_BACKGROUND: semanticColor(raised, raisedOpacity),
		MOBILE_FLOATINGBAR_BACKGROUND_HIGHER: semanticColor(raised, raisedOpacity),
		MOBILE_FLOATINGBAR_BACKGROUND_NAMEPLATE: semanticColor(panel, baseOpacity),
		USER_PROFILE_CONTAINER_BACKGROUND: semanticColor(panel, baseOpacity),
		MOBILE_EXPRESSION_PICKER_BACKGROUND_DEFAULT: semanticColor(
			panel,
			baseOpacity,
		),
		MOBILE_KEYBOARD_PANEL_BACKGROUND: semanticColor(raised, raisedOpacity),
		EMBED_BACKGROUND: semanticColor(panel, baseOpacity),
		LEGACY_ANDROID_BLUR_OVERLAY_DEFAULT: semanticColor(raised, raisedOpacity),
		LEGACY_ANDROID_BLUR_OVERLAY_ULTRA_THIN: semanticColor(
			panel,
			baseOpacity * 0.55,
		),
		LEGACY_BLUR_FALLBACK_DEFAULT: semanticColor(raised, raisedOpacity),
		LEGACY_BLUR_FALLBACK_ULTRA_THIN: semanticColor(panel, baseOpacity * 0.55),
		THEME_LOCKED_BLUR_FALLBACK: semanticColor(raised, raisedOpacity),
		TEXT_DEFAULT: semanticColor(text, 1),
		TEXT_STRONG: semanticColor(text, 1),
		TEXT_MUTED: semanticColor(text, 0.72),
		TEXT_SUBTLE: semanticColor(text, 0.58),
		BORDER_MUTED: semanticColor(border, 0.1),
		BORDER_SUBTLE: semanticColor(border, 0.14),
		BORDER_STRONG: semanticColor(border, 0.22),
		TEXT_BRAND: semanticColor(accent, 1),
		CONTROL_BRAND_FOREGROUND: semanticColor(accent, 1),
	}
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
