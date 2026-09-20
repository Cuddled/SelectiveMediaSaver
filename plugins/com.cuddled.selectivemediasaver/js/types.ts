export const SETTINGS_SCHEMA_VERSION = 4 as const

export type MediaKind = 'image' | 'video'

export type FolderOrganizationMode = 'flat' | 'sender' | 'location_sender'

export type MediaSource =
	| 'attachment'
	| 'embed_image'
	| 'embed_thumbnail'
	| 'embed_video'
	| 'embed_url'

export interface SelectiveMediaSaverSettings {
	schemaVersion: typeof SETTINGS_SCHEMA_VERSION
	enabled: boolean
	onlySaveAllowlisted: boolean
	matchAnyAllowlist: boolean
	allowedUserIds: string[]
	allowedGuildIds: string[]
	allowedChannelIds: string[]
	ignoreBots: boolean
	ignoreSelf: boolean
	saveImages: boolean
	saveVideos: boolean
	saveAvatarsForAllowlistedUsers: boolean
	saveBannersForAllowlistedUsers: boolean
	trackAvatarChanges: boolean
	trackBannerChanges: boolean
	avatarHistory: ProfileAssetHistoryEntry[]
	bannerHistory: ProfileAssetHistoryEntry[]
	includeEmbedThumbnails: boolean
	showSaveToasts: boolean
	showErrorToasts: boolean
	albumName: string
	separateFoldersByType: boolean
	folderOrganization: FolderOrganizationMode
	organizeProfileMediaBySender: boolean
	senderFolderAssignments: Record<string, string>
	maxDownloadMiB: number
}

export interface ProfileAssetHistoryEntry {
	userId: string
	assetHash: string
	savedAt: number
	uri?: string
	displayName?: string
}

export interface ProfileAssetCandidate {
	kind: 'avatar' | 'banner'
	userId: string
	userName: string
	userUsername: string
	userIsBot: boolean
	assetHash: string
	url: string
	extension: '.gif' | '.png'
	mimeType: 'image/gif' | 'image/png'
}

export interface MessageAuthorLike {
	id?: unknown
	bot?: unknown
	username?: unknown
	globalName?: unknown
	global_name?: unknown
}

export interface MessageLike {
	id?: unknown
	channel_id?: unknown
	channelId?: unknown
	guild_id?: unknown
	guildId?: unknown
	author?: MessageAuthorLike | null
	attachments?: unknown
	embeds?: unknown
}

export interface MessageContext {
	id: string
	channelId: string
	guildId: string
	authorId: string
	authorName: string
	authorUsername: string
	authorIsBot: boolean
}

export interface ExtractedMedia {
	source: MediaSource
	url: string
	kind: MediaKind
	extension: string
	fileName?: string
	mimeType?: string
	size?: number
	width?: number
	height?: number
}

export interface NativeCapabilities {
	ok: boolean
	streamDownload: boolean
	mediaStore: boolean
	open: boolean
	share: boolean
	delete: boolean
	apiLevel: number
	minApi: number
	targetApi: number
	compileApi: number
	storageMode: string
	storageMounted: boolean
	legacyWritePermissionRequired: boolean
	legacyWritePermissionGranted: boolean
	httpsOnly: boolean
	maxBytes: number
	defaultMaxBytes: number
	allowedHosts: string[]
	allowedMimeTypes: string[]
	allowedExtensions: string[]
	paths: {
		imagesRelative: string
		videosRelative: string
		imagesPublic: string
		videosPublic: string
	}
}

export interface NativeDownloadRequest {
	url: string
	fileName?: string
	mimeType?: string
	/** Individual path components; the native bridge validates every segment. */
	folderSegments?: string[]
	maxBytes?: number
}

export interface NativeDownloadSuccess {
	ok: true
	uri: string
	displayName: string
	mimeType: string
	bytes: number
	mediaKind: MediaKind
	sha256: string
	sourceHost: string
	relativePath?: string
}

export interface NativeBridgeError {
	code: string
	message: string
	retryable: boolean
	details?: string
}

export interface NativeDownloadFailure {
	ok: false
	error: NativeBridgeError
}

export type NativeDownloadResult = NativeDownloadSuccess | NativeDownloadFailure

export interface NativeLaunchSuccess {
	ok: true
	uri: string
	launched: true
}

export interface NativeDeleteSuccess {
	ok: true
	uri: string
	deleted: boolean
}

export type NativeLaunchResult = NativeLaunchSuccess | NativeDownloadFailure
export type NativeDeleteResult = NativeDeleteSuccess | NativeDownloadFailure

export interface RuntimeStatus {
	phase: 'stopped' | 'starting' | 'listening' | 'error'
	listening: boolean
	nativeReady: boolean
	queuedMessages: number
	savedThisSession: number
	failedThisSession: number
	lastSavedName?: string
	lastError?: string
	lastEventAt?: number
	capabilities?: NativeCapabilities
}
