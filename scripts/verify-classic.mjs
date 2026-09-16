import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'

const root = path.resolve(import.meta.dirname, '..')
const outputDirectory = path.join(root, 'build', 'classic')
const manifest = JSON.parse(
	await readFile(path.join(outputDirectory, 'manifest.json'), 'utf8'),
)
const bundle = await readFile(path.join(outputDirectory, manifest.main), 'utf8')

assert.equal(manifest.main, 'index.js')
assert.match(manifest.hash, /^[a-f0-9]{64}$/)
assert.equal(createHash('sha256').update(bundle).digest('hex'), manifest.hash)
assert.ok(Array.isArray(manifest.authors) && manifest.authors.length > 0)

const downloads = []
let downloadImplementation = async () => true
const subscriptions = new Map()
const storage = {}
const dispatcher = {
	subscribe(type, handler) {
		subscriptions.set(type, handler)
	},
	unsubscribe(type, handler) {
		if (subscriptions.get(type) === handler) subscriptions.delete(type)
	},
}
const mockVendetta = {
	plugin: { storage },
	logger: { error() {} },
	metro: {
		common: {
			FluxDispatcher: dispatcher,
			React: {
				createElement(type, props, ...children) {
					return { type, props: props ?? {}, children }
				},
				useReducer(_reducer, initial) {
					return [initial, () => undefined]
				},
				useState(initial) {
					return [initial, () => undefined]
				},
			},
			ReactNative: {
				ScrollView: 'ScrollView',
				View: 'View',
				Text: 'Text',
				Switch: 'Switch',
				TouchableOpacity: 'TouchableOpacity',
				TextInput: 'TextInput',
			},
		},
		findByProps(...props) {
			if (props.includes('downloadMediaAsset')) {
				return {
					async downloadMediaAsset(url) {
						downloads.push(url)
						return await downloadImplementation(url)
					},
				}
			}
			if (props.includes('getCurrentUser'))
				return { getCurrentUser: () => ({ id: '999999999999999999' }) }
			return undefined
		},
		findByStoreName(name) {
			return name === 'ChannelStore'
				? { getChannel: () => ({ guild_id: '456789012345678901' }) }
				: undefined
		},
	},
	ui: { toasts: { showToast() {} } },
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const deferred = () => {
	let resolve
	let reject
	const promise = new Promise((onResolve, onReject) => {
		resolve = onResolve
		reject = onReject
	})
	return { promise, resolve, reject }
}
const messageEvent = ({
	id,
	url,
	authorId = '123456789012345678',
	guildId = '456789012345678901',
	bot = false,
	size = 100,
}) => ({
	type: 'MESSAGE_CREATE',
	message: {
		id,
		channel_id: '345678901234567890',
		...(guildId ? { guild_id: guildId } : {}),
		author: { id: authorId, username: 'tester', bot },
		attachments: [
			{ url, filename: 'photo.png', content_type: 'image/png', size },
		],
	},
})

const raw = vm.runInNewContext(`vendetta=>{return ${bundle}}`)(mockVendetta)
const plugin = typeof raw === 'function' ? raw() : raw
assert.equal(typeof plugin.onLoad, 'function')
assert.equal(typeof plugin.onUnload, 'function')
assert.equal(typeof plugin.settings, 'function')
assert.ok(plugin.__testing)
assert.equal(plugin.settings().type, 'ScrollView')

assert.deepEqual(
	Array.from(
		plugin.__testing.normalizeIds(
			'123456789012345678, nope 123456789012345678',
		),
	),
	['123456789012345678'],
)
assert.equal(
	plugin.__testing.classify('https://cdn.discordapp.com/a/file.png'),
	'image',
)
assert.equal(
	plugin.__testing.classify('https://cdn.discordapp.com/a/file.mp4'),
	'video',
)
assert.equal(plugin.__testing.classify('https://example.com/page'), undefined)
assert.equal(
	plugin.__testing.isSafeUrl('https://cdn.discordapp.com/a.png'),
	true,
)
assert.equal(
	plugin.__testing.isSafeUrl('https://media.discordapp.net/a.png'),
	true,
)
assert.equal(plugin.__testing.isSafeUrl('https://example.com/a.png'), false)
assert.equal(
	plugin.__testing.isSafeUrl('http://cdn.discordapp.com/a.png'),
	false,
)

plugin.onLoad()
assert.ok(subscriptions.has('MESSAGE_CREATE'))
storage.allowedUserIds = ['123456789012345678']
const firstEvent = messageEvent({
	id: '234567890123456789',
	url: 'https://cdn.discordapp.com/attachments/1/2/photo.png?token=test',
})
subscriptions.get('MESSAGE_CREATE')(firstEvent)
await tick()
assert.equal(downloads.length, 1)
assert.equal(storage.captureState.downloaded, 1)

// The persistent URL history prevents signed-URL duplicates.
subscriptions.get('MESSAGE_CREATE')({
	...firstEvent,
	message: {
		...firstEvent.message,
		id: '234567890123456790',
		attachments: [
			{
				...firstEvent.message.attachments[0],
				url: 'https://cdn.discordapp.com/attachments/1/2/photo.png?token=changed',
			},
		],
	},
})
await tick()
assert.equal(downloads.length, 1)

// A non-allowlisted user is blocked.
subscriptions.get('MESSAGE_CREATE')(
	messageEvent({
		id: '234567890123456791',
		url: 'https://cdn.discordapp.com/attachments/1/2/blocked.png',
		authorId: '777777777777777777',
	}),
)
await tick()
assert.equal(downloads.length, 1)

// Guild matching falls back to ChannelStore when the message omits guild_id.
storage.allowedUserIds = []
storage.allowedGuildIds = ['456789012345678901']
subscriptions.get('MESSAGE_CREATE')(
	messageEvent({
		id: '234567890123456792',
		url: 'https://cdn.discordapp.com/attachments/1/2/guild.png',
		guildId: '',
	}),
)
await tick()
assert.equal(downloads.length, 2)

// Known oversized attachments are rejected before reaching Android.
storage.maxDownloadMiB = 1
subscriptions.get('MESSAGE_CREATE')(
	messageEvent({
		id: '234567890123456793',
		url: 'https://cdn.discordapp.com/attachments/1/2/oversized.png',
		guildId: '',
		size: 2 * 1024 * 1024,
	}),
)
await tick()
assert.equal(downloads.length, 2)
storage.maxDownloadMiB = 100

// Turning the master switch off after enqueue cleans the pending marker so retry works.
const retryEvent = messageEvent({
	id: '234567890123456794',
	url: 'https://cdn.discordapp.com/attachments/1/2/retry.png',
	guildId: '',
})
subscriptions.get('MESSAGE_CREATE')(retryEvent)
storage.enabled = false
await tick()
assert.equal(downloads.length, 2)
storage.enabled = true
subscriptions.get('MESSAGE_CREATE')(retryEvent)
await tick()
assert.equal(downloads.length, 3)

// The in-memory queue accepts at most 64 pending items and accounts for dropped work.
const beforeBulk = downloads.length
for (let index = 0; index < 70; index += 1) {
	subscriptions.get('MESSAGE_CREATE')(
		messageEvent({
			id: String(500000000000000000n + BigInt(index)),
			url: `https://cdn.discordapp.com/attachments/1/2/bulk-${index}.png`,
			guildId: '',
		}),
	)
}
await tick()
assert.equal(downloads.length, beforeBulk + 64)
assert.equal(storage.captureState.dropped, 6)

// Unload/reload starts a fresh queue and stale native completions cannot clear new work.
const stale = deferred()
const current = deferred()
const responses = [stale.promise, current.promise]
downloadImplementation = async () => await responses.shift()
const raceEvent = messageEvent({
	id: '234567890123456795',
	url: 'https://cdn.discordapp.com/attachments/1/2/race.png',
	guildId: '',
})
subscriptions.get('MESSAGE_CREATE')(raceEvent)
await tick()
plugin.onUnload()
plugin.onLoad()
subscriptions.get('MESSAGE_CREATE')(raceEvent)
await tick()
const raceCalls = downloads.length
stale.resolve(true)
await tick()
subscriptions.get('MESSAGE_CREATE')(raceEvent)
await Promise.resolve()
assert.equal(downloads.length, raceCalls)
current.resolve(true)
await tick()
downloadImplementation = async () => true

plugin.onUnload()
assert.equal(subscriptions.size, 0)
console.log('Classic Revenge loader and runtime checks passed')
