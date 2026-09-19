export const SETTINGS_SCHEMA_VERSION = 3 as const

export const BUILT_IN_PRESET_IDS = [
	'midnight',
	'frost',
	'ocean',
	'rose',
	'aurora',
	'amoled',
] as const

export type BuiltInPresetId = (typeof BUILT_IN_PRESET_IDS)[number]
export type PresetSelection = BuiltInPresetId | 'custom'
export type BackgroundMode = 'gradient' | 'midnight-waves'
export type HexColor = `#${string}`
export type GradientColors = [HexColor, HexColor, HexColor]

export interface LiquidGlassVisualSettings {
	gradientColors: GradientColors
	panelColor: HexColor
	tintColor: HexColor
	accentColor: HexColor
	textColor: HexColor
	borderColor: HexColor
	/** Normalized from 0 (transparent) through 1 (opaque). */
	panelOpacity: number
	/** Normalized from 0 (transparent) through 1 (opaque). */
	raisedOpacity: number
	/** Normalized opacity for own-profile and member-profile surfaces. */
	profileOpacity: number
	/** Normalized opacity for modals, menus, sheets, and floating surfaces. */
	overlayOpacity: number
	/** Normalized opacity for controls, list rows, tabs, and inputs. */
	controlOpacity: number
	/** Normalized background diffusion/dimming from 0 through 1. */
	backgroundSoftness: number
	/** Gradient angle in degrees, clamped from 0 through 360. */
	angle: number
}

export interface LiquidGlassWallpaperSettings {
	backgroundMode: BackgroundMode
	/** Normalized image opacity from 0 (hidden) through 1 (opaque). */
	wallpaperOpacity: number
	/** Normalized black dim layer over the wallpaper. */
	wallpaperDim: number
	/** Normalized tint layer using the current raised-surface color. */
	wallpaperTintOpacity: number
	/** React Native image blur radius, clamped to a deliberately small range. */
	wallpaperBlur: number
}

export interface LiquidGlassAppearanceSettings
	extends LiquidGlassVisualSettings,
		LiquidGlassWallpaperSettings {}

export interface LiquidGlassCustomProfile
	extends LiquidGlassAppearanceSettings {
	id: string
	name: string
	backgroundEnabled: boolean
}

export interface LiquidGlassSettings extends LiquidGlassAppearanceSettings {
	schemaVersion: typeof SETTINGS_SCHEMA_VERSION
	enabled: boolean
	selectedPreset: PresetSelection
	backgroundEnabled: boolean
	semanticEnabled: boolean
	profileGlassEnabled: boolean
	overlayGlassEnabled: boolean
	controlGlassEnabled: boolean
	lowPowerMode: boolean
	customProfiles: LiquidGlassCustomProfile[]
	activeProfileId: string | null
}

export interface LiquidGlassPresetDefinition {
	id: BuiltInPresetId
	label: string
	description: string
	backgroundEnabled: boolean
	values: Readonly<LiquidGlassVisualSettings>
}
