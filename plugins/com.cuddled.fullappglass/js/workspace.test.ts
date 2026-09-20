import assert from 'node:assert/strict'
import test from 'node:test'
import { normalize, runtime } from './core'
import { createSettingsWriter, setSettingsWriter } from './settingsWriter'
import { createStudioData } from './studioData'
import { playerDocument } from './WorkspacePlayer'
import { createWorkspaceData } from './workspaceData'
import { createReadingTracker, visibleAnchor } from './workspaceHooks'
import {
	accountFor,
	activeRule,
	emptyAccount,
	filterMessages,
	mediaUri,
	messageRecords,
	moveWidget,
	normalizeAccount,
	normalizeWorkspace,
	paletteFor,
	transcriptLines,
	updateAccount,
	wheelIndex,
} from './workspaceModel'

const me = '123456789012345678',
	other = '223456789012345678',
	channel = '323456789012345678',
	guild = '423456789012345678',
	message = '523456789012345678',
	attachment = '623456789012345678'
const sample = {
	id: message,
	channel_id: channel,
	author: { username: 'Alex' },
	content: 'Tonight? https://example.com/playlist',
	timestamp: '2026-09-20T12:00:00Z',
	attachments: [
		{
			id: attachment,
			filename: 'clip.mp4',
			content_type: 'video/mp4',
			url: `https://cdn.discordapp.com/attachments/${channel}/${attachment}/clip.mp4?ex=123&hm=abc`,
		},
	],
}
function setup() {
	runtime.update({ enabled: true })
	const home = createStudioData()
	home.start()
	let current = me,
		selected = channel,
		allowed = true
	const users = {
		getCurrentUser: () => ({ id: current, username: 'Me' }),
		getUser: (id: string) => ({ id, username: 'Alex' }),
	}
	const channels = {
		getChannel: (id: string) =>
			id === channel
				? { id, guild_id: guild, name: 'general' }
				: id === other
					? { id, recipients: [me] }
					: undefined,
		getSortedPrivateChannels: () => [{ id: other, recipients: [me] }],
	}
	const selectedChannel = {
		getChannelId: () => selected,
		getVoiceChannelId: () => '',
	}
	home.attach('users', users)
	home.attach('channels', channels)
	home.attach('selectedChannel', selectedChannel)
	const workspace = createWorkspaceData(home),
		calls: any[] = []
	workspace.attach('channels', channels)
	workspace.attach('selectedChannel', selectedChannel)
	workspace.attach('permissions', { can: () => allowed })
	workspace.attach('permissionConstants', {
		Permissions: { VIEW_CHANNEL: 1024n, READ_MESSAGE_HISTORY: 65536n },
	})
	workspace.attach('messages', {
		getMessages: () => ({ toArray: () => [sample] }),
	})
	workspace.attach('channel', {
		transitionToMessage: async (...args: any[]) => {
			calls.push(args)
		},
	})
	const storage = {
		cache: runtime.getSettings(),
		set: async (value: any) => {
			storage.cache = value
		},
	}
	const writer = createSettingsWriter(storage)
	setSettingsWriter(writer)
	return {
		home,
		workspace,
		calls,
		storage,
		account: (id: string) => {
			current = id
			home.invalidate()
		},
		select: (id: string) => {
			selected = id
			home.invalidate()
		},
		allow: (value: boolean) => {
			allowed = value
			home.invalidate()
		},
		close() {
			workspace.dispose()
			home.dispose()
			writer.stop()
			setSettingsWriter(undefined)
		},
	}
}

test('workspace migration preserves appearance and has no shared private data', () => {
	const old = normalize({ accentColor: '#123456', studio: { mood: 'waves' } })
	assert.equal(old.accentColor, '#123456')
	assert.equal(old.studio.mood, 'waves')
	assert.deepEqual(old.workspace.accounts, {})
	const a = emptyAccount(),
		b = emptyAccount()
	a.widgets.pop()
	assert.equal(b.widgets.length, 6)
})
test('account updates and resets cannot expose or erase another account’s notes', () => {
	let value = normalizeWorkspace(undefined)
	value = updateAccount(value, me, a => ({
		...a,
		notes: { [channel]: { text: 'private', followUp: 'plan', done: false } },
	}))
	assert.deepEqual(accountFor(value, other).notes, {})
	value = updateAccount(value, other, a => ({
		...a,
		notes: { [channel]: { text: 'other', followUp: '', done: false } },
	}))
	value = updateAccount(value, me, () => emptyAccount())
	assert.equal(accountFor(value, other).notes[channel].text, 'other')
	assert.throws(() => updateAccount(value, '__proto__', a => a))
})
test('normalizer bounds private content and rejects malformed persisted records', () => {
	const a = normalizeAccount({
		notes: { [channel]: { text: 'x'.repeat(9000) }, bad: { text: 'bad' } },
		bookmarks: [
			null,
			{ channelId: channel, messageId: message, seconds: Infinity },
		],
		rules: [{ id: 'x', trigger: 'anything' }],
		media: [null],
		wheel: ['notes', 'notes', 'unknown'],
		widgets: ['media', 'media', 'wat'],
		intensity: 2,
	})
	assert.equal(a.notes[channel].text.length, 6000)
	assert.equal(Object.keys(a.notes).length, 1)
	assert.equal(a.bookmarks[0].seconds, 0)
	assert.equal(a.rules.length, 0)
	assert.equal(a.media.length, 0)
	assert.deepEqual(a.wheel, ['notes'])
	assert.deepEqual(a.widgets, ['media'])
	assert.equal(a.intensity, 0.85)
})
test('cached message lenses keep links, attachments, question matches and reply edges', () => {
	const messages = messageRecords(
		[
			sample,
			{
				...sample,
				id: attachment,
				content: 'After 8',
				messageReference: { message_id: message },
				attachments: [],
			},
			{ ...sample, id: other, channel_id: guild },
		],
		channel,
	)
	assert.equal(messages.length, 2)
	assert.equal(filterMessages(messages, 'Questions').length, 1)
	assert.equal(
		filterMessages(messages, 'Links')[0].links[0],
		'https://example.com/playlist',
	)
	assert.equal(filterMessages(messages, 'Media').length, 1)
	assert.equal(filterMessages(messages, 'Reply map').length, 2)
	assert.equal(filterMessages(messages, 'Messages', 'after').length, 1)
})
test('media links accept signed Discord attachments and reject foreign or injected URLs', () => {
	assert.equal(mediaUri(sample.attachments[0].url), sample.attachments[0].url)
	for (const uri of [
		'javascript:alert(1)',
		'https://cdn.discordapp.com.evil.example/attachments/a',
		'https://cdn.discordapp.com@evil.example/attachments/a',
		'file:///secret',
		'https://cdn.discordapp.com/attachments/a<script>',
	])
		assert.equal(mediaUri(uri), '')
	assert.throws(() => playerDocument('https://evil.example/file', false))
	const doc = playerDocument(sample.attachments[0].url, true)
	assert.match(doc, /<audio/)
	assert.match(doc, /Content-Security-Policy/)
	assert.match(doc, /connect-src 'none'/)
	assert.ok(!doc.includes('autoplay'))
})
test('wheel maps cardinal directions and cancels the center', () => {
	assert.equal(wheelIndex(0, 0, 6), -1)
	assert.equal(wheelIndex(0, -100, 6), 0)
	assert.equal(wheelIndex(90, -50, 6), 1)
	assert.equal(wheelIndex(0, 100, 6), 3)
	assert.equal(wheelIndex(-90, -50, 6), 5)
	assert.equal(wheelIndex(NaN, 0, 6), -1)
})
test('layout reordering preserves widgets at the ends and supports removal', () => {
	assert.deepEqual(moveWidget(['friends', 'music', 'notes'], 0, 1), [
		'music',
		'friends',
		'notes',
	])
	assert.deepEqual(moveWidget(['friends'], 0, -1), ['friends'])
	assert.deepEqual(normalizeAccount({ widgets: [] }).widgets, [])
})
test('transcript parser validates timestamps and supports seekable lines', () => {
	assert.deepEqual(
		transcriptLines('0:18 Keep this\n1:32 Next\n0:99 Wrong\nno time'),
		[
			{ seconds: 18, text: 'Keep this' },
			{ seconds: 92, text: 'Next' },
		],
	)
})
test('first matching enabled rule wins without mutating the saved theme', async () => {
	const f = setup()
	try {
		await f.workspace.save(a => ({
			...a,
			rules: [
				{
					id: 'first',
					name: 'Server rule',
					trigger: 'guild',
					target: guild,
					mood: 'rose',
					tool: 'media',
					enabled: true,
				},
				{
					id: 'next',
					name: 'Next',
					trigger: 'channel',
					target: channel,
					mood: 'ice',
					tool: 'notes',
					enabled: true,
				},
			],
		}))
		assert.equal(f.workspace.rule()?.id, 'first')
		assert.equal(f.home.effectiveSettings().studio.mood, 'rose')
		assert.equal(runtime.getSettings().studio.mood, 'custom')
		f.select(other)
		assert.equal(f.workspace.rule(), undefined)
		assert.equal(f.home.effectiveSettings().studio.mood, 'custom')
		const rule = {
			id: 'voice',
			name: 'Call',
			trigger: 'voice' as const,
			target: '',
			mood: 'ice' as const,
			tool: 'notes' as const,
			enabled: true,
		}
		assert.equal(
			activeRule({ ...emptyAccount(), rules: [rule] }, { voiceId: channel })
				?.id,
			'voice',
		)
	} finally {
		f.close()
	}
})
test('workspace reads only available channels and never fetches history on read', () => {
	const f = setup()
	try {
		assert.equal(f.workspace.messages(channel).length, 1)
		assert.equal(f.calls.length, 0)
		f.allow(false)
		assert.deepEqual(f.workspace.messages(channel), [])
		assert.deepEqual(f.workspace.messages('999999999999999999'), [])
	} finally {
		f.close()
	}
})
test('account changes hide notes and clear in-memory reading anchors', async () => {
	const f = setup()
	try {
		await f.workspace.save(a => ({
			...a,
			notes: { [channel]: { text: 'private', followUp: '', done: false } },
		}))
		f.workspace.recordPosition(channel, { middleVisibleMessage: message })
		assert.equal(f.workspace.position(channel), message)
		f.account(other)
		assert.deepEqual(f.workspace.account().notes, {})
		assert.equal(f.workspace.position(channel), '')
	} finally {
		f.close()
	}
})
test('opening a bookmarked message navigates only on the explicit action', async () => {
	const f = setup()
	try {
		assert.equal(f.calls.length, 0)
		await f.workspace.openMessage(channel, message)
		assert.deepEqual(f.calls, [[channel, message]])
		assert.equal(f.workspace.position(channel), message)
		f.allow(false)
		await assert.rejects(f.workspace.openMessage(channel, message))
	} finally {
		f.close()
	}
})
test('reactive colors are stable and return to the saved accent when off', async () => {
	const f = setup()
	try {
		const original = runtime.getSettings().accentColor
		assert.equal(paletteFor('track'), paletteFor('track'))
		await f.workspace.save(a => ({ ...a, atmosphere: 'server' }))
		assert.notEqual(f.home.effectiveSettings().accentColor, undefined)
		assert.equal(runtime.getSettings().accentColor, original)
		await f.workspace.save(a => ({ ...a, atmosphere: 'off' }))
		assert.equal(f.home.effectiveSettings().accentColor, original)
	} finally {
		f.close()
	}
})
test('reading anchor uses visible rows, preserves native handler result, and stops on unload', () => {
	const rows = [
			{ message: { id: message } },
			{ message: { id: attachment } },
			{ type: 'divider' },
		],
		event = {
			rows,
			firstVisibleMessageRowIndex: 0,
			lastVisibleMessageRowIndex: 2,
		},
		calls: any[] = []
	assert.equal(visibleAnchor(event), attachment)
	assert.equal(visibleAnchor({ ...event, lastVisibleMessageRowIndex: 99 }), '')
	let native = 0
	const handler = {
		handleScrollPosition() {
			native++
			return 42
		},
	}
	const tracker = createReadingTracker((...args) => calls.push(args)),
		input = { channelId: channel, visibleMessagesWindowHandler: handler }
	const wrapped = tracker.wrap(input)
	assert.notEqual(wrapped, input)
	assert.equal(
		wrapped.visibleMessagesWindowHandler.handleScrollPosition(event),
		42,
	)
	assert.equal(native, 1)
	assert.deepEqual(calls, [[channel, attachment]])
	assert.equal(
		tracker.wrap(input).visibleMessagesWindowHandler,
		wrapped.visibleMessagesWindowHandler,
	)
	tracker.dispose()
	wrapped.visibleMessagesWindowHandler.handleScrollPosition(event)
	assert.equal(native, 2)
	assert.equal(calls.length, 1)
})
test('failed workspace persistence rejects and restores the prior account state', async () => {
	const f = setup()
	try {
		const writer = createSettingsWriter({
			cache: runtime.getSettings(),
			set: async () => {
				throw new Error('disk full')
			},
		})
		setSettingsWriter(writer)
		await assert.rejects(
			f.workspace.save(a => ({
				...a,
				notes: { [channel]: { text: 'unsaved', followUp: '', done: false } },
			})),
		)
		assert.deepEqual(f.workspace.account().notes, {})
		writer.stop()
	} finally {
		f.close()
	}
})
test('disposing workspace stops store notifications and rejects later writes', async () => {
	const f = setup(),
		listeners = new Set<() => void>()
	f.workspace.attach('messages', {
		addChangeListener: (fn: () => void) => listeners.add(fn),
		removeChangeListener: (fn: () => void) => listeners.delete(fn),
	})
	assert.equal(listeners.size, 1)
	f.close()
	assert.equal(listeners.size, 0)
	await assert.rejects(f.workspace.save(a => a))
	assert.deepEqual(f.workspace.messages(channel), [])
})

test('notebook and account limits reject new data instead of evicting existing notes', () => {
	const notes = Object.fromEntries(
		Array.from({ length: 100 }, (_, i) => [
			(BigInt(channel) + BigInt(i)).toString(),
			{ text: 'keep', followUp: '', done: false },
		]),
	)
	const settings = normalizeWorkspace({ accounts: { [me]: { notes } } })
	assert.throws(
		() =>
			updateAccount(settings, me, a => ({
				...a,
				notes: {
					...a.notes,
					[guild]: { text: 'new', followUp: '', done: false },
				},
			})),
		/100 notebooks/,
	)
	const full = normalizeWorkspace({
		accounts: Object.fromEntries(
			Array.from({ length: 8 }, (_, i) => [
				(BigInt(me) + BigInt(i)).toString(),
				emptyAccount(),
			]),
		),
	})
	assert.throws(
		() => updateAccount(full, other, a => a),
		/eight saved workspaces/,
	)
	assert.equal(Object.keys(full.accounts).length, 8)
})

test('session restore applies its exact saved scene and fails if the account changes during navigation', async () => {
	const f = setup()
	try {
		const session = normalizeAccount({
			sessions: [
				{
					id: 'saved',
					name: 'Saved scene',
					channelId: channel,
					messageId: message,
					mood: 'waves',
					accent: '#AABBCC',
					panel: '#121826',
					menu: '#101020',
					transparency: 0.7,
					darkness: 0.3,
					blur: 6,
					wallpaper: 'https://example.com/waves.png',
					tool: 'notes',
				},
			],
		}).sessions[0]
		await f.workspace.restore(session)
		assert.equal(runtime.getSettings().accentColor, '#AABBCC')
		assert.equal(
			runtime.getSettings().studio.wallpaper,
			'https://example.com/waves.png',
		)
		f.workspace.attach('channel', {
			transitionToMessage: async () => f.account(other),
		})
		await assert.rejects(
			f.workspace.restore({ ...session, accent: '#FFEEDD' }),
			/account changed/,
		)
		assert.equal(runtime.getSettings().accentColor, '#AABBCC')
	} finally {
		f.close()
	}
})
