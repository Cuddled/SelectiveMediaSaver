function _createSelectiveMediaSaver() {
	'use strict'

	const VERSION = '2.4.0-classic2'
	const MAX_DOWNLOAD_MIB = 500
	const MAX_SEEN = 2048
	const MAX_QUEUE = 64
	const MAX_MEDIA_PER_MESSAGE = 16
	const DISCORD_ID = /^\d{15,22}$/
	const ALLOWED_HOSTS = new Set([
		'cdn.discordapp.com',
		'media.discordapp.net',
		'images-ext-1.discordapp.net',
		'images-ext-2.discordapp.net',
	])
	const IMAGE_EXTENSIONS = new Set([
		'.png',
		'.jpg',
		'.jpeg',
		'.gif',
		'.webp',
		'.avif',
		'.apng',
	])
	const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.m4v'])
	const PROFILE_EVENTS = [
		'USER_PROFILE_FETCH_SUCCESS',
		'USER_PROFILE_FETCH_COMPLETED',
		'USER_PROFILE_UPDATE',
		'USER_PROFILE_FETCH',
		'USER_PROFILE_MODAL_FETCH_SUCCESS',
	]
	const DEFAULTS = {
		schemaVersion: 2,
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
		includeEmbedThumbnails: true,
		saveAvatarsForAllowlistedUsers: false,
		saveBannersForAllowlistedUsers: false,
		showSaveToasts: true,
		showErrorToasts: true,
		maxDownloadMiB: MAX_DOWNLOAD_MIB,
	}
	const CAPTURE_DEFAULTS = {
		seen: [],
		avatarHistory: {},
		bannerHistory: {},
		downloaded: 0,
		failed: 0,
		dropped: 0,
		lastSavedAt: 0,
		lastError: '',
	}

	const storage = vendetta.plugin?.storage || {}
	let captureState
	const runtime = {
		started: false,
		dispatcher: null,
		mediaManager: null,
		userStore: null,
		channelStore: null,
		handlers: [],
		pending: new Map(),
		queue: Promise.resolve(),
		generation: 0,
		lastQueueWarningAt: 0,
		captureDirty: false,
	}

	function safeRecord(value) {
		return value && typeof value === 'object' ? value : undefined
	}

	function read(value, key) {
		try {
			return safeRecord(value) ? value[key] : undefined
		} catch (_error) {
			return undefined
		}
	}

	function firstString(...values) {
		for (const value of values) {
			if (typeof value === 'string' && value.trim()) return value.trim()
		}
		return undefined
	}

	function safeList(value) {
		try {
			if (Array.isArray(value)) return value
			if (value && typeof value.toArray === 'function') {
				const result = value.toArray()
				return Array.isArray(result) ? result : []
			}
			if (value && typeof value[Symbol.iterator] === 'function')
				return Array.from(value)
		} catch (_error) {}
		return []
	}

	function normalizeIds(value) {
		const candidates = Array.isArray(value)
			? value
			: String(value == null ? '' : value).split(/[\s,]+/)
		return Array.from(
			new Set(
				candidates
					.map(String)
					.map(id => id.trim())
					.filter(id => DISCORD_ID.test(id)),
			),
		)
	}

	function boundedString(value, fallback, maxLength) {
		return typeof value === 'string' ? value.slice(0, maxLength) : fallback
	}

	function normalizeAssetHistory(value) {
		const result = {}
		for (const [userId, hash] of Object.entries(safeRecord(value) || {}).slice(
			-256,
		)) {
			if (
				DISCORD_ID.test(userId) &&
				/^(?:a_)?[a-f0-9]{16,64}$/i.test(String(hash))
			) {
				result[userId] = String(hash)
			}
		}
		return result
	}

	function normalizeCaptureState(value) {
		const raw = safeRecord(value) || {}
		return {
			seen: Array.isArray(raw.seen)
				? raw.seen.filter(item => typeof item === 'string').slice(-MAX_SEEN)
				: [],
			avatarHistory: normalizeAssetHistory(raw.avatarHistory),
			bannerHistory: normalizeAssetHistory(raw.bannerHistory),
			downloaded: Math.max(0, Number(raw.downloaded) || 0),
			failed: Math.max(0, Number(raw.failed) || 0),
			dropped: Math.max(0, Number(raw.dropped) || 0),
			lastSavedAt: Math.max(0, Number(raw.lastSavedAt) || 0),
			lastError: boundedString(raw.lastError, '', 300),
		}
	}

	function persistCaptureState() {
		captureState = normalizeCaptureState(captureState)
		storage.captureState = captureState
		runtime.captureDirty = false
	}

	function initializeStorage() {
		const previousSchema = Number(storage.schemaVersion) || 0
		for (const [key, fallback] of Object.entries(DEFAULTS)) {
			if (typeof storage[key] === 'undefined') {
				storage[key] = Array.isArray(fallback)
					? [...fallback]
					: fallback && typeof fallback === 'object'
						? { ...fallback }
						: fallback
			}
		}
		for (const key of [
			'allowedUserIds',
			'allowedGuildIds',
			'allowedChannelIds',
		]) {
			const ids = normalizeIds(storage[key])
			if (JSON.stringify(storage[key]) !== JSON.stringify(ids))
				storage[key] = ids
		}
		for (const [key, fallback] of Object.entries(DEFAULTS)) {
			if (typeof fallback === 'boolean' && typeof storage[key] !== 'boolean')
				storage[key] = fallback
		}
		if (previousSchema < 2 && Number(storage.maxDownloadMiB) === 100) {
			storage.maxDownloadMiB = DEFAULTS.maxDownloadMiB
		}
		storage.maxDownloadMiB = Math.max(
			1,
			Math.min(
				MAX_DOWNLOAD_MIB,
				Number(storage.maxDownloadMiB) || DEFAULTS.maxDownloadMiB,
			),
		)
		const rawCapture = safeRecord(storage.captureState)
		captureState = normalizeCaptureState(rawCapture || CAPTURE_DEFAULTS)
		if (
			!rawCapture ||
			JSON.stringify(rawCapture) !== JSON.stringify(captureState)
		) {
			storage.captureState = captureState
		}
		storage.schemaVersion = DEFAULTS.schemaVersion
	}

	function normalizeUrl(url) {
		return String(url || '')
			.split('#', 1)[0]
			.split('?', 1)[0]
	}

	function isSafeUrl(value) {
		if (typeof value !== 'string' || value.length > 4096) return false
		const match = value.match(/^https:\/\/([^/?#:]+)(?::\d+)?(?:[/?#]|$)/i)
		return Boolean(match && ALLOWED_HOSTS.has(match[1].toLowerCase()))
	}

	function extensionFrom(value) {
		if (typeof value !== 'string') return ''
		const match = value
			.split(/[?#]/, 1)[0]
			.toLowerCase()
			.match(/(\.[a-z0-9]{2,5})$/)
		return match ? match[1] : ''
	}

	function classify(url, fileName, mimeType) {
		const normalizedMime =
			typeof mimeType === 'string'
				? mimeType.split(';', 1)[0].trim().toLowerCase()
				: ''
		const extension = extensionFrom(fileName) || extensionFrom(url)
		if (normalizedMime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension))
			return 'image'
		if (normalizedMime.startsWith('video/') || VIDEO_EXTENSIONS.has(extension))
			return 'video'
		return undefined
	}

	function messageFromEvent(event) {
		const messages = safeList(read(event, 'messages'))
		const candidate =
			read(event, 'message') ||
			read(event, 'optimisticMessage') ||
			messages[0] ||
			event
		return safeRecord(candidate)
	}

	function messageContext(message) {
		const author = safeRecord(read(message, 'author'))
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
				firstString(read(message, 'guild_id'), read(message, 'guildId')) || '',
			authorId: firstString(read(author, 'id')) || '',
			authorName:
				firstString(
					read(author, 'globalName'),
					read(author, 'global_name'),
					read(author, 'username'),
				) || 'Unknown user',
			authorIsBot: read(author, 'bot') === true,
			author,
		}
	}

	function isMessageAllowed(context) {
		if (!storage.onlySaveAllowlisted) return true
		const users = new Set(storage.allowedUserIds)
		const guilds = new Set(storage.allowedGuildIds)
		const channels = new Set(storage.allowedChannelIds)
		if (users.size + guilds.size + channels.size === 0) return false
		const matches = [
			[users, context.authorId],
			[guilds, context.guildId],
			[channels, context.channelId],
		]
		if (storage.matchAnyAllowlist)
			return matches.some(([set, id]) => set.has(id))
		return matches.every(([set, id]) => set.size === 0 || set.has(id))
	}

	function extractMedia(message) {
		const found = []
		const urls = new Set()
		const add = (urlValue, source, meta) => {
			if (found.length >= MAX_MEDIA_PER_MESSAGE) return
			const url = firstString(urlValue)
			if (!url || !isSafeUrl(url)) return
			const details = meta || {}
			const kind = classify(
				url,
				firstString(details.fileName),
				firstString(details.mimeType),
			)
			if (!kind) return
			if (kind === 'image' && !storage.saveImages) return
			if (kind === 'video' && !storage.saveVideos) return
			const size = Number(details.size)
			if (Number.isFinite(size) && size > storage.maxDownloadMiB * 1024 * 1024)
				return
			const normalized = normalizeUrl(url)
			if (urls.has(normalized)) return
			urls.add(normalized)
			found.push({ url, kind, source })
		}

		for (const attachment of safeList(read(message, 'attachments'))) {
			add(
				read(attachment, 'url') ||
					read(attachment, 'proxy_url') ||
					read(attachment, 'proxyUrl'),
				'attachment',
				{
					fileName: read(attachment, 'filename'),
					mimeType:
						read(attachment, 'content_type') || read(attachment, 'contentType'),
					size: read(attachment, 'size'),
				},
			)
		}

		for (const embed of safeList(read(message, 'embeds'))) {
			const image = safeRecord(read(embed, 'image'))
			add(
				read(image, 'proxy_url') ||
					read(image, 'proxyUrl') ||
					read(image, 'url'),
				'embed image',
				{
					mimeType: read(image, 'content_type') || read(image, 'contentType'),
				},
			)
			if (storage.includeEmbedThumbnails) {
				const thumbnail = safeRecord(read(embed, 'thumbnail'))
				add(
					read(thumbnail, 'proxy_url') ||
						read(thumbnail, 'proxyUrl') ||
						read(thumbnail, 'url'),
					'embed thumbnail',
					{
						mimeType:
							read(thumbnail, 'content_type') || read(thumbnail, 'contentType'),
					},
				)
			}
			const video = safeRecord(read(embed, 'video'))
			add(
				read(video, 'proxy_url') ||
					read(video, 'proxyUrl') ||
					read(video, 'url'),
				'embed video',
				{
					mimeType: read(video, 'content_type') || read(video, 'contentType'),
				},
			)
			add(read(embed, 'url'), 'embed URL', {
				mimeType: read(embed, 'content_type') || read(embed, 'contentType'),
			})
		}
		return found
	}

	function showToast(message, error) {
		try {
			if (error && !storage.showErrorToasts) return
			if (!error && !storage.showSaveToasts) return
			vendetta.ui.toasts.showToast(message)
		} catch (_toastError) {}
	}

	function hasSeen(key) {
		return runtime.pending.has(key) || captureState.seen.includes(key)
	}

	function remember(key) {
		captureState.seen = captureState.seen
			.filter(item => item !== key)
			.concat(key)
			.slice(-MAX_SEEN)
		runtime.captureDirty = true
	}

	function queueDownload(url, key, label, onSuccess) {
		if (!runtime.started || !runtime.mediaManager || hasSeen(key)) return
		if (runtime.pending.size >= MAX_QUEUE) {
			captureState.dropped += 1
			captureState.lastError = 'Download queue full; newest item skipped'
			runtime.captureDirty = true
			if (Date.now() - runtime.lastQueueWarningAt > 10_000) {
				runtime.lastQueueWarningAt = Date.now()
				persistCaptureState()
				showToast('Media queue full; newest item skipped', true)
			}
			return
		}
		const generation = runtime.generation
		const token = { generation }
		runtime.pending.set(key, token)
		runtime.queue = runtime.queue
			.catch(() => undefined)
			.then(async () => {
				try {
					if (
						!runtime.started ||
						generation !== runtime.generation ||
						!runtime.mediaManager ||
						storage.enabled !== true
					)
						return
					const result = await runtime.mediaManager.downloadMediaAsset(url, 1)
					if (
						!runtime.started ||
						generation !== runtime.generation ||
						storage.enabled !== true
					)
						return
					if (result === false) throw new Error('Discord rejected the download')
					remember(key)
					captureState.downloaded += 1
					captureState.lastSavedAt = Date.now()
					captureState.lastError = ''
					if (typeof onSuccess === 'function') onSuccess()
					persistCaptureState()
					showToast(`Saved ${label}`, false)
				} catch (error) {
					if (!runtime.started || generation !== runtime.generation) return
					captureState.failed += 1
					captureState.lastError = boundedString(
						error?.message ? error.message : String(error),
						'Download failed',
						300,
					)
					runtime.captureDirty = true
					persistCaptureState()
					showToast(`Could not save ${label}`, true)
					try {
						vendetta.logger.error('Download failed', error)
					} catch (_loggerError) {}
				} finally {
					if (runtime.pending.get(key) === token) runtime.pending.delete(key)
				}
			})
	}

	function currentUserId() {
		try {
			return firstString(runtime.userStore?.getCurrentUser()?.id) || ''
		} catch (_error) {
			return ''
		}
	}

	function assetCandidate(kind, userId, hash) {
		if (
			!DISCORD_ID.test(String(userId || '')) ||
			!/^(?:a_)?[a-f0-9]{16,64}$/i.test(String(hash || ''))
		) {
			return undefined
		}
		const animated = String(hash).startsWith('a_')
		const extension = animated ? 'gif' : 'png'
		const size = kind === 'avatar' ? 512 : 1024
		return {
			kind,
			userId: String(userId),
			hash: String(hash),
			url: `https://cdn.discordapp.com/${kind === 'avatar' ? 'avatars' : 'banners'}/${userId}/${hash}.${extension}?size=${size}`,
		}
	}

	function maybeSaveAvatar(user) {
		if (!storage.saveAvatarsForAllowlistedUsers) return
		const userId = firstString(
			read(user, 'id'),
			read(user, 'userId'),
			read(user, 'user_id'),
		)
		if (!userId || !storage.allowedUserIds.includes(userId)) return
		if (storage.ignoreBots && read(user, 'bot') === true) return
		if (storage.ignoreSelf && userId === currentUserId()) return
		const candidate = assetCandidate(
			'avatar',
			userId,
			firstString(
				read(user, 'avatar'),
				read(user, 'avatarHash'),
				read(user, 'avatar_hash'),
			),
		)
		if (!candidate || captureState.avatarHistory[userId] === candidate.hash)
			return
		queueDownload(
			candidate.url,
			`avatar:${userId}:${candidate.hash}`,
			'avatar',
			() => {
				captureState.avatarHistory = {
					...captureState.avatarHistory,
					[userId]: candidate.hash,
				}
			},
		)
	}

	function profileRoots(event) {
		const roots = [
			read(event, 'userProfile'),
			read(event, 'profile'),
			read(event, 'user_profile'),
			read(event, 'profileUser'),
			read(event, 'user'),
			read(event, 'payload'),
			event,
		]
		const result = []
		const seen = new Set()
		for (const value of roots) {
			const item = safeRecord(value)
			if (!item || seen.has(item)) continue
			seen.add(item)
			result.push(item)
			for (const key of [
				'userProfile',
				'profile',
				'user_profile',
				'profileUser',
			]) {
				const nested = safeRecord(read(item, key))
				if (nested && !seen.has(nested)) {
					seen.add(nested)
					result.push(nested)
				}
			}
		}
		return result
	}

	function maybeSaveBanner(event) {
		if (!storage.saveBannersForAllowlistedUsers) return
		for (const profile of profileRoots(event)) {
			const user =
				safeRecord(read(profile, 'user')) ||
				safeRecord(read(event, 'user')) ||
				profile
			const userId = firstString(
				read(profile, 'userId'),
				read(profile, 'user_id'),
				read(user, 'id'),
				read(profile, 'id'),
				read(event, 'userId'),
				read(event, 'user_id'),
			)
			if (!userId || !storage.allowedUserIds.includes(userId)) continue
			if (storage.ignoreBots && read(user, 'bot') === true) return
			if (storage.ignoreSelf && userId === currentUserId()) return
			const hash = firstString(
				read(profile, 'banner'),
				read(profile, 'bannerHash'),
				read(profile, 'banner_hash'),
				read(user, 'banner'),
				read(user, 'bannerHash'),
				read(user, 'banner_hash'),
			)
			const candidate = assetCandidate('banner', userId, hash)
			if (!candidate || captureState.bannerHistory[userId] === candidate.hash)
				continue
			queueDownload(
				candidate.url,
				`banner:${userId}:${candidate.hash}`,
				'banner',
				() => {
					captureState.bannerHistory = {
						...captureState.bannerHistory,
						[userId]: candidate.hash,
					}
				},
			)
			return
		}
	}

	function handleMessage(event) {
		if (!runtime.started || !storage.enabled) return
		const message = messageFromEvent(event)
		const context = message && messageContext(message)
		if (!message || !context) return
		if (!context.guildId && runtime.channelStore) {
			try {
				const channel = runtime.channelStore.getChannel(context.channelId)
				context.guildId =
					firstString(read(channel, 'guild_id'), read(channel, 'guildId')) || ''
			} catch (_error) {}
		}
		if (storage.ignoreBots && context.authorIsBot) return
		if (storage.ignoreSelf && context.authorId === currentUserId()) return
		if (!isMessageAllowed(context)) return
		maybeSaveAvatar(context.author)
		for (const media of extractMedia(message)) {
			const key = `media:${normalizeUrl(media.url)}`
			queueDownload(media.url, key, media.kind)
		}
	}

	function resolveModules() {
		runtime.dispatcher = vendetta.metro.common.FluxDispatcher
		runtime.mediaManager = vendetta.metro.findByProps('downloadMediaAsset')
		runtime.userStore =
			vendetta.metro.findByProps('getCurrentUser', 'getUser') ||
			vendetta.metro.findByStoreName('UserStore')
		runtime.channelStore =
			vendetta.metro.findByStoreName('ChannelStore') ||
			vendetta.metro.findByProps('getChannel')
		if (!runtime.dispatcher || !runtime.mediaManager)
			throw new Error('Required Discord media modules were not found')
	}

	function subscribe(type, handler) {
		runtime.dispatcher.subscribe(type, handler)
		runtime.handlers.push([type, handler])
	}

	function onLoad() {
		if (runtime.started) return
		initializeStorage()
		resolveModules()
		runtime.generation += 1
		runtime.queue = Promise.resolve()
		runtime.started = true
		subscribe('MESSAGE_CREATE', handleMessage)
		subscribe('USER_UPDATE', event => {
			const user =
				read(event, 'user') ||
				read(event, 'updatedUser') ||
				read(event, 'currentUser')
			if (user) maybeSaveAvatar(user)
		})
		for (const type of PROFILE_EVENTS) subscribe(type, maybeSaveBanner)
	}

	function onUnload() {
		runtime.started = false
		runtime.generation += 1
		if (runtime.captureDirty) persistCaptureState()
		for (const [type, handler] of runtime.handlers.splice(0)) {
			try {
				runtime.dispatcher.unsubscribe(type, handler)
			} catch (_error) {}
		}
		runtime.pending.clear()
		runtime.queue = Promise.resolve()
		runtime.dispatcher = null
		runtime.mediaManager = null
		runtime.userStore = null
		runtime.channelStore = null
	}

	const UI_COLOR = {
		text: '#f2f3f5',
		muted: '#b5bac1',
		card: '#2b2d31',
		input: '#1e1f22',
		accent: '#5865f2',
		good: '#23a559',
		danger: '#da373c',
	}
	const SECTION_STYLE = {
		color: UI_COLOR.muted,
		fontSize: 12,
		fontWeight: '700',
		letterSpacing: 1,
		textTransform: 'uppercase',
		marginHorizontal: 16,
		marginTop: 20,
		marginBottom: 7,
	}
	const CARD_STYLE = {
		backgroundColor: UI_COLOR.card,
		borderRadius: 14,
		marginHorizontal: 12,
		padding: 14,
		marginBottom: 9,
	}

	function SettingsSection({ children }) {
		const { React, ReactNative } = vendetta.metro.common
		return React.createElement(
			ReactNative.Text,
			{ style: SECTION_STYLE },
			children,
		)
	}

	function SettingsCard({ children }) {
		const { React, ReactNative } = vendetta.metro.common
		return React.createElement(
			ReactNative.View,
			{ style: CARD_STYLE },
			children,
		)
	}

	function SettingsButton({ label, onPress, danger }) {
		const { React, ReactNative } = vendetta.metro.common
		const h = React.createElement
		return h(
			ReactNative.TouchableOpacity,
			{
				onPress,
				style: {
					backgroundColor: danger ? UI_COLOR.danger : UI_COLOR.accent,
					borderRadius: 9,
					paddingVertical: 11,
					paddingHorizontal: 14,
					alignItems: 'center',
					marginTop: 10,
				},
			},
			h(
				ReactNative.Text,
				{ style: { color: '#fff', fontWeight: '700' } },
				label,
			),
		)
	}

	function SettingsSwitchRow({
		label,
		description,
		valueKey,
		disabled,
		onSet,
	}) {
		const { React, ReactNative } = vendetta.metro.common
		const h = React.createElement
		return h(
			ReactNative.TouchableOpacity,
			{
				disabled,
				onPress: () => !disabled && onSet(valueKey, !storage[valueKey]),
				style: {
					flexDirection: 'row',
					alignItems: 'center',
					paddingVertical: 9,
					opacity: disabled ? 0.45 : 1,
				},
			},
			h(
				ReactNative.View,
				{ style: { flex: 1, paddingRight: 12 } },
				h(
					ReactNative.Text,
					{ style: { color: UI_COLOR.text, fontSize: 15, fontWeight: '600' } },
					label,
				),
				description
					? h(
							ReactNative.Text,
							{
								style: {
									color: UI_COLOR.muted,
									fontSize: 12,
									marginTop: 3,
									lineHeight: 17,
								},
							},
							description,
						)
					: null,
			),
			h(ReactNative.Switch, {
				value: Boolean(storage[valueKey]),
				disabled,
				onValueChange: value => !disabled && onSet(valueKey, value),
				trackColor: { true: UI_COLOR.accent },
			}),
		)
	}

	function SettingsIdEditor({
		label,
		draft,
		placeholder,
		onDraftChange,
		onSave,
	}) {
		const { React, ReactNative } = vendetta.metro.common
		const h = React.createElement
		return h(
			SettingsCard,
			h(
				ReactNative.Text,
				{
					style: {
						color: UI_COLOR.text,
						fontSize: 15,
						fontWeight: '700',
						marginBottom: 4,
					},
				},
				label,
			),
			h(
				ReactNative.Text,
				{ style: { color: UI_COLOR.muted, fontSize: 12, marginBottom: 9 } },
				'One Discord ID per line. Commas and spaces also work.',
			),
			h(ReactNative.TextInput, {
				value: draft,
				onChangeText: onDraftChange,
				placeholder,
				placeholderTextColor: '#6d6f78',
				multiline: true,
				autoCapitalize: 'none',
				autoCorrect: false,
				style: {
					backgroundColor: UI_COLOR.input,
					color: UI_COLOR.text,
					borderRadius: 9,
					minHeight: 70,
					padding: 11,
					textAlignVertical: 'top',
				},
			}),
			h(SettingsButton, { label: `Apply ${label}`, onPress: onSave }),
		)
	}

	function Settings() {
		const React = vendetta.metro.common.React
		const RN = vendetta.metro.common.ReactNative
		const { ScrollView, Text, TextInput } = RN
		const h = React.createElement
		const [, rerender] = React.useReducer(value => value + 1, 0)
		const [idDrafts, setIdDrafts] = React.useState({
			allowedUserIds: storage.allowedUserIds.join('\n'),
			allowedGuildIds: storage.allowedGuildIds.join('\n'),
			allowedChannelIds: storage.allowedChannelIds.join('\n'),
		})
		const [maxSizeDraft, setMaxSizeDraft] = React.useState(
			String(storage.maxDownloadMiB),
		)
		const color = UI_COLOR
		const Section = SettingsSection
		const Card = SettingsCard
		const SwitchRow = SettingsSwitchRow
		const Button = SettingsButton
		const IdEditor = SettingsIdEditor
		const set = (key, value) => {
			storage[key] = value
			rerender()
		}
		const updateIdDraft = (key, value) => {
			setIdDrafts(current => ({ ...current, [key]: value }))
		}
		const saveIds = (label, key) => {
			const ids = normalizeIds(idDrafts[key])
			set(key, ids)
			updateIdDraft(key, ids.join('\n'))
			try {
				vendetta.ui.toasts.showToast(
					`Saved ${ids.length} ${label.toLowerCase()}`,
				)
			} catch (_error) {}
		}

		const status = runtime.mediaManager
			? 'Ready'
			: runtime.started
				? 'Media module unavailable'
				: 'Reload plugin to activate'
		return h(
			ScrollView,
			{ style: { flex: 1 }, contentContainerStyle: { paddingBottom: 48 } },
			h(Section, null, 'Status'),
			h(
				Card,
				h(
					Text,
					{ style: { color: color.text, fontSize: 19, fontWeight: '800' } },
					'Selective Media Saver',
				),
				h(
					Text,
					{ style: { color: color.good, marginTop: 5, fontWeight: '700' } },
					`● ${status}`,
				),
				h(
					Text,
					{
						style: {
							color: color.muted,
							fontSize: 12,
							marginTop: 7,
							lineHeight: 17,
						},
					},
					`${VERSION} • ${captureState.downloaded} saved • ${captureState.failed} failed • ${captureState.dropped} skipped`,
				),
				captureState.lastError
					? h(
							Text,
							{ style: { color: '#f0b232', fontSize: 12, marginTop: 6 } },
							`Last error: ${captureState.lastError}`,
						)
					: null,
			),
			h(Section, null, 'Automatic saving'),
			h(
				Card,
				h(SwitchRow, {
					label: 'Plugin enabled',
					description: 'Master switch for automatic downloads.',
					valueKey: 'enabled',
					onSet: set,
				}),
				h(SwitchRow, {
					label: 'Require an allowlist match',
					description: 'Recommended. With empty lists, nothing is saved.',
					valueKey: 'onlySaveAllowlisted',
					onSet: set,
				}),
				h(SwitchRow, {
					label: 'Match any list',
					description:
						'On: user OR server OR channel. Off: every non-empty list must match.',
					valueKey: 'matchAnyAllowlist',
					disabled: !storage.onlySaveAllowlisted,
					onSet: set,
				}),
				h(SwitchRow, {
					label: 'Ignore bots',
					valueKey: 'ignoreBots',
					onSet: set,
				}),
				h(SwitchRow, {
					label: 'Ignore my messages',
					valueKey: 'ignoreSelf',
					onSet: set,
				}),
			),
			h(Section, null, 'Media'),
			h(
				Card,
				h(SwitchRow, {
					label: 'Save images and GIFs',
					valueKey: 'saveImages',
					onSet: set,
				}),
				h(SwitchRow, {
					label: 'Save videos',
					valueKey: 'saveVideos',
					onSet: set,
				}),
				h(SwitchRow, {
					label: 'Include embed thumbnails',
					valueKey: 'includeEmbedThumbnails',
					onSet: set,
				}),
				h(SwitchRow, {
					label: 'Save allowlisted avatars',
					description: 'Saves each new avatar hash once when the user appears.',
					valueKey: 'saveAvatarsForAllowlistedUsers',
					onSet: set,
				}),
				h(SwitchRow, {
					label: 'Save allowlisted banners',
					description:
						'Saves each new banner hash once when Discord loads a profile.',
					valueKey: 'saveBannersForAllowlistedUsers',
					onSet: set,
				}),
				h(
					Text,
					{
						style: {
							color: color.text,
							fontSize: 14,
							fontWeight: '600',
							marginTop: 10,
						},
					},
					'Known attachment limit (MiB)',
				),
				h(
					Text,
					{
						style: {
							color: color.muted,
							fontSize: 12,
							marginTop: 3,
							marginBottom: 8,
							lineHeight: 17,
						},
					},
					'Applied when Discord includes the file size. Classic cannot preflight every external embed.',
				),
				h(TextInput, {
					value: maxSizeDraft,
					onChangeText: setMaxSizeDraft,
					keyboardType: 'number-pad',
					style: {
						backgroundColor: color.input,
						color: color.text,
						borderRadius: 9,
						padding: 11,
					},
				}),
				h(Button, {
					label: 'Apply size limit',
					onPress: () => {
						const limit = Math.max(
							1,
							Math.min(
								MAX_DOWNLOAD_MIB,
								Math.round(Number(maxSizeDraft) || DEFAULTS.maxDownloadMiB),
							),
						)
						set('maxDownloadMiB', limit)
						setMaxSizeDraft(String(limit))
					},
				}),
			),
			h(Section, null, 'Allowlist IDs'),
			h(IdEditor, {
				label: 'Users',
				draft: idDrafts.allowedUserIds,
				onDraftChange: value => updateIdDraft('allowedUserIds', value),
				onSave: () => saveIds('Users', 'allowedUserIds'),
				placeholder: '123456789012345678',
			}),
			h(IdEditor, {
				label: 'Servers',
				draft: idDrafts.allowedGuildIds,
				onDraftChange: value => updateIdDraft('allowedGuildIds', value),
				onSave: () => saveIds('Servers', 'allowedGuildIds'),
				placeholder: '123456789012345678',
			}),
			h(IdEditor, {
				label: 'Channels',
				draft: idDrafts.allowedChannelIds,
				onDraftChange: value => updateIdDraft('allowedChannelIds', value),
				onSave: () => saveIds('Channels', 'allowedChannelIds'),
				placeholder: '123456789012345678',
			}),
			h(Section, null, 'Feedback and history'),
			h(
				Card,
				h(SwitchRow, {
					label: 'Show saved toasts',
					valueKey: 'showSaveToasts',
					onSet: set,
				}),
				h(SwitchRow, {
					label: 'Show error toasts',
					valueKey: 'showErrorToasts',
					onSet: set,
				}),
				h(Button, {
					label: `Clear download history (${captureState.seen.length})`,
					onPress: () => {
						captureState.seen = []
						captureState.avatarHistory = {}
						captureState.bannerHistory = {}
						persistCaptureState()
						rerender()
						showToast('Download history cleared', false)
					},
					danger: true,
				}),
			),
			h(Section, null, 'Classic Revenge note'),
			h(
				Card,
				h(
					Text,
					{ style: { color: color.muted, fontSize: 13, lineHeight: 19 } },
					'Downloads use Discord’s Android media saver. Discord chooses the final public download location and filename. The newer Revenge build has custom albums, filenames, and advanced file tools.',
				),
			),
		)
	}

	initializeStorage()
	return {
		onLoad,
		onUnload,
		settings: Settings,
		__testing: {
			normalizeIds,
			classify,
			messageFromEvent,
			messageContext,
			isMessageAllowed,
			extractMedia,
			normalizeUrl,
			assetCandidate,
			isSafeUrl,
		},
	}
}
