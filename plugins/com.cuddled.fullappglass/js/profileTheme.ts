import {
	hexWithAlpha,
	replaceDiscordHexAlpha,
} from '../../com.cuddled.liquidglass/js/core'
import type { Settings } from './core'

function rgb(value: unknown): string | undefined {
	if (
		typeof value === 'number' &&
		Number.isInteger(value) &&
		value >= 0 &&
		value <= 0xffffff
	)
		return `#${value.toString(16).padStart(6, '0').toUpperCase()}`
	const hex = replaceDiscordHexAlpha(value, 1)
	if (typeof hex === 'string' && /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(hex))
		return hex.slice(0, 7).toUpperCase()
	return undefined
}

function mix(base: string, color: string, amount: number): string {
	return `#${[1, 3, 5]
		.map(i =>
			Math.round(
				parseInt(base.slice(i, i + 2), 16) * (1 - amount) +
					parseInt(color.slice(i, i + 2), 16) * amount,
			)
				.toString(16)
				.padStart(2, '0'),
		)
		.join('')
		.toUpperCase()}`
}

function luminance(color: string): number {
	const channels = [1, 3, 5].map(i => {
		const value = parseInt(color.slice(i, i + 2), 16) / 255
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
	})
	return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

/** Retain the owner's hue while keeping bright text readable, even on white profiles. */
function darken(color: string): string {
	let result = color
	for (let step = 0; step < 12 && luminance(result) > 0.14; step++)
		result = mix('#000000', result, 0.85)
	return result
}

export function profilePalette(settings: Settings, theme: unknown) {
	if (
		!settings.enabled ||
		!settings.profiles ||
		!settings.studio.profileColors ||
		settings.studio.focus ||
		!theme ||
		typeof theme !== 'object' ||
		Array.isArray(theme)
	)
		return undefined
	const value = theme as Record<string, unknown>
	const primary = rgb(value.primaryColor)
	const secondary = rgb(value.secondaryColor)
	if (!primary || !secondary) return undefined
	const amount = settings.studio.profileColorStrength * 0.75
	const base = darken(settings.panelColor)
	return {
		primary: darken(mix(base, primary, amount)),
		secondary: darken(mix(base, secondary, amount)),
		border: mix(primary, '#FFFFFF', 0.2),
	}
}

/** Called with the hook's own arguments; never cache a different person's colors. */
export function blendProfileColors(
	settings: Settings,
	original: unknown,
	theme: unknown,
): unknown {
	const colors = profilePalette(settings, theme)
	if (
		!colors ||
		!original ||
		typeof original !== 'object' ||
		Array.isArray(original)
	)
		return original
	const result = original as Record<string, unknown>
	const next = { ...result }
	for (const key of [
		'gradientFallbackBackground',
		'gradientSecondaryBackground',
		'containerBackground',
		'containerBorderColor',
		'avatarBackground',
		'statusBackground',
	]) {
		if (!rgb(result[key])) continue
		const border = key === 'containerBorderColor'
		const color = border
			? colors.border
			: key === 'gradientSecondaryBackground'
				? colors.secondary
				: colors.primary
		next[key] = hexWithAlpha(
			color,
			border ? 0.3 : Math.max(0.28, 1 - settings.transparency),
		)
	}
	return next
}

export function blendProfileGradient(
	settings: Settings,
	original: unknown,
	primaryColor: unknown,
	secondaryColor: unknown,
): unknown {
	const colors = profilePalette(settings, { primaryColor, secondaryColor })
	if (
		!colors ||
		!Array.isArray(original) ||
		original.length !== 2 ||
		!original.every(rgb)
	)
		return original
	return [colors.primary, colors.secondary].map(color =>
		hexWithAlpha(color, 1 - settings.transparency),
	)
}

/** A fixed decorative gradient over the wallpaper, never over text or the banner image. */
export function profileGradientOverlay(
	settings: Settings,
	colors: unknown,
): string[] | undefined {
	if (
		!settings.enabled ||
		!settings.profiles ||
		!settings.studio.profileColors ||
		settings.studio.focus ||
		!Array.isArray(colors) ||
		colors.length < 2 ||
		!colors.every(rgb)
	)
		return undefined
	return colors.map(color =>
		hexWithAlpha(
			rgb(color)!,
			0.58 + settings.studio.profileColorStrength * 0.2,
		),
	)
}
