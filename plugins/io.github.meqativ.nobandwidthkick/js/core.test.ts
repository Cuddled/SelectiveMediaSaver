import assert from 'node:assert/strict'
import test from 'node:test'
import { suppressDisconnectCallback } from './core'

test('only suppresses a callback literally named disconnect', () => {
	function disconnect() {
		return 'disconnect'
	}
	function reconnect() {
		return 'reconnect'
	}

	const blocked = suppressDisconnectCallback([180_000, disconnect, false])
	assert.notEqual(blocked[1], disconnect)
	assert.equal(blocked[1](), undefined)

	const untouched = suppressDisconnectCallback([180_000, reconnect, false])
	assert.equal(untouched[1], reconnect)
})
