import assert from 'node:assert/strict'
import test from 'node:test'
import {
	createMediaHistory,
	mediaSearchRequest,
	standardMediaSearchRequest,
} from './workspaceMedia'
import {
	imageUri,
	messageRecords,
	normalizeAccount,
	thumbnailUri,
} from './workspaceModel'
import type { MediaCursor, MediaSearchMode } from './workspaceMedia'

const channel = '323456789012345678',
	other = '423456789012345678',
	user = '123456789012345678'
const raw = (suffix: number, overrides: Record<string, unknown> = {}) => ({
	id: String(523456789012345000n + BigInt(suffix)),
	channel_id: channel,
	author: { id: user, username: 'Alex' },
	content: 'private message body',
	attachments: [
		{
			id: String(623456789012345000n + BigInt(suffix)),
			filename: `${suffix}.png`,
			content_type: 'image/png',
			url: `https://cdn.discordapp.com/attachments/${channel}/623456789012345678/${suffix}.png?ex=1&hm=abc`,
		},
	],
	...overrides,
})
const response = (
	messages: unknown[],
	cursor: MediaCursor = null,
	extra = {},
) => ({
	status: 200,
	body: { tabs: { media: { messages, cursor, total_results: 100 } }, ...extra },
})
function fixture(maxMessages = 5000) {
	let account = user,
		allowed = true,
		time = 1000,
		serial = 0
	const timers = new Map<number, { at: number; fn(): void }>()
	const calls: Array<{
		channel: string
		cursor: MediaCursor
		mode: MediaSearchMode
		signal: AbortSignal
		resolve(value: any): void
		reject(error: unknown): void
	}> = []
	const history = createMediaHistory({
		account: () => account,
		allowed: () => allowed,
		visible: m => m.author?.id !== 'blocked',
		maxMessages,
		request: (channel, cursor, signal, mode) =>
			new Promise((resolve, reject) =>
				calls.push({ channel, cursor, signal, mode, resolve, reject }),
			),
		changed() {},
		now: () => time,
		schedule: (fn, ms) => {
			const id = ++serial
			timers.set(id, { at: time + ms, fn })
			return id as unknown as ReturnType<typeof setTimeout>
		},
		cancel: timer => {
			timers.delete(timer as unknown as number)
		},
	})
	const flush = async () => {
		await Promise.resolve()
		await Promise.resolve()
	}
	return {
		history,
		calls,
		timers,
		flush,
		async answer(value: unknown, index = calls.length - 1) {
			calls[index].resolve(value)
			await flush()
		},
		async tick(ms = 1200) {
			time += ms
			for (const [id, timer] of [...timers])
				if (timer.at <= time) {
					timers.delete(id)
					timer.fn()
				}
			await flush()
		},
		account(value: string) {
			account = value
			history.sync()
		},
		allow(value: boolean) {
			allowed = value
			history.sync()
		},
	}
}

test('native search requests target only the selected conversation with newest media first', () => {
	const endpoints = {
		SEARCH_TABS_GUILD: (id: string) => `/guilds/${id}/messages/search/tabs`,
		SEARCH_TABS_CHANNEL: (id: string) => `/channels/${id}/messages/search/tabs`,
	}
	const request = mediaSearchRequest(channel, other, 'opaque cursor', endpoints)
	assert.equal(request.url, `/guilds/${other}/messages/search/tabs`)
	assert.deepEqual(request.body.channel_ids, [channel])
	assert.deepEqual(request.body.tabs.media, {
		has: ['image', 'video'],
		sort_by: 'timestamp',
		sort_order: 'desc',
		limit: 25,
		cursor: 'opaque cursor',
	})
	assert.equal(request.body.include_nsfw, false)
	assert.equal(
		mediaSearchRequest(channel, '', null, endpoints).url,
		`/channels/${channel}/messages/search/tabs`,
	)
	assert.throws(() => mediaSearchRequest('bad', '', null, endpoints))
	assert.throws(() => mediaSearchRequest(channel, '', null, {}))
})

test('automatically pages beyond cache, deduplicates hits, filters foreign/blocked context, and strips message text', async () => {
	const f = fixture()
	f.history.start(channel)
	f.history.start(channel)
	assert.equal(f.calls.length, 1)
	await f.answer(
		response(
			[
				[raw(3), raw(2, { hit: false })],
				[raw(2, { hit: true })],
				[raw(4, { channel_id: other })],
				[raw(5, { author: { id: 'blocked' } })],
			],
			'next',
		),
	)
	assert.equal(f.history.snapshot().status, 'loading')
	assert.deepEqual(
		f.history.snapshot().messages.map(m => m.id),
		[raw(3).id, raw(2).id],
	)
	assert.equal(f.history.snapshot().messages[0].content, '')
	await f.tick()
	assert.equal(f.calls[1].cursor, 'next')
	await f.answer(response([[raw(2)], [raw(1)]], null))
	assert.equal(f.history.snapshot().status, 'complete')
	assert.equal(f.history.snapshot().messages.length, 3)
	assert.equal(f.timers.size, 0)
	f.history.start(channel)
	assert.equal(f.calls.length, 2)
	f.history.dispose()
})

test('pause aborts the current request and resume retries that page without accepting late results', async () => {
	const f = fixture()
	f.history.start(channel)
	f.history.pause()
	assert.ok(f.calls[0].signal.aborted)
	f.history.start(channel)
	await f.answer(response([[raw(9)]]), 0)
	assert.equal(f.history.snapshot().messages.length, 0)
	await f.answer(response([[raw(1)]]), 1)
	assert.equal(f.history.snapshot().messages[0].id, raw(1).id)
	f.history.dispose()
})

test('pause between pages cancels the timer, retaining results and cursor', async () => {
	const f = fixture()
	f.history.start(channel)
	await f.answer(response([[raw(3)]], 'next'))
	f.history.pause()
	await f.tick(5000)
	assert.equal(f.calls.length, 1)
	assert.equal(f.history.snapshot().messages.length, 1)
	f.history.start(channel)
	assert.equal(f.calls[1].cursor, 'next')
	f.history.dispose()
})

test('changing channels discards an outstanding response from the previous conversation', async () => {
	const f = fixture()
	f.history.start(channel)
	f.history.start(other)
	await f.answer(response([[raw(1)]]), 0)
	assert.equal(f.history.snapshot().channelId, other)
	assert.equal(f.history.snapshot().messages.length, 0)
	await f.answer(response([[raw(2, { channel_id: other })]]), 1)
	assert.equal(f.history.snapshot().messages[0].channelId, other)
	f.history.dispose()
})

test('account changes and lost permissions cancel requests and clear private results', async () => {
	for (const change of ['account', 'permission']) {
		const f = fixture()
		f.history.start(channel)
		await f.answer(response([[raw(3)]], 'next'))
		await f.tick()
		if (change === 'account') f.account(other)
		else f.allow(false)
		assert.ok(f.calls[1].signal.aborted)
		await f.answer(response([[raw(1)]]))
		assert.equal(f.history.snapshot().messages.length, 0)
		assert.equal(f.history.snapshot().channelId, '')
		f.history.dispose()
	}
})

test('rate-limit cooldown survives pause, resume, and refresh', async () => {
	const f = fixture()
	f.history.start(channel)
	await f.answer({ status: 429, body: { retry_after: 12 } })
	assert.equal(f.history.snapshot().status, 'waiting')
	f.history.pause()
	f.history.start(channel)
	f.history.refresh(channel)
	await f.tick(11000)
	assert.equal(f.calls.length, 1)
	await f.tick(1000)
	assert.equal(f.calls.length, 2)
	f.history.dispose()
})

test('indexing retries are bounded and historical indexing does not claim completion', async () => {
	const f = fixture()
	f.history.start(channel)
	for (let i = 0; i < 6; i++) {
		await f.answer({ status: 202, headers: { 'retry-after': '2' } })
		if (i < 5) await f.tick(2000)
	}
	assert.equal(f.history.snapshot().status, 'paused')
	assert.equal(f.timers.size, 0)
	await f.tick(2000)
	f.history.start(channel)
	await f.answer(
		response([[raw(1)]], null, { doing_deep_historical_index: true }),
	)
	assert.equal(f.history.snapshot().status, 'partial')
	f.history.dispose()
})

test('rejected rate limits use the same delay and transient failures preserve the loaded batch', async () => {
	const f = fixture()
	f.history.start(channel)
	await f.answer(response([[raw(3)]], 'next'))
	await f.tick()
	f.calls[1].reject({ status: 429, body: { retry_after: 3 } })
	await f.flush()
	assert.equal(f.history.snapshot().status, 'waiting')
	await f.tick(3000)
	f.calls[2].reject(new Error('Offline'))
	await f.flush()
	assert.equal(f.history.snapshot().status, 'error')
	assert.equal(f.history.snapshot().messages.length, 1)
	f.history.start(channel)
	assert.equal(f.calls[3].cursor, 'next')
	f.history.dispose()
})

test('invalid responses and repeated cursors fail visibly instead of looping or claiming all images loaded', async () => {
	const f = fixture()
	f.history.start(channel)
	await f.answer({ status: 200, body: {} })
	assert.equal(f.history.snapshot().status, 'waiting')
	await f.tick()
	assert.equal(f.calls[1].mode, 'messages')
	await f.answer({ status: 200, body: {} })
	assert.equal(f.history.snapshot().status, 'error')
	f.history.refresh(channel)
	await f.answer(response([[raw(3)]], 'same'))
	await f.tick()
	await f.answer(response([[raw(3)]], 'same'))
	assert.equal(f.history.snapshot().status, 'error')
	assert.match(f.history.snapshot().detail, /repeated/)
	assert.equal(f.timers.size, 0)
	f.history.dispose()
})

test('structured search cursors round-trip unchanged and repeated objects stop pagination', async () => {
	const f = fixture()
	const cursor = { before: raw(1).id, sort: [1720000000, 'tie-breaker'] }
	f.history.start(channel)
	await f.answer(response([[raw(3)]], cursor))
	assert.equal(f.history.snapshot().status, 'loading')
	await f.tick()
	assert.deepEqual(f.calls[1].cursor, cursor)
	assert.equal(f.calls[1].mode, 'tabs')
	await f.answer(
		response([[raw(2)]], { sort: cursor.sort, before: cursor.before }),
	)
	assert.equal(f.history.snapshot().status, 'error')
	assert.match(f.history.snapshot().detail, /repeated/)
	f.history.dispose()
})

test('unsupported tabs fall back once to standard search and page past the first 25 hits', async () => {
	const f = fixture()
	f.history.start(channel)
	await f.answer({ status: 200, body: { tabs: {} } })
	assert.equal(f.history.snapshot().status, 'waiting')
	await f.tick()
	assert.equal(f.calls[1].mode, 'messages')
	assert.equal(f.calls[1].cursor, null)
	await f.answer({
		status: 200,
		body: {
			messages: Array.from({ length: 25 }, (_, i) => [raw(30 - i)]),
			total_results: 26,
		},
	})
	await f.tick()
	assert.equal(f.calls[2].cursor, raw(6).id)
	assert.equal(f.calls[2].mode, 'messages')
	await f.answer({
		status: 200,
		body: {
			messages: [
				[raw(1)],
				[raw(2, { author: { id: 'blocked' } })],
				[raw(3, { channel_id: other })],
			],
			total_results: 3,
		},
	})
	assert.equal(f.history.snapshot().status, 'complete')
	assert.equal(f.history.snapshot().messages.length, 26)
	assert.ok(
		f.history
			.snapshot()
			.messages.every(m => m.content === '' && m.channelId === channel),
	)
	f.history.dispose()
})

test('fallback requests remain conversation-scoped and use the native GET endpoint with an exclusive older-message boundary', () => {
	const endpoints = {
		SEARCH_GUILD: (id: string) => `/guilds/${id}/messages/search`,
		SEARCH_CHANNEL: (id: string) => `/channels/${id}/messages/search`,
	}
	for (const guildId of ['', other]) {
		const request = standardMediaSearchRequest(
			channel,
			guildId,
			raw(6).id,
			endpoints,
		)
		assert.equal(
			request.url,
			guildId
				? `/guilds/${guildId}/messages/search`
				: `/channels/${channel}/messages/search`,
		)
		const query = new URLSearchParams(request.query)
		assert.deepEqual(query.getAll('channel_id'), [channel])
		assert.deepEqual(query.getAll('has'), ['image', 'video'])
		assert.equal(query.get('max_id'), raw(6).id)
		assert.equal(query.get('include_nsfw'), 'false')
		assert.equal(query.get('sort_order'), 'desc')
	}
	assert.throws(() =>
		standardMediaSearchRequest(channel, '', { opaque: true }, endpoints),
	)
})

test('structured cursor limits trigger compatibility search instead of sending unbounded JSON', async () => {
	for (const cursor of [
		{ value: 'x'.repeat(16385) },
		Number.NaN,
		{ invalid: () => {} },
	]) {
		const f = fixture()
		f.history.start(channel)
		await f.answer({
			status: 200,
			body: { tabs: { media: { messages: [], cursor } } },
		})
		await f.tick()
		assert.equal(f.calls[1].mode, 'messages')
		assert.equal(f.calls[1].cursor, null)
		f.history.dispose()
	}
})

test('pause and account changes cancel a queued compatibility request; rate limits never trigger fallback', async () => {
	const f = fixture()
	f.history.start(channel)
	await f.answer({ status: 200, body: {} })
	f.history.pause()
	await f.tick()
	assert.equal(f.calls.length, 1)
	f.history.start(channel)
	assert.equal(f.calls[1].mode, 'messages')
	await f.answer({ status: 429, body: { retry_after: 10 } })
	await f.tick(9999)
	assert.equal(f.calls.length, 2)
	f.account(other)
	await f.tick(10000)
	assert.equal(f.calls.length, 2)
	assert.equal(f.history.snapshot().messages.length, 0)
	f.history.dispose()
})

test('unsupported tab endpoints fall back but access-denied responses never do', async () => {
	for (const status of [400, 404, 405, 501]) {
		const f = fixture()
		f.history.start(channel)
		f.calls[0].reject({ status })
		await f.flush()
		await f.tick()
		assert.equal(f.calls[1].mode, 'messages')
		f.history.dispose()
	}
	const f = fixture()
	f.history.start(channel)
	await f.answer({ status: 403, body: {} })
	await f.tick()
	assert.equal(f.calls.length, 1)
	assert.equal(f.history.snapshot().status, 'error')
	f.history.dispose()
})

test('large libraries expose older batches with the retained cursor rather than silently truncating history', async () => {
	const f = fixture(2)
	f.history.start(channel)
	await f.answer(response([[raw(3)], [raw(2)]], 'older'))
	assert.equal(f.history.snapshot().status, 'limited')
	f.history.older()
	await f.tick()
	assert.equal(f.calls[1].cursor, 'older')
	await f.answer(response([[raw(1)]]))
	assert.deepEqual(
		f.history.snapshot().messages.map(m => m.id),
		[raw(1).id],
	)
	f.history.dispose()
})

test('disposal cancels scheduled work and rejects all late results', async () => {
	const f = fixture()
	f.history.start(channel)
	f.history.dispose()
	await f.answer(response([[raw(1)]], 'next'))
	await f.tick(10000)
	assert.equal(f.calls.length, 1)
	assert.equal(f.history.snapshot().messages.length, 0)
	assert.equal(f.timers.size, 0)
})

test('Discord-proxied image embeds get stable collection identifiers and small signed thumbnails', () => {
	const url =
		'https://images-ext-1.discordapp.net/external/hash/https/example.com/image.png'
	const [m] = messageRecords(
		[
			raw(1, {
				content: '||spoiler||',
				embeds: [{ image: { proxy_url: url } }],
			}),
		],
		channel,
	)
	assert.equal(m.attachments[1].id, 'embed:0')
	assert.equal(m.attachments[1].spoiler, true)
	assert.match(m.attachments[1].thumbnail!, /width=480/)
	assert.equal(
		normalizeAccount({
			media: [{ channelId: channel, messageId: m.id, attachmentId: 'embed:0' }],
		}).media.length,
		1,
	)
	assert.equal(imageUri('https://evil.example/image.png'), '')
	assert.equal(
		imageUri('https://images-ext-1.discordapp.net.evil.example/external/a'),
		'',
	)
	assert.match(
		thumbnailUri(m.attachments[0].url),
		/media\.discordapp\.net.*ex=1&hm=abc&width=480/,
	)
})
