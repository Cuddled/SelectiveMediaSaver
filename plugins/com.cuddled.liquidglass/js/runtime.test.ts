import assert from 'node:assert/strict'
import test from 'node:test'
import { deferLateRuntime } from './runtime'

test('late activation requests one reload and defers structural patches', () => {
	let reloads = 0
	const deferred = deferLateRuntime({
		startedLate: true,
		requireReload() {
			reloads += 1
		},
	})

	assert.equal(deferred, true)
	assert.equal(reloads, 1)
})

test('normal boot installs without requesting a reload', () => {
	let reloads = 0
	const deferred = deferLateRuntime({
		startedLate: false,
		requireReload() {
			reloads += 1
		},
	})

	assert.equal(deferred, false)
	assert.equal(reloads, 0)
})
