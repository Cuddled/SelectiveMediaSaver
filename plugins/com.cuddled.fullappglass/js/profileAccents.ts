import { hexWithAlpha } from '../../com.cuddled.liquidglass/js/core'
import type { Settings } from './core'

export const PROFILE_ACCENT = '__fullAppGlassProfileAccent'

export function profileAccent(value: unknown): string {
	if (
		typeof value === 'number' &&
		Number.isInteger(value) &&
		value >= 0 &&
		value <= 0xffffff
	)
		return `#${value.toString(16).padStart(6, '0').toUpperCase()}`
	if (typeof value === 'string' && /^#[\da-f]{6}$/i.test(value))
		return value.toUpperCase()
	return '#8E83FF'
}

function record(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Forward a scope marker through Discord's existing semantic-context builder.
 * Unrelated contexts (and their cache identities) are returned exactly as before.
 */
export function profileSemanticContext(
	theme: unknown,
	original: unknown,
): unknown {
	if (
		!record(theme) ||
		!record(original) ||
		typeof theme[PROFILE_ACCENT] !== 'string'
	)
		return original
	return { ...original, [PROFILE_ACCENT]: profileAccent(theme[PROFILE_ACCENT]) }
}

export function profileControlColor(
	settings: Settings,
	name: string,
	context: unknown,
): string | undefined {
	if (
		!settings.enabled ||
		!settings.profiles ||
		!settings.controls ||
		!record(context) ||
		typeof context[PROFILE_ACCENT] !== 'string'
	)
		return undefined
	// Never affect critical/destructive, purchase, toggle, or non-profile controls.
	const token =
		/^CONTROL_(PRIMARY|SECONDARY)_(BACKGROUND|BORDER)_(DEFAULT|ACTIVE)$/.exec(
			name,
		)
	if (!token) return undefined
	const accent = profileAccent(context[PROFILE_ACCENT])
	const pressed = token[3] === 'ACTIVE'
	if (token[2] === 'BORDER') return hexWithAlpha(accent, pressed ? 0.8 : 0.5)
	const mix = pressed ? 0.24 : 0.12
	const tint = `#${[1, 3, 5]
		.map(i =>
			Math.round(
				parseInt(settings.panelColor.slice(i, i + 2), 16) * (1 - mix) +
					parseInt(accent.slice(i, i + 2), 16) * mix,
			)
				.toString(16)
				.padStart(2, '0'),
		)
		.join('')}`
	return hexWithAlpha(
		tint,
		Math.min(1, 1 - settings.transparency + (pressed ? 0.14 : 0)),
	)
}
