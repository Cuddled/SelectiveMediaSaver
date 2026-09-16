import assert from 'node:assert/strict'
import test from 'node:test'
import {
	addProfileHistoryEntry,
	DEFAULT_SETTINGS,
	hasProfileAsset,
	normalizeProfileHistory,
	normalizeSettings,
	sanitizeFolderSegment,
} from './defaults'
import {
	buildDownloadRequest,
	extractMedia,
	httpsHost,
	isMessageAllowed,
	messageContext,
	messageFromEvent,
	seenKey,
} from './media'
import {
	avatarCandidateFromUser,
	bannerCandidateFromProfileEvent,
	PROFILE_EVENT_TYPES,
	userFromUserUpdateEvent,
} from './profile-media'
import { SeenKeyCache } from './runtime'

test('settings normalization supplies safe defaults and cleans persisted input', () => {
	const settings = normalizeSettings({
		allowedUserIds: [' 123456789012345 ', 'bad', '123456789012345'],
		allowedGuildIds: null,
		maxDownloadMiB: 9_999,
		albumName: '../My\\Album',
		enabled: 'yes',
	})

	assert.equal(settings.enabled, DEFAULT_SETTINGS.enabled)
	assert.deepEqual(settings.allowedUserIds, ['123456789012345'])
	assert.deepEqual(settings.allowedGuildIds, [])
	assert.equal(settings.maxDownloadMiB, 512)
	assert.equal(settings.albumName, '-My-Album')
})

test('folder names never keep traversal separators or control characters', () => {
	assert.equal(sanitizeFolderSegment('  Photos/2026\u0000  '), 'Photos-2026-')
	assert.equal(sanitizeFolderSegment('...'), DEFAULT_SETTINGS.albumName)
})

test('message payload and context parsing tolerates Discord event variants', () => {
	const message = {
		id: 'm1',
		channel_id: 'c1',
		guildId: 'g1',
		author: { id: 'u1', global_name: 'Display', bot: false },
	}
	assert.equal(messageFromEvent({ optimisticMessage: message }), message)
	assert.deepEqual(messageContext(message), {
		id: 'm1',
		channelId: 'c1',
		guildId: 'g1',
		authorId: 'u1',
		authorName: 'Display',
		authorIsBot: false,
	})
})

test('allowlist any mode accepts one match and an empty allowlist denies', () => {
	const context = {
		id: 'm1',
		channelId: 'c1',
		guildId: 'g1',
		authorId: 'u1',
		authorName: 'User',
		authorIsBot: false,
	}
	const empty = normalizeSettings(undefined)
	assert.equal(isMessageAllowed(context, empty), false)

	const any = normalizeSettings({ allowedGuildIds: ['123456789012345'] })
	assert.equal(
		isMessageAllowed({ ...context, guildId: '123456789012345' }, any),
		true,
	)
})

test('allowlist all mode requires every configured category', () => {
	const settings = normalizeSettings({
		matchAnyAllowlist: false,
		allowedUserIds: ['123456789012345'],
		allowedChannelIds: ['223456789012345'],
	})
	const base = {
		id: 'm1',
		guildId: '',
		authorName: 'User',
		authorIsBot: false,
	}

	assert.equal(
		isMessageAllowed(
			{
				...base,
				authorId: '123456789012345',
				channelId: '223456789012345',
			},
			settings,
		),
		true,
	)
	assert.equal(
		isMessageAllowed(
			{
				...base,
				authorId: '123456789012345',
				channelId: '323456789012345',
			},
			settings,
		),
		false,
	)
})

test('media extraction finds supported attachments and embeds once', () => {
	const settings = normalizeSettings({ onlySaveAllowlisted: false })
	const message = {
		id: 'm1',
		channel_id: 'c1',
		author: { id: 'u1' },
		attachments: [
			{
				url: 'https://cdn.discordapp.com/attachments/a/b/photo.png?one=1',
				filename: 'photo.png',
				content_type: 'image/png',
				size: 42,
			},
		],
		embeds: [
			{
				image: {
					url: 'https://cdn.discordapp.com/attachments/a/b/photo.png?two=2',
				},
				video: {
					url: 'https://media.discordapp.net/attachments/a/b/clip.mp4',
					content_type: 'video/mp4',
				},
			},
		],
	}

	const found = extractMedia(message, settings)
	assert.equal(found.length, 2)
	assert.deepEqual(
		found.map(item => item.kind),
		['image', 'video'],
	)
	assert.equal(found[0].size, 42)
})

test('capture switches filter kinds and optional thumbnails', () => {
	const settings = normalizeSettings({
		onlySaveAllowlisted: false,
		saveImages: false,
		saveVideos: true,
		includeEmbedThumbnails: false,
	})
	const found = extractMedia(
		{
			id: 'm1',
			channel_id: 'c1',
			author: { id: 'u1' },
			attachments: [
				{ url: 'https://cdn.discordapp.com/a.png' },
				{ url: 'https://cdn.discordapp.com/a.mp4' },
			],
			embeds: [
				{ thumbnail: { url: 'https://media.discordapp.net/thumb.png' } },
			],
		},
		settings,
	)

	assert.equal(found.length, 1)
	assert.equal(found[0].kind, 'video')
})

test('download request sanitizes names and applies visual folder mode', () => {
	const settings = normalizeSettings({
		onlySaveAllowlisted: false,
		albumName: 'Saved/Media',
		separateFoldersByType: true,
		maxDownloadMiB: 25,
	})
	const request = buildDownloadRequest(
		{
			id: 'm1',
			channelId: 'c1',
			guildId: 'g1',
			authorId: 'u1',
			authorName: 'User',
			authorIsBot: false,
		},
		{
			source: 'attachment',
			url: 'https://cdn.discordapp.com/attachments/a/b/test.png',
			kind: 'image',
			extension: '.png',
			fileName: '../bad:name.png',
			mimeType: 'image/png',
		},
		0,
		settings,
	)

	assert.equal(request.fileName, '-bad-name.png')
	assert.equal(request.folder, 'Saved-Media Images')
	assert.equal(request.maxBytes, 25 * 1024 * 1024)
})

test('URL helpers accept TLS hosts and make stable signed-URL keys', () => {
	assert.equal(
		httpsHost('https://CDN.DiscordApp.com/a.png?x=1'),
		'cdn.discordapp.com',
	)
	assert.equal(httpsHost('http://cdn.discordapp.com/a.png'), undefined)
	assert.equal(
		seenKey('m1', 'https://cdn.discordapp.com/a.png?signature=one'),
		seenKey('m1', 'https://cdn.discordapp.com/a.png?signature=two'),
	)
})

test('seen-key cache is bounded and evicts its oldest key', () => {
	const cache = new SeenKeyCache(2)
	assert.equal(cache.addIfNew('a'), true)
	assert.equal(cache.addIfNew('a'), false)
	assert.equal(cache.addIfNew('b'), true)
	assert.equal(cache.addIfNew('c'), true)
	assert.equal(cache.addIfNew('a'), true)
})

test('avatar candidates construct exact Discord CDN URLs from safe fields', () => {
	const staticAvatar = avatarCandidateFromUser({
		id: '123456789012345678',
		avatar: '0123456789abcdef0123456789abcdef',
		global_name: 'Display',
	})
	assert.deepEqual(staticAvatar, {
		kind: 'avatar',
		userId: '123456789012345678',
		userName: 'Display',
		userIsBot: false,
		assetHash: '0123456789abcdef0123456789abcdef',
		url: 'https://cdn.discordapp.com/avatars/123456789012345678/0123456789abcdef0123456789abcdef.png?size=512',
		extension: '.png',
		mimeType: 'image/png',
	})

	const animated = avatarCandidateFromUser({
		id: '223456789012345678',
		avatarHash: 'a_abcdef0123456789abcdef0123456789',
	})
	assert.equal(animated?.extension, '.gif')
	assert.equal(animated?.mimeType, 'image/gif')
	assert.equal(animated?.userName, 'user-345678')
	assert.equal(
		animated?.url,
		'https://cdn.discordapp.com/avatars/223456789012345678/a_abcdef0123456789abcdef0123456789.gif?size=512',
	)
})

test('avatar candidates reject IDs, path-like hashes, and direct URL-only fields', () => {
	assert.equal(
		avatarCandidateFromUser({
			id: 'not-an-id',
			avatar: '0123456789abcdef0123456789abcdef',
		}),
		undefined,
	)
	assert.equal(
		avatarCandidateFromUser({
			id: '123456789012345678',
			avatar: '../../attachments/evil',
		}),
		undefined,
	)
	assert.equal(
		avatarCandidateFromUser({
			id: '123456789012345678',
			avatarUrl: 'https://cdn.discordapp.com/avatars/id/hash.png',
		}),
		undefined,
	)
})

test('USER_UPDATE helper handles documented wrappers without trusting numbers', () => {
	const user = {
		id: '123456789012345678',
		avatar: '0123456789abcdef0123456789abcdef',
	}
	assert.equal(userFromUserUpdateEvent({ user }), user)
	assert.equal(userFromUserUpdateEvent({ users: [user] }), user)
	assert.equal(userFromUserUpdateEvent({ updatedUser: user }), user)
	assert.equal(userFromUserUpdateEvent({ currentUser: user }), user)
	assert.equal(userFromUserUpdateEvent({ users: [null, user] }), user)
	assert.equal(
		avatarCandidateFromUser({ ...user, id: Number('123456789012345678') }),
		undefined,
	)
})

test('banner candidates support documented profile wrappers and construct CDN URLs', () => {
	const user = { id: '123456789012345678', username: 'BannerUser' }
	const banner = 'abcdef0123456789abcdef0123456789'
	for (const payload of [
		{ userProfile: { user, banner } },
		{ profile: { user, bannerHash: banner } },
		{ user_profile: { user, banner_hash: banner } },
		{ profileUser: { user, banner } },
		{ user: { ...user, banner } },
		{ payload: { user, banner } },
	]) {
		const candidate = bannerCandidateFromProfileEvent(payload)
		assert.equal(candidate?.userId, user.id)
		assert.equal(candidate?.userName, 'BannerUser')
		assert.equal(
			candidate?.url,
			`https://cdn.discordapp.com/banners/${user.id}/${banner}.png?size=1024`,
		)
	}

	const animated = bannerCandidateFromProfileEvent({
		profile: {
			userId: user.id,
			banner: 'a_abcdef0123456789abcdef0123456789',
		},
	})
	assert.equal(animated?.extension, '.gif')
	assert.equal(animated?.mimeType, 'image/gif')
})

test('profile payload helpers ignore URL fields and malformed throwing objects', () => {
	assert.equal(
		bannerCandidateFromProfileEvent({
			userProfile: {
				userId: '123456789012345678',
				bannerUrl: 'https://cdn.discordapp.com/banners/id/hash.png',
			},
		}),
		undefined,
	)
	assert.equal(
		bannerCandidateFromProfileEvent({
			profile: { userId: '123456789012345678', banner: null },
		}),
		undefined,
	)
	const throwing = new Proxy(
		{},
		{
			get() {
				throw new Error('nope')
			},
		},
	)
	assert.doesNotThrow(() => avatarCandidateFromUser(throwing))
	assert.doesNotThrow(() => bannerCandidateFromProfileEvent(throwing))
	assert.equal(avatarCandidateFromUser(throwing), undefined)
	assert.equal(bannerCandidateFromProfileEvent(throwing), undefined)
})

test('profile event list contains the foreground Discord variants', () => {
	assert.deepEqual(PROFILE_EVENT_TYPES, [
		'USER_PROFILE_FETCH_SUCCESS',
		'USER_PROFILE_FETCH_COMPLETED',
		'USER_PROFILE_UPDATE',
		'USER_PROFILE_FETCH',
		'USER_PROFILE_MODAL_FETCH_SUCCESS',
	])
})

test('profile history migration preserves desktop hashes and enforces bounds', () => {
	const migrated = normalizeProfileHistory({
		'123456789012345678':
			'123456789012345678:0123456789abcdef0123456789abcdef:Display Name',
		'223456789012345678': 'abcdef0123456789abcdef0123456789',
	})
	assert.equal(migrated.length, 2)
	assert.equal(migrated[0].assetHash, '0123456789abcdef0123456789abcdef')
	assert.equal(
		hasProfileAsset(
			migrated,
			'223456789012345678',
			'abcdef0123456789abcdef0123456789',
		),
		true,
	)

	let history = migrated
	for (let index = 0; index < 10; index += 1) {
		history = addProfileHistoryEntry(history, {
			userId: '323456789012345678',
			assetHash: index.toString(16).padStart(32, 'a'),
			savedAt: index,
		})
	}
	assert.equal(
		history.filter(entry => entry.userId === '323456789012345678').length,
		8,
	)
	for (let index = 0; index < 260; index += 1) {
		history = addProfileHistoryEntry(history, {
			userId: String(400_000_000_000_000_000n + BigInt(index)),
			assetHash: index.toString(16).padStart(32, 'b'),
			savedAt: 100 + index,
		})
	}
	assert.equal(history.length, 256)
	assert.equal(history.at(-1)?.savedAt, 359)
})
