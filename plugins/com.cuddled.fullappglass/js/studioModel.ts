import { normalizeHexColor } from '../../com.cuddled.liquidglass/js/core'
import { WALLPAPER_SOURCE } from '../../com.cuddled.liquidglass/js/wallpaper'
import type { Settings } from './core'

export interface Scene {
	wallpaper: string
	accent: string
}
export interface StudioSettings {
	mood: 'custom' | 'midnight' | 'ice' | 'rose' | 'oled'
	ambient: boolean
	softMotion: boolean
	calls: boolean
	search: boolean
	focus: boolean
	dashboard: boolean
	floatingRail: boolean
	lineIcons: boolean
	mediaCards: boolean
	notifications: boolean
	emptyArt: boolean
	reactions: boolean
	hideGift: boolean
	hideApps: boolean
	music: boolean
	font: 'discord' | 'rounded' | 'serif' | 'mono'
	letterSpacing: number
	wallpaper: string
	homeWallpaper: string
	emptyImage: string
	favorites: string[]
	pinnedFriends: string[]
	scenes: Record<string, Scene>
}
export const STUDIO_DEFAULTS: StudioSettings = {
	mood: 'custom',
	ambient: true,
	softMotion: true,
	calls: true,
	search: true,
	focus: false,
	dashboard: true,
	floatingRail: true,
	lineIcons: true,
	mediaCards: true,
	notifications: true,
	emptyArt: true,
	reactions: true,
	hideGift: true,
	hideApps: true,
	music: true,
	font: 'discord',
	letterSpacing: 0,
	wallpaper: '',
	homeWallpaper: '',
	emptyImage: '',
	favorites: [],
	pinnedFriends: [],
	scenes: {},
}
export const validId = (value: unknown): value is string =>
	typeof value === 'string' && /^\d{17,20}$/.test(value)

/** Only image locations accepted by Android's image loader; never executable URLs. */
export function imageUri(value: unknown): string {
	if (typeof value !== 'string' || value.length > 2048) return ''
	const uri = value.trim()
	if (
		Array.from(uri).some(character => character.charCodeAt(0) <= 32) ||
		/[<>"\\]/.test(uri)
	)
		return ''
	if (/^(file:\/\/\/|content:\/\/)[^?#]+/i.test(uri)) return uri
	if (/^https:\/\/[^/@?#]+(?:[/?#]|$)/i.test(uri)) return uri
	return ''
}
const ids = (value: unknown) =>
	Array.isArray(value) ? [...new Set(value.filter(validId))].slice(0, 24) : []
export function normalizeStudio(value: unknown): StudioSettings {
	const raw =
		value && typeof value === 'object' ? (value as Partial<StudioSettings>) : {}
	const result = {
		...STUDIO_DEFAULTS,
		favorites: ids(raw.favorites),
		pinnedFriends: ids(raw.pinnedFriends),
		scenes: {} as StudioSettings['scenes'],
	}
	for (const key of [
		'ambient',
		'softMotion',
		'calls',
		'search',
		'focus',
		'dashboard',
		'floatingRail',
		'lineIcons',
		'mediaCards',
		'notifications',
		'emptyArt',
		'reactions',
		'hideGift',
		'hideApps',
		'music',
	] as const)
		if (typeof raw[key] === 'boolean') result[key] = raw[key]
	if (['custom', 'midnight', 'ice', 'rose', 'oled'].includes(raw.mood ?? ''))
		result.mood = raw.mood!
	for (const key of ['wallpaper', 'homeWallpaper', 'emptyImage'] as const)
		result[key] = imageUri(raw[key])
	if (['discord', 'rounded', 'serif', 'mono'].includes(raw.font ?? ''))
		result.font = raw.font!
	if (
		typeof raw.letterSpacing === 'number' &&
		Number.isFinite(raw.letterSpacing)
	)
		result.letterSpacing = Math.min(0.6, Math.max(0, raw.letterSpacing))
	if (
		raw.scenes &&
		typeof raw.scenes === 'object' &&
		!Array.isArray(raw.scenes)
	) {
		for (const [key, entry] of Object.entries(raw.scenes).slice(0, 100)) {
			if (
				!/^(channel|guild):\d{17,20}$/.test(key) ||
				!entry ||
				typeof entry !== 'object'
			)
				continue
			const wallpaper = imageUri(entry.wallpaper)
			const accent =
				typeof entry.accent === 'string' && /^#[0-9a-f]{6}$/i.test(entry.accent)
					? normalizeHexColor(entry.accent, '#B8A1FF')
					: ''
			if (wallpaper || accent) result.scenes[key] = { wallpaper, accent }
		}
	}
	return result
}
export function resolveScene(
	settings: Settings,
	channelId?: string,
	guildId?: string,
): Scene {
	const channel = channelId
		? settings.studio.scenes[`channel:${channelId}`]
		: undefined
	const guild = guildId ? settings.studio.scenes[`guild:${guildId}`] : undefined
	return {
		wallpaper:
			channel?.wallpaper ||
			guild?.wallpaper ||
			settings.studio.wallpaper ||
			WALLPAPER_SOURCE.uri,
		accent: channel?.accent || guild?.accent || settings.accentColor,
	}
}
export const interfaceFont = (font: StudioSettings['font']) =>
	({
		discord: undefined,
		rounded: 'sans-serif-medium',
		serif: 'serif',
		mono: 'monospace',
	})[font]
export function togglePin(values: string[], id: string) {
	if (!validId(id)) return values
	return values.includes(id)
		? values.filter(value => value !== id)
		: [...values, id].slice(0, 24)
}

/** Picker versions return either an assets array or Discord's selected-media array. */
export function pickedImage(result: unknown): string | null {
	if (!result || typeof result !== 'object') return null
	const raw = result as Record<string, any>
	if (raw.didCancel || raw.cancelled || raw.canceled) return null
	if (raw.errorCode || raw.error)
		throw new Error(
			'Photo access was not available. You can paste an HTTPS image URL instead.',
		)
	const item = Array.isArray(raw)
		? raw[0]
		: (raw.assets?.[0] ?? raw.media?.[0] ?? raw)
	const candidate = item?.uri ?? item?.path
	const uri = imageUri(
		typeof candidate === 'string' && candidate.startsWith('/')
			? `file://${candidate}`
			: candidate,
	)
	if (!uri)
		throw new Error(
			'No usable photo was returned. Choose a photo or paste an HTTPS image URL.',
		)
	return uri
}
