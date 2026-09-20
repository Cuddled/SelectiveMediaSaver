import assert from 'node:assert/strict'
import test from 'node:test'
import {
	createController,
	DEFAULT_SETTINGS,
	defaultMode,
	mediaKind,
	normalizeSettings,
	OriginalMediaError,
} from './core'
import type { Any, Dependencies, Mode, Prompt } from './core'

const deferred = <T>() => {
	let resolve!: (value: T) => void
	const promise = new Promise<T>(done => {
		resolve = done
	})
	return { promise, resolve }
}
function upload(kind = 'image', extra: Any = {}) {
	return {
		item: {
			platform: 0,
			target: 0,
			originalUri: 'content://photos/123',
			uri: 'content://photos/123',
			filename: 'photo.jpeg',
			mimeType: `${kind}/${kind === 'image' ? 'jpeg' : 'mp4'}`,
			width: 1920,
			height: 1080,
		},
		channelId: 'channel',
		filename: 'renamed.jpeg',
		spoiler: true,
		description: 'Alt text',
		currentSize: 0,
		reactNativeFilePrepped: false,
		...extra,
	} as Any
}
function fixture(overrides: Partial<Dependencies> = {}) {
	let settings = { ...DEFAULT_SETTINGS },
		account = 'one',
		limit = 500
	const native: Any[] = [],
		releases: string[] = [],
		cancels: string[] = [],
		prompts: Prompt[] = []
	let choice: 'compress' | 'cancel' = 'cancel',
		fallbackCalls = 0
	const controller = createController({
		settings: () => settings,
		account: () => account,
		limit: () => limit,
		prepare: async (...args) => {
			native.push(args)
			return { ok: true, uri: 'file:///cache/copied.original', size: 400 }
		},
		release: uri => {
			releases.push(uri)
		},
		cancel: id => {
			cancels.push(id)
		},
		ask: async prompt => {
			prompts.push(prompt)
			return choice
		},
		changed() {},
		...overrides,
	})
	return {
		controller,
		native,
		releases,
		cancels,
		prompts,
		fallback: () => {
			fallbackCalls++
			return Promise.resolve('native-compression')
		},
		fallbackCalls: () => fallbackCalls,
		settings: (value: Partial<typeof settings>) => {
			settings = { ...settings, ...value }
			controller.sync()
		},
		account: (value: string) => {
			account = value
			controller.sync()
		},
		limit: (value: number) => {
			limit = value
		},
		choice: (value: typeof choice) => {
			choice = value
		},
	}
}

test('new installs preserve both media kinds; malformed saved values cannot enable unintended modes', () => {
	assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS)
	assert.deepEqual(
		normalizeSettings({
			enabled: false,
			originalImages: 'no',
			originalVideos: false,
			extra: 10,
		}),
		{ enabled: false, originalImages: true, originalVideos: false },
	)
	assert.equal(defaultMode(DEFAULT_SETTINGS, upload()), 'original')
	assert.equal(defaultMode(DEFAULT_SETTINGS, upload('video')), 'original')
})
test('original transport preserves filename, dimensions, spoiler and alt text, with actual byte size', async () => {
	const f = fixture(),
		item = upload(),
		before = { ...item.item }
	assert.equal(await f.controller.prepare(item, f.fallback), item)
	assert.equal(f.fallbackCalls(), 0)
	assert.equal(f.native[0][1], before.originalUri)
	assert.equal(f.native[0][2], 500)
	assert.deepEqual(item.item, {
		...before,
		uri: 'file:///cache/copied.original',
		filename: 'renamed.jpeg',
	})
	assert.equal(item.spoiler, true)
	assert.equal(item.description, 'Alt text')
	assert.equal(item.currentSize, 400)
	assert.equal(item.preCompressionSize, 400)
	assert.equal(item.reactNativeFilePrepped, true)
})
test('non-message targets, web files, voice notes and unknown shapes use native processing', async () => {
	const f = fixture()
	for (const item of [
		upload('audio'),
		upload('application'),
		upload('image', {
			item: { platform: 1, target: 0, mimeType: 'image/jpeg' },
		}),
		upload('image', {
			item: { platform: 0, target: 1, mimeType: 'image/jpeg' },
		}),
		{},
	]) {
		assert.equal(mediaKind(item), undefined)
		assert.equal(
			await f.controller.prepare(item, f.fallback),
			'native-compression',
		)
	}
	assert.equal(f.native.length, 0)
})
test('an omitted native target uses the same message-attachment default as Discord', async () => {
	const f = fixture(),
		item = upload()
	item.item.target = undefined
	await f.controller.prepare(item, f.fallback)
	assert.equal(f.native.length, 1)
})
test('independent image/video defaults and explicit per-file overrides do not leak between files', async () => {
	const f = fixture()
	f.settings({ originalVideos: false })
	const a = upload(),
		b = upload('video'),
		c = upload('video')
	f.controller.choose(a, 'discord')
	f.controller.choose(c, 'original')
	await Promise.all(
		[a, b, c].map(item => f.controller.prepare(item, f.fallback)),
	)
	assert.equal(f.fallbackCalls(), 2)
	assert.equal(f.native.length, 1)
	assert.equal(c.reactNativeFilePrepped, true)
})
test('paused plugin uses native processing even with original per-file override', async () => {
	const f = fixture(),
		item = upload()
	f.controller.choose(item, 'original')
	f.settings({ enabled: false })
	await f.controller.prepare(item, f.fallback)
	assert.equal(f.native.length, 0)
	assert.equal(f.fallbackCalls(), 1)
})
test('oversized originals are never silently compressed or mutated on Cancel', async () => {
	const f = fixture({
			prepare: async () => ({ ok: false, code: 'TOO_LARGE', size: 501 }),
		}),
		item = upload(),
		before = structuredClone(item)
	await assert.rejects(
		f.controller.prepare(item, f.fallback),
		OriginalMediaError,
	)
	assert.equal(f.prompts[0].reason, 'oversize')
	assert.equal(f.prompts[0].limit, 500)
	assert.equal(f.fallbackCalls(), 0)
	assert.deepEqual(item, before)
})
test('explicit compression approval runs the original preparation exactly once', async () => {
	const f = fixture({
			prepare: async () => ({ ok: false, code: 'TOO_LARGE', size: 501 }),
		}),
		item = upload()
	f.choice('compress')
	assert.equal(
		await f.controller.prepare(item, f.fallback),
		'native-compression',
	)
	assert.equal(f.fallbackCalls(), 1)
	assert.equal(f.controller.mode(item), 'discord')
})
test('prepared result at the exact account limit succeeds; a lower live limit requires consent', async () => {
	const f = fixture(),
		item = upload()
	f.limit(400)
	await f.controller.prepare(item, f.fallback)
	assert.equal(f.prompts.length, 0)
	const pending = deferred<Any>(),
		g = fixture({ prepare: () => pending.promise }),
		other = upload()
	const task = g.controller.prepare(other, g.fallback)
	g.limit(399)
	pending.resolve({ ok: true, uri: 'file:///cache/copied.original', size: 400 })
	await assert.rejects(task, OriginalMediaError)
	assert.equal(g.prompts[0].limit, 399)
	assert.deepEqual(g.releases, ['file:///cache/copied.original'])
})
test('unknown limits, unreadable sources, broken bridges and invalid native results require a choice', async () => {
	for (const dependencies of [
		{ limit: () => undefined },
		{ limit: () => Number.POSITIVE_INFINITY },
		{
			prepare: async () => {
				throw new Error('bridge missing')
			},
		},
		{ prepare: async () => ({ ok: false, code: 'NOT_READY' }) },
		{ prepare: async () => ({ ok: true, uri: 'file:///cache/a', size: 0 }) },
		{
			prepare: async () => ({
				ok: true,
				uri: 'https://example.com/file',
				size: 400,
			}),
		},
	]) {
		const f = fixture(dependencies)
		await assert.rejects(
			f.controller.prepare(upload(), f.fallback),
			OriginalMediaError,
		)
		assert.equal(f.prompts[0].reason, 'unavailable')
		assert.equal(f.fallbackCalls(), 0)
	}
})
test('duplicate preparation calls share one copy; choices lock while work is pending', async () => {
	const wait = deferred<Any>(),
		f = fixture({ prepare: () => wait.promise }),
		item = upload()
	const first = f.controller.prepare(item, f.fallback)
	assert.equal(f.controller.prepare(item, f.fallback), first)
	assert.equal(f.controller.choose(item, 'discord'), false)
	wait.resolve({ ok: true, uri: 'file:///cache/a', size: 10 })
	await first
	assert.equal(f.controller.editable(item), false)
})
for (const reason of ['account', 'pause', 'stop', 'cancel'] as const)
	test(`${reason} while copying cancels work and discards a late native result`, async () => {
		const pending = deferred<Any>(),
			f = fixture({ prepare: () => pending.promise }),
			item = upload()
		const task = f.controller.prepare(item, f.fallback)
		if (reason === 'account') f.account('two')
		else if (reason === 'pause') f.settings({ enabled: false })
		else if (reason === 'stop') f.controller.stop()
		else f.controller.cancel(item)
		pending.resolve({
			ok: true,
			uri: 'file:///cache/copied.original',
			size: 400,
		})
		await assert.rejects(task, OriginalMediaError)
		assert.equal(f.cancels.length, 1)
		assert.equal(f.fallbackCalls(), 0)
		assert.equal(item.reactNativeFilePrepped, false)
		assert.equal(f.releases.length, 1)
	})
test('multiple oversized uploads present one dialog at a time', async () => {
	const answers = [
		deferred<'compress' | 'cancel'>(),
		deferred<'compress' | 'cancel'>(),
	]
	let shown = 0
	const f = fixture({
		prepare: async () => ({ ok: false, code: 'TOO_LARGE' }),
		ask: () => answers[shown++].promise,
	})
	const a = f.controller.prepare(upload(), f.fallback)
	const b = f.controller.prepare(upload(), f.fallback)
	const checked = Promise.allSettled([a, b])
	await new Promise(resolve => setImmediate(resolve))
	assert.equal(shown, 1)
	answers[0].resolve('cancel')
	await new Promise(resolve => setImmediate(resolve))
	assert.equal(shown, 2)
	answers[1].resolve('compress')
	const results = await checked
	assert.equal(results[0].status, 'rejected')
	assert.equal(results[1].status, 'fulfilled')
	assert.equal(f.fallbackCalls(), 1)
})
test('account change before compression consent never calls native compression', async () => {
	const answer = deferred<'compress' | 'cancel'>()
	const f = fixture({
		prepare: async () => ({ ok: false, code: 'TOO_LARGE' }),
		ask: () => answer.promise,
	})
	const task = f.controller.prepare(upload(), f.fallback)
	await new Promise(resolve => setImmediate(resolve))
	f.account('other')
	answer.resolve('compress')
	await assert.rejects(task, OriginalMediaError)
	assert.equal(f.fallbackCalls(), 0)
})
test('unloading retains already prepared files for active native uploads; removing a draft releases only its copy', async () => {
	const f = fixture(),
		item = upload()
	await f.controller.prepare(item, f.fallback)
	f.controller.release(item)
	f.controller.release(item)
	assert.equal(f.releases.length, 1)
	await f.controller.prepare(upload(), f.fallback)
	f.controller.stop()
	assert.equal(f.releases.length, 1)
})
test('an explicit native compression failure is propagated, never retried or sent twice', async () => {
	const f = fixture(),
		item = upload()
	f.controller.choose(item, 'discord' as Mode)
	const error = new Error('native encoder failed')
	await assert.rejects(
		f.controller.prepare(item, () => {
			throw error
		}),
		error,
	)
	assert.equal(f.native.length, 0)
})
