import { SETTINGS_SCHEMA_VERSION } from './types'
import type {
	ProfileAssetHistoryEntry,
	SelectiveMediaSaverSettings,
} from './types'

export const DISCORD_ID_PATTERN = /^\d{15,22}$/

export const DEFAULT_SETTINGS: SelectiveMediaSaverSettings = {
	schemaVersion: SETTINGS_SCHEMA_VERSION,
	enabled: true,
	onlySaveAllowlisted: true,
	matchAnyAllowlist: true,
	allowedUserIds: [],
	allowedGuildIds: [],
	allowedChannelIds: [],
	ignoreBots: true,
	ignoreSelf: true,
	saveImages: true,
	saveVideos: true,
	saveAvatarsForAllowlistedUsers: false,
	saveBannersForAllowlistedUsers: false,
	trackAvatarChanges: true,
	trackBannerChanges: true,
	avatarHistory: [],
	bannerHistory: [],
	includeEmbedThumbnails: true,
	showSaveToasts: true,
	showErrorToasts: true,
	albumName: 'SelectiveMediaSaver',
	separateFoldersByType: true,
	maxDownloadMiB: 100,
}

const MAX_DOWNLOAD_MIB = 512
export const MAX_PROFILE_HISTORY_ENTRIES = 256
export const MAX_PROFILE_HISTORY_PER_USER = 8

function replaceControlCharacters(value: string): string {
	return Array.from(value, character =>
		(character.codePointAt(0) ?? 0) < 32 ? '-' : character,
	).join('')
}

function booleanOr(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback
}

function normalizeIds(value: unknown): string[] {
	if (!Array.isArray(value)) return []

	return [
		...new Set(
			value
				.map(String)
				.map(id => id.trim())
				.filter(id => DISCORD_ID_PATTERN.test(id)),
		),
	]
}

function safeHistoryEntry(
	value: unknown,
): ProfileAssetHistoryEntry | undefined {
	if (!value || typeof value !== 'object') return undefined
	const raw = value as Record<string, unknown>
	const userId = String(raw.userId ?? '').trim()
	const assetHash = String(raw.assetHash ?? '').trim()
	if (
		!DISCORD_ID_PATTERN.test(userId) ||
		!/^(?:a_)?[a-f0-9]{16,64}$/i.test(assetHash)
	) {
		return undefined
	}
	const savedAt = Number(raw.savedAt)
	return {
		userId,
		assetHash,
		savedAt: Number.isFinite(savedAt) && savedAt >= 0 ? savedAt : 0,
		uri:
			typeof raw.uri === 'string' && raw.uri.length <= 2_048
				? raw.uri
				: undefined,
		displayName:
			typeof raw.displayName === 'string' && raw.displayName.length <= 160
				? raw.displayName
				: undefined,
	}
}

/** Accepts schema-v2 arrays and the desktop plugin's old `{ userId: key }` map. */
export function normalizeProfileHistory(
	value: unknown,
): ProfileAssetHistoryEntry[] {
	const candidates: unknown[] = Array.isArray(value)
		? value
		: value && typeof value === 'object'
			? Object.entries(value as Record<string, unknown>).flatMap(
					([userId, stored]) => {
						if (typeof stored === 'string') {
							const parts = stored.split(':')
							const assetHash =
								parts[0] === userId && parts.length > 1 ? parts[1] : parts[0]
							return [{ userId, assetHash, savedAt: 0 }]
						}
						return Array.isArray(stored)
							? stored.map(entry => ({
									...(entry && typeof entry === 'object' ? entry : {}),
									userId,
								}))
							: []
					},
				)
			: []

	let normalized: ProfileAssetHistoryEntry[] = []
	for (const candidate of candidates) {
		const entry = safeHistoryEntry(candidate)
		if (!entry) continue
		normalized = addProfileHistoryEntry(normalized, entry)
	}
	return normalized
}

export function hasProfileAsset(
	history: readonly ProfileAssetHistoryEntry[],
	userId: string,
	assetHash: string,
): boolean {
	return history.some(
		entry => entry.userId === userId && entry.assetHash === assetHash,
	)
}

export function addProfileHistoryEntry(
	history: readonly ProfileAssetHistoryEntry[],
	entry: ProfileAssetHistoryEntry,
): ProfileAssetHistoryEntry[] {
	const chronological = history.filter(
		item =>
			!(item.userId === entry.userId && item.assetHash === entry.assetHash),
	)
	chronological.push(entry)
	const counts = new Map<string, number>()
	const boundedPerUser: ProfileAssetHistoryEntry[] = []
	for (let index = chronological.length - 1; index >= 0; index -= 1) {
		const item = chronological[index]
		const count = counts.get(item.userId) ?? 0
		if (count >= MAX_PROFILE_HISTORY_PER_USER) continue
		counts.set(item.userId, count + 1)
		boundedPerUser.push(item)
	}
	boundedPerUser.reverse()
	return boundedPerUser.slice(-MAX_PROFILE_HISTORY_ENTRIES)
}

export function sanitizeFolderSegment(value: unknown): string {
	const safe = replaceControlCharacters(String(value ?? ''))
		.replace(/[\\/:*?"<>|]/g, '-')
		.replace(/\s+/g, ' ')
		.replace(/^\.+|\.+$/g, '')
		.trim()
		.slice(0, 48)

	return safe || DEFAULT_SETTINGS.albumName
}

/**
 * Migrates unknown/older storage into the current schema without trusting its shape.
 * New schema versions should add an explicit migration before this normalization pass.
 */
export function normalizeSettings(value: unknown): SelectiveMediaSaverSettings {
	const raw =
		value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
	const maxDownloadMiB = Math.min(
		MAX_DOWNLOAD_MIB,
		Math.max(
			1,
			Math.round(Number(raw.maxDownloadMiB) || DEFAULT_SETTINGS.maxDownloadMiB),
		),
	)

	return {
		schemaVersion: SETTINGS_SCHEMA_VERSION,
		enabled: booleanOr(raw.enabled, DEFAULT_SETTINGS.enabled),
		onlySaveAllowlisted: booleanOr(
			raw.onlySaveAllowlisted,
			DEFAULT_SETTINGS.onlySaveAllowlisted,
		),
		matchAnyAllowlist: booleanOr(
			raw.matchAnyAllowlist,
			DEFAULT_SETTINGS.matchAnyAllowlist,
		),
		allowedUserIds: normalizeIds(raw.allowedUserIds),
		allowedGuildIds: normalizeIds(raw.allowedGuildIds),
		allowedChannelIds: normalizeIds(raw.allowedChannelIds),
		ignoreBots: booleanOr(raw.ignoreBots, DEFAULT_SETTINGS.ignoreBots),
		ignoreSelf: booleanOr(raw.ignoreSelf, DEFAULT_SETTINGS.ignoreSelf),
		saveImages: booleanOr(raw.saveImages, DEFAULT_SETTINGS.saveImages),
		saveVideos: booleanOr(raw.saveVideos, DEFAULT_SETTINGS.saveVideos),
		saveAvatarsForAllowlistedUsers: booleanOr(
			raw.saveAvatarsForAllowlistedUsers,
			DEFAULT_SETTINGS.saveAvatarsForAllowlistedUsers,
		),
		saveBannersForAllowlistedUsers: booleanOr(
			raw.saveBannersForAllowlistedUsers,
			DEFAULT_SETTINGS.saveBannersForAllowlistedUsers,
		),
		trackAvatarChanges: booleanOr(
			raw.trackAvatarChanges,
			DEFAULT_SETTINGS.trackAvatarChanges,
		),
		trackBannerChanges: booleanOr(
			raw.trackBannerChanges,
			DEFAULT_SETTINGS.trackBannerChanges,
		),
		avatarHistory: normalizeProfileHistory(raw.avatarHistory),
		bannerHistory: normalizeProfileHistory(raw.bannerHistory),
		includeEmbedThumbnails: booleanOr(
			raw.includeEmbedThumbnails,
			DEFAULT_SETTINGS.includeEmbedThumbnails,
		),
		showSaveToasts: booleanOr(
			raw.showSaveToasts,
			DEFAULT_SETTINGS.showSaveToasts,
		),
		showErrorToasts: booleanOr(
			raw.showErrorToasts,
			DEFAULT_SETTINGS.showErrorToasts,
		),
		albumName: sanitizeFolderSegment(raw.albumName),
		separateFoldersByType: booleanOr(
			raw.separateFoldersByType,
			DEFAULT_SETTINGS.separateFoldersByType,
		),
		maxDownloadMiB,
	}
}

export function settingsChanged(
	before: unknown,
	after: SelectiveMediaSaverSettings,
): boolean {
	try {
		return JSON.stringify(before) !== JSON.stringify(after)
	} catch {
		return true
	}
}
