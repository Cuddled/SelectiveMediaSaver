import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeThemeSync } from './nativeTheme'

function harness() {
	let enabled = true
	let theme: unknown = 'light'
	const calls: any[][] = []
	const errors: unknown[] = []
	const original = (...args: any[]) => {
		calls.push(args)
		return 'native-result'
	}
	const sync = createNativeThemeSync({
		isEnabled: () => enabled,
		getTheme: () => theme,
		onError: error => errors.push(error),
	})
	return {
		sync,
		calls,
		errors,
		original,
		enable: (value: boolean) => {
			enabled = value
		},
		theme: (value: unknown) => {
			theme = value
		},
	}
}

test('native theme aligns on attach, avoids redundant writes and restores the current user choice', () => {
	const h = harness()
	h.sync.attach(h.original)
	assert.deepEqual(h.calls, [['dark']])
	h.sync.refresh()
	assert.equal(h.calls.length, 1)
	const args = ['midnight', { metadata: true }]
	assert.equal(h.sync.request(args, h.original), 'native-result')
	assert.deepEqual(h.calls.at(-1), ['dark', args[1]])
	assert.equal(args[0], 'midnight')
	h.enable(false)
	h.sync.refresh()
	assert.deepEqual(h.calls.at(-1), ['midnight'])
	h.enable(true)
	h.sync.refresh()
	assert.deepEqual(h.calls.at(-1), ['dark'])
	h.sync.stop()
	assert.deepEqual(h.calls.at(-1), ['midnight'])
	const count = h.calls.length
	h.sync.stop()
	h.sync.refresh()
	assert.equal(h.calls.length, count)
})

test('native theme defers until a restoration value exists, including late module/store order', () => {
	const h = harness()
	h.theme(undefined)
	h.sync.attach(h.original)
	assert.equal(h.calls.length, 0)
	h.theme('light')
	h.sync.refresh()
	assert.deepEqual(h.calls, [['dark']])
	h.sync.stop()
	assert.deepEqual(h.calls.at(-1), ['light'])
	const late = harness()
	late.theme(undefined)
	late.sync.refresh()
	late.sync.attach(late.original)
	late.sync.request(['midnight'], late.original)
	assert.deepEqual(late.calls, [['dark']])
	late.sync.stop()
	assert.deepEqual(late.calls.at(-1), ['midnight'])
})

test('unknown requests pass through unchanged and disabled requests follow Discord', () => {
	const h = harness()
	h.sync.attach(h.original)
	for (const value of [undefined, null, 42, {}, '']) {
		const args = [value, 'other-argument']
		h.sync.request(args, h.original)
		assert.deepEqual(h.calls.at(-1), args)
	}
	h.enable(false)
	h.sync.request(['light'], h.original)
	assert.deepEqual(h.calls.at(-1), ['light'])
	h.sync.stop()
})

test('native bridge refresh failures are contained and retryable, including rejected promises', async () => {
	const h = harness()
	const error = new Error('bridge unavailable')
	h.sync.attach(() => {
		throw error
	})
	assert.deepEqual(h.errors, [error])
	h.sync.attach(() => Promise.reject(error))
	await Promise.resolve()
	assert.deepEqual(h.errors, [error, error])
	h.sync.attach(h.original)
	assert.deepEqual(h.calls, [['dark']])
	h.sync.stop()
	assert.deepEqual(h.calls.at(-1), ['light'])
})
