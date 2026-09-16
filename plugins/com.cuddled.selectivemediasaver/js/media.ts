import { sanitizeFolderSegment } from './defaults'
import type {
	ExtractedMedia,
	MediaKind,
	MediaSource,
	MessageContext,
	MessageLike,
	NativeDownloadRequest,
	SelectiveMediaSaverSettings,
} from './types'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.m4v'])
const MAX_MEDIA_PER_MESSAGE = 16

function read(object: unknown, key: string): unknown {
	try {
		return object && typeof object === 'object'
			? (object as Record<string, unknown>)[key]
			: undefined
	} catch {
		return undefined
	}
}

function firstString(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === 'string' && value.trim()) return value.trim()
	}
	return undefined
}

function finiteNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0
		? value
		: undefined
}

function safeList(value: unknown): unknown[] {
	try {
		if (Array.isArray(value)) return value
		const toArray = read(value, 'toArray')
		if (typeof toArray === 'function') {
			const result = toArray.call(value)
			return Array.isArray(result) ? result : []
		}
		if (
			value &&
			typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function'
		) {
			return Array.from(value as Iterable<unknown>)
		}
	} catch {
		// A malformed Discord record must never break the MESSAGE_CREATE dispatcher.
	}
	return []
}

function extensionFrom(value: string | undefined): string {
	if (!value) return ''
	const clean = value.split(/[?#]/, 1)[0].toLowerCase()
	const match = clean.match(/(\.[a-z0-9]{2,5})$/)
	return match?.[1] ?? ''
}

function classify(
	url: string,
	fileName: string | undefined,
	mimeType: string | undefined,
): { kind: MediaKind; extension: string; mimeType?: string } | undefined {
	const normalizedMime = mimeType?.split(';', 1)[0].trim().toLowerCase()
	let extension = extensionFrom(fileName) || extensionFrom(url)
	let kind: MediaKind | undefined

	if (normalizedMime?.startsWith('image/')) kind = 'image'
	else if (normalizedMime?.startsWith('video/')) kind = 'video'
	else if (IMAGE_EXTENSIONS.has(extension)) kind = 'image'
	else if (VIDEO_EXTENSIONS.has(extension)) kind = 'video'

	if (!kind) return undefined
	if (!extension) extension = kind === 'image' ? '.jpg' : '.mp4'
	return { kind, extension, mimeType: normalizedMime }
}

function isSafeRemoteUrl(value: string): boolean {
	// MediaStore streaming happens natively. Only TLS URLs are accepted from Discord records.
	return /^https:\/\/[^\s]+$/i.test(value) && value.length <= 4096
}

function normalizeUrlForDedupe(url: string): string {
	return url.split('#', 1)[0].split('?', 1)[0]
}

export function messageFromEvent(event: unknown): MessageLike | undefined {
	if (!event || typeof event !== 'object') return undefined
	const messages = safeList(read(event, 'messages'))
	const candidate =
		read(event, 'message') ??
		read(event, 'optimisticMessage') ??
		messages[0] ??
		event

	return candidate && typeof candidate === 'object'
		? (candidate as MessageLike)
		: undefined
}

export function messageContext(
	message: MessageLike,
): MessageContext | undefined {
	const author = read(message, 'author')
	const id = firstString(read(message, 'id'))
	const channelId = firstString(
		read(message, 'channel_id'),
		read(message, 'channelId'),
	)
	if (!id || !channelId) return undefined

	return {
		id,
		channelId,
		guildId:
			firstString(read(message, 'guild_id'), read(message, 'guildId')) ?? '',
		authorId: firstString(read(author, 'id')) ?? '',
		authorName:
			firstString(
				read(author, 'globalName'),
				read(author, 'global_name'),
				read(author, 'username'),
			) ?? 'Unknown user',
		authorIsBot: read(author, 'bot') === true,
	}
}

export function isMessageAllowed(
	context: MessageContext,
	settings: SelectiveMediaSaverSettings,
): boolean {
	if (!settings.onlySaveAllowlisted) return true

	const users = new Set(settings.allowedUserIds)
	const guilds = new Set(settings.allowedGuildIds)
	const channels = new Set(settings.allowedChannelIds)
	if (users.size + guilds.size + channels.size === 0) return false

	const userMatch = users.has(context.authorId)
	const guildMatch = guilds.has(context.guildId)
	const channelMatch = channels.has(context.channelId)

	if (settings.matchAnyAllowlist) return userMatch || guildMatch || channelMatch
	if (users.size > 0 && !userMatch) return false
	if (guilds.size > 0 && !guildMatch) return false
	if (channels.size > 0 && !channelMatch) return false
	return true
}

export function extractMedia(
	message: MessageLike,
	settings: SelectiveMediaSaverSettings,
): ExtractedMedia[] {
	const found: ExtractedMedia[] = []
	const urls = new Set<string>()

	const add = (
		urlValue: unknown,
		source: MediaSource,
		meta: {
			fileName?: unknown
			mimeType?: unknown
			size?: unknown
			width?: unknown
			height?: unknown
		} = {},
	) => {
		if (found.length >= MAX_MEDIA_PER_MESSAGE) return
		const url = firstString(urlValue)
		if (!url || !isSafeRemoteUrl(url)) return

		const fileName = firstString(meta.fileName)
		const mimeType = firstString(meta.mimeType)
		const classification = classify(url, fileName, mimeType)
		if (!classification) return
		if (classification.kind === 'image' && !settings.saveImages) return
		if (classification.kind === 'video' && !settings.saveVideos) return

		const dedupeUrl = normalizeUrlForDedupe(url)
		if (urls.has(dedupeUrl)) return
		urls.add(dedupeUrl)
		found.push({
			source,
			url,
			kind: classification.kind,
			extension: classification.extension,
			fileName,
			mimeType: classification.mimeType,
			size: finiteNumber(meta.size),
			width: finiteNumber(meta.width),
			height: finiteNumber(meta.height),
		})
	}

	for (const attachment of safeList(read(message, 'attachments'))) {
		add(
			read(attachment, 'url') ??
				read(attachment, 'proxy_url') ??
				read(attachment, 'proxyUrl'),
			'attachment',
			{
				fileName: read(attachment, 'filename'),
				mimeType:
					read(attachment, 'content_type') ?? read(attachment, 'contentType'),
				size: read(attachment, 'size'),
				width: read(attachment, 'width'),
				height: read(attachment, 'height'),
			},
		)
	}

	for (const embed of safeList(read(message, 'embeds'))) {
		const image = read(embed, 'image')
		add(
			read(image, 'url') ?? read(image, 'proxy_url') ?? read(image, 'proxyUrl'),
			'embed_image',
			{
				mimeType: read(image, 'content_type') ?? read(image, 'contentType'),
				width: read(image, 'width'),
				height: read(image, 'height'),
			},
		)

		if (settings.includeEmbedThumbnails) {
			const thumbnail = read(embed, 'thumbnail')
			add(
				read(thumbnail, 'url') ??
					read(thumbnail, 'proxy_url') ??
					read(thumbnail, 'proxyUrl'),
				'embed_thumbnail',
				{
					mimeType:
						read(thumbnail, 'content_type') ?? read(thumbnail, 'contentType'),
					width: read(thumbnail, 'width'),
					height: read(thumbnail, 'height'),
				},
			)
		}

		const video = read(embed, 'video')
		add(
			read(video, 'url') ?? read(video, 'proxy_url') ?? read(video, 'proxyUrl'),
			'embed_video',
			{
				mimeType: read(video, 'content_type') ?? read(video, 'contentType'),
				width: read(video, 'width'),
				height: read(video, 'height'),
			},
		)

		add(read(embed, 'url'), 'embed_url', {
			mimeType: read(embed, 'content_type') ?? read(embed, 'contentType'),
		})
	}

	return found
}

function sanitizeFileName(value: string): string {
	const withoutControls = Array.from(value, character =>
		(character.codePointAt(0) ?? 0) < 32 ? '-' : character,
	).join('')
	const safe = withoutControls
		.replace(/[\\/:*?"<>|]/g, '-')
		.replace(/\s+/g, ' ')
		.replace(/^\.+/, '')
		.trim()
		.slice(0, 128)
	return safe || 'discord-media'
}

export function buildDownloadRequest(
	context: MessageContext,
	media: ExtractedMedia,
	index: number,
	settings: SelectiveMediaSaverSettings,
): NativeDownloadRequest {
	const fallbackName = `${context.authorId || 'unknown'}-${context.id}-${index + 1}${media.extension}`
	let fileName = sanitizeFileName(media.fileName || fallbackName)
	if (!extensionFrom(fileName)) fileName += media.extension

	const album = sanitizeFolderSegment(settings.albumName)
	const folder = settings.separateFoldersByType
		? `${album} ${media.kind === 'image' ? 'Images' : 'Videos'}`
		: album

	return {
		url: media.url,
		fileName,
		mimeType: media.mimeType,
		folder,
		maxBytes: settings.maxDownloadMiB * 1024 * 1024,
	}
}

export function seenKey(messageId: string, url: string): string {
	return `${messageId}:${normalizeUrlForDedupe(url)}`
}

export function httpsHost(url: string): string | undefined {
	const match = url.match(/^https:\/\/([^/?#:]+)(?::\d+)?(?:[/?#]|$)/i)
	return match?.[1]?.toLowerCase()
}
