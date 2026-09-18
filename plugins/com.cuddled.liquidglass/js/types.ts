export const SETTINGS_SCHEMA_VERSION = 1 as const

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
	/** Normalized background diffusion/dimming from 0 through 1. */
	backgroundSoftness: number
	/** Gradient angle in degrees, clamped from 0 through 360. */
	angle: number
}

export interface LiquidGlassCustomProfile extends LiquidGlassVisualSettings {
	id: string
	name: string
	backgroundEnabled: boolean
}

export interface LiquidGlassSettings extends LiquidGlassVisualSettings {
	schemaVersion: typeof SETTINGS_SCHEMA_VERSION
	enabled: boolean
	selectedPreset: PresetSelection
	backgroundEnabled: boolean
	semanticEnabled: boolean
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
