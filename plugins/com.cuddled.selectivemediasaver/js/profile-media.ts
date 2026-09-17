import { DISCORD_ID_PATTERN } from './defaults'
import type { ProfileAssetCandidate } from './types'

export const PROFILE_EVENT_TYPES = [
	'USER_PROFILE_FETCH_SUCCESS',
	'USER_PROFILE_FETCH_COMPLETED',
	'USER_PROFILE_UPDATE',
	'USER_PROFILE_FETCH',
	'USER_PROFILE_MODAL_FETCH_SUCCESS',
] as const

type UnknownRecord = Record<string, unknown>

const ASSET_HASH_PATTERN = /^(?:a_)?[a-f0-9]{16,64}$/i

function record(value: unknown): UnknownRecord | undefined {
	return value !== null && typeof value === 'object'
		? (value as UnknownRecord)
		: undefined
}

function read(value: UnknownRecord | undefined, key: string): unknown {
	try {
		return value?.[key]
	} catch {
		return undefined
	}
}

function stringField(
	value: UnknownRecord | undefined,
	...keys: string[]
): string | undefined {
	if (!value) return undefined
	for (const key of keys) {
		const field = read(value, key)
		if (typeof field === 'string' && field.trim()) return field.trim()
	}
	return undefined
}

function boolField(value: UnknownRecord | undefined, key: string): boolean {
	return read(value, key) === true
}

function validUserId(value: string | undefined): value is string {
	return value !== undefined && DISCORD_ID_PATTERN.test(value)
}

function validAssetHash(value: string | undefined): value is string {
	return value !== undefined && ASSET_HASH_PATTERN.test(value)
}

function displayName(user: UnknownRecord | undefined, userId: string): string {
	return (
		stringField(user, 'globalName', 'global_name', 'username') ??
		`user-${userId.slice(-6)}`
	)
}

function username(user: UnknownRecord | undefined, userId: string): string {
	return (
		stringField(user, 'username', 'globalName', 'global_name') ??
		`user-${userId.slice(-6)}`
	)
}

function profileAssetCandidate(
	kind: 'avatar' | 'banner',
	userId: string,
	assetHash: string,
	userName: string,
	userUsername: string,
	userIsBot: boolean,
): ProfileAssetCandidate {
	const animated = assetHash.toLowerCase().startsWith('a_')
	const extension = animated ? '.gif' : '.png'
	const size = kind === 'avatar' ? 512 : 1_024
	return {
		kind,
		userId,
		userName,
		userUsername,
		userIsBot,
		assetHash,
		url: `https://cdn.discordapp.com/${kind === 'avatar' ? 'avatars' : 'banners'}/${userId}/${assetHash}${extension}?size=${size}`,
		extension,
		mimeType: animated ? 'image/gif' : 'image/png',
	}
}

/**
 * Extracts only Discord's hash/id fields and constructs the CDN URL locally.
 * Direct or proxy URLs in a payload are deliberately ignored.
 */
export function avatarCandidateFromUser(
	value: unknown,
): ProfileAssetCandidate | undefined {
	const user = record(value)
	const userId = stringField(user, 'id', 'userId', 'user_id')
	const assetHash = stringField(user, 'avatar', 'avatarHash', 'avatar_hash')
	if (!validUserId(userId) || !validAssetHash(assetHash)) return undefined
	return profileAssetCandidate(
		'avatar',
		userId,
		assetHash,
		displayName(user, userId),
		username(user, userId),
		boolField(user, 'bot'),
	)
}

export function userFromUserUpdateEvent(payload: unknown): unknown {
	const event = record(payload)
	if (!event) return undefined
	const user = read(event, 'user')
	if (record(user)) return user
	const users = read(event, 'users')
	if (Array.isArray(users)) {
		return users.find(candidate => record(candidate))
	}
	const updatedUser = read(event, 'updatedUser')
	if (record(updatedUser)) return updatedUser
	const currentUser = read(event, 'currentUser')
	if (record(currentUser)) return currentUser
	return undefined
}

function profileRecords(payload: unknown): UnknownRecord[] {
	const event = record(payload)
	if (!event) return []
	const roots = [
		read(event, 'userProfile'),
		read(event, 'profile'),
		read(event, 'user_profile'),
		read(event, 'profileUser'),
		read(event, 'user'),
		read(event, 'payload'),
		event,
	]
	const found: UnknownRecord[] = []
	const seen = new Set<UnknownRecord>()
	for (const value of roots) {
		const root = record(value)
		if (!root || seen.has(root)) continue
		seen.add(root)
		found.push(root)
		for (const nestedValue of [
			read(root, 'userProfile'),
			read(root, 'profile'),
			read(root, 'user_profile'),
			read(root, 'profileUser'),
		]) {
			const nested = record(nestedValue)
			if (nested && !seen.has(nested)) {
				seen.add(nested)
				found.push(nested)
			}
		}
	}
	return found
}

export function bannerCandidateFromProfileEvent(
	payload: unknown,
): ProfileAssetCandidate | undefined {
	const event = record(payload)
	for (const profile of profileRecords(payload)) {
		const user = record(read(profile, 'user')) ?? record(read(event, 'user'))
		const userId =
			stringField(profile, 'userId', 'user_id') ??
			stringField(user, 'id', 'userId', 'user_id') ??
			stringField(profile, 'id') ??
			stringField(event, 'userId', 'user_id')
		const assetHash =
			stringField(profile, 'banner', 'bannerHash', 'banner_hash') ??
			stringField(user, 'banner', 'bannerHash', 'banner_hash')
		if (!validUserId(userId) || !validAssetHash(assetHash)) continue
		return profileAssetCandidate(
			'banner',
			userId,
			assetHash,
			displayName(user ?? profile, userId),
			username(user ?? profile, userId),
			boolField(user, 'bot'),
		)
	}
	return undefined
}
