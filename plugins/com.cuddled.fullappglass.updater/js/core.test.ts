import assert from 'node:assert/strict'
import test from 'node:test'
import {
	GLASS_ID,
	REPOSITORY,
	repairGlass,
	TARGET_SHA256,
	TARGET_SIZE,
	TARGET_URL,
	TARGET_VERSION,
} from './core'
import type { NativeCall } from './core'

function fixture() {
	const action = {
		id: GLASS_ID,
		version: TARGET_VERSION,
		repo: REPOSITORY,
		channel: 'latest',
		url: TARGET_URL,
		sha256: TARGET_SHA256,
		size: TARGET_SIZE,
		replaces: '1.0.0-beta14',
	}
	const plan = { actions: [action], warnings: [] as string[] }
	const calls: { name: string; args: unknown[] }[] = []
	const call: NativeCall = async (name, args) => {
		calls.push({ name, args })
		switch (name) {
			case 'revenge.plugins.repos.list':
				return [{ url: REPOSITORY, enabled: true }]
			case 'revenge.plugins.repos.refresh':
				return {}
			case 'revenge.plugins.planInstall':
				return plan
			case 'revenge.plugins.install':
				return { pending: [GLASS_ID], installed: [], skipped: [] }
			default:
				throw new Error(`Unexpected native call: ${name}`)
		}
	}
	return { action, plan, calls, call }
}

test('beta14 upgrade uses only native repository APIs and pins the verified beta15 artifact', async () => {
	const f = fixture()
	const progress: string[] = []
	await repairGlass(f.call, message => progress.push(message))
	assert.deepEqual(
		f.calls.map(call => call.name),
		[
			'revenge.plugins.repos.list',
			'revenge.plugins.repos.refresh',
			'revenge.plugins.planInstall',
			'revenge.plugins.install',
		],
	)
	assert.deepEqual(f.calls[2].args, [
		GLASS_ID,
		TARGET_VERSION,
		'latest',
		[REPOSITORY],
	])
	assert.deepEqual(f.calls[3].args, [f.plan])
	assert.match(progress.at(-1)!, /Update staged/)
})

for (const [field, value] of Object.entries({
	id: 'another.plugin',
	version: '1.0.0-beta16',
	repo: 'https://example.com',
	channel: 'beta',
	url: 'https://example.com/glass.zip',
	sha256: '0'.repeat(64),
	size: 1,
	replaces: '1.0.0-beta16',
})) {
	test(`refuses a changed ${field} without installing`, async () => {
		const f = fixture()
		Object.assign(f.action, { [field]: value })
		await assert.rejects(
			repairGlass(f.call, () => {}),
			/did not match/,
		)
		assert.ok(!f.calls.some(call => call.name === 'revenge.plugins.install'))
	})
}

test('refuses fresh installs, unrelated actions, and dependency warnings', async () => {
	for (const change of [
		(f: ReturnType<typeof fixture>) => {
			f.action.replaces = ''
		},
		(f: ReturnType<typeof fixture>) => {
			f.plan.actions.push({ ...f.action, id: 'another.plugin' })
		},
		(f: ReturnType<typeof fixture>) => {
			f.plan.warnings.push('dependency conflict')
		},
	]) {
		const f = fixture()
		change(f)
		await assert.rejects(
			repairGlass(f.call, () => {}),
			/did not match/,
		)
		assert.equal(f.calls.length, 3)
	}
})

test('an already-current copy does not claim to have linked its source', async () => {
	const f = fixture()
	f.plan.actions = []
	await assert.rejects(
		repairGlass(f.call, () => {}),
		/already at beta15/,
	)
	assert.equal(f.calls.length, 3)
})

test('missing repository stops before refresh or install', async () => {
	const calls: string[] = []
	await assert.rejects(
		repairGlass(
			async name => {
				calls.push(name)
				return []
			},
			() => {},
		),
		/Add and enable/,
	)
	assert.deepEqual(calls, ['revenge.plugins.repos.list'])
})

test('leaving the page during preparation cancels before the install', async () => {
	const f = fixture()
	await assert.rejects(
		repairGlass(
			f.call,
			() => {},
			() => false,
		),
		/canceled/,
	)
	assert.equal(f.calls.length, 3)
})

test('native failures and unconfirmed results never display success', async () => {
	for (const result of [
		new Error('Download failed'),
		{ pending: [], installed: [], skipped: [] },
	]) {
		const f = fixture()
		const progress: string[] = []
		await assert.rejects(
			repairGlass(
				async (name, args) => {
					if (name !== 'revenge.plugins.install') return f.call(name, args)
					if (result instanceof Error) throw result
					return result
				},
				message => progress.push(message),
			),
		)
		assert.ok(progress.every(message => !message.startsWith('Update staged')))
	}
})
