import assert from 'node:assert/strict'
import test from 'node:test'
import { normalize } from './core'
import { readableReplies } from './replies'

const active = normalize({ enabled: true })
const foreground = -526081

test('final reply and thread previews get readable text without mutating message/role/markup data', () => {
	const message = {
		id: '123',
		textColor: -16777216,
		usernameColor: 0x00ff00,
		roleColor: 12345,
		linkColor: 3456,
		content: [{ type: 'link', text: 'hello' }],
		attachments: [],
		authorId: '987',
	}
	const reference = { state: 0, message }
	const row = {
		id: '456',
		textColor: 5678,
		referencedMessage: reference,
		threadEmbed: { referencedMessage: reference, title: 'Thread' },
	}
	const before = structuredClone(row)
	const next = readableReplies(active, row, () => foreground) as any
	assert.equal(next.referencedMessage.message.textColor, foreground)
	assert.equal(next.threadEmbed.referencedMessage.message.textColor, foreground)
	assert.equal(
		next.referencedMessage.message.usernameColor,
		message.usernameColor,
	)
	assert.equal(next.referencedMessage.message.roleColor, message.roleColor)
	assert.equal(next.referencedMessage.message.content, message.content)
	assert.equal(next.referencedMessage.message.attachments, message.attachments)
	assert.equal(next.textColor, row.textColor)
	assert.deepEqual(row, before)
	assert.equal(
		readableReplies(active, next, () => foreground),
		next,
	)
})

test('reply processing skips disabled/unknown/system rows and failed native color conversions', () => {
	const row = {
		id: '1',
		referencedMessage: { state: 0, message: { id: '2', textColor: 0 } },
	}
	for (const settings of [
		normalize({ enabled: false }),
		normalize({ enabled: true, chats: false }),
	])
		assert.equal(
			readableReplies(settings, row, () => foreground),
			row,
		)
	for (const result of [
		null,
		[],
		{},
		{ id: '1' },
		{
			id: '1',
			referencedMessage: {
				state: 1,
				content: 'blocked',
				message: { id: '2', textColor: 0 },
			},
		},
	])
		assert.equal(
			readableReplies(active, result, () => foreground),
			result,
		)
	for (const invalid of [null, 'white', NaN, Infinity])
		assert.equal(
			readableReplies(active, row, () => invalid),
			row,
		)
	assert.equal(
		readableReplies(active, row, () => {
			throw new Error('unsupported')
		}),
		row,
	)
})
