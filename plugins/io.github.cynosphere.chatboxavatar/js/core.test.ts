import assert from 'node:assert/strict'
import test from 'node:test'
import { prependChatboxAvatar } from './core'

test('prepends the avatar to the current chat action row', () => {
	const actions = [{ key: 'camera' }, { key: 'apps' }]
	const tree = {
		props: {
			children: {
				props: { children: actions },
			},
		},
	}
	const avatar = { key: 'avatar' }

	assert.equal(prependChatboxAvatar(tree, avatar), tree)
	assert.deepEqual(actions, [avatar, { key: 'camera' }, { key: 'apps' }])
})
