import assert from 'node:assert/strict'
import test from 'node:test'
import { normalize, runtime } from './core'
import { createSettingsWriter } from './settingsWriter'
import { createStudioData } from './studioData'

const id = '123456789012345678'
const guild = '223456789012345678'
function flux(extra: Record<string, any>) {
	const listeners = new Set<() => void>()
	return {
		...extra,
		addChangeListener: (fn: () => void) => listeners.add(fn),
		removeChangeListener: (fn: () => void) => listeners.delete(fn),
		emit: () => {
			for (const fn of listeners) fn()
		},
		listeners,
	}
}
test('real cached data produces home cards, safe CDN images, no fabricated friends or activity', () => {
	const data = createStudioData()
	assert.deepEqual(data.guilds(), [])
	assert.deepEqual(data.friends(), [])
	assert.equal(data.music(), undefined)
	data.attach('guilds', {
		getGuilds() {
			return {
				[guild]: { id: guild, name: 'Our server', icon: 'a'.repeat(32) },
				malformed: {},
			}
		},
	})
	data.attach('users', {
		getCurrentUser: () => ({ id, username: 'test' }),
		getUser: () => ({ id, globalName: 'A friend', avatar: '../../bad' }),
	})
	data.attach('relationships', { getFriendIDs: () => [id] })
	data.attach('channels', {
		getSortedPrivateChannels: () => [
			{ id, recipients: [id] },
			{ id: guild, guild_id: guild },
		],
	})
	assert.match(
		data.guilds()[0].image!,
		/^https:\/\/cdn.discordapp.com\/icons\//,
	)
	assert.equal(data.friends()[0].image, undefined)
	assert.equal(data.chats()[0].name, 'A friend')
	assert.equal(data.chats().length, 1)
	data.attach('selfPresence', {
		getActivities: () => [
			{
				type: 2,
				name: 'Spotify',
				details: 'Track',
				state: 'Artist',
				sync_id: 'a'.repeat(22),
				assets: { large_image: `spotify:${'a'.repeat(40)}` },
			},
		],
	})
	assert.equal(data.music()?.title, 'Track')
	assert.match(data.music()!.art!, /^https:\/\/i.scdn.co\/image\//)
	data.dispose()
	assert.deepEqual(data.friends(), [])
})
test('presence changes update Home without repainting every text and icon; all listeners detach', () => {
	runtime.update({ enabled: true })
	const data = createStudioData()
	data.start()
	const presence = flux({ getActivities: () => [] })
	data.attach('presence', presence)
	let home = 0
	let appearance = 0
	data.subscribe(() => home++)
	data.subscribeAppearance(() => appearance++)
	const before = data.getAppearanceSnapshot()
	presence.emit()
	assert.equal(home, 1)
	assert.equal(appearance, 0)
	assert.equal(data.getAppearanceSnapshot(), before)
	runtime.update({ ...runtime.getSettings(), accentColor: '#112233' })
	assert.equal(appearance, 1)
	data.dispose()
	assert.equal(presence.listeners.size, 0)
	presence.emit()
	assert.equal(appearance, 1)
})
test('an explicit DM cannot inherit a different selected server wallpaper', () => {
	runtime.update({
		studio: {
			wallpaper: 'https://example.com/app',
			scenes: {
				[`guild:${guild}`]: {
					wallpaper: 'https://example.com/guild',
					accent: '#123456',
				},
				[`channel:${id}`]: { wallpaper: 'https://example.com/dm', accent: '' },
			},
		},
	})
	const data = createStudioData()
	data.attach('channels', { getChannel: () => ({ id, recipients: [id] }) })
	data.attach('selectedChannel', { getChannelId: () => id })
	data.attach('selectedGuild', { getGuildId: () => guild })
	assert.equal(data.scene(id).wallpaper, 'https://example.com/dm')
	assert.equal(data.scene().wallpaper, 'https://example.com/guild')
	assert.equal(data.scene(id).accent, runtime.getSettings().accentColor)
	data.dispose()
})
test('navigation runs only on explicit calls and never joins a call; missing paths reject', async () => {
	const data = createStudioData()
	const calls: unknown[] = []
	data.attach('openDM', {
		openPrivateChannel(options: unknown) {
			calls.push(options)
		},
	})
	assert.equal(calls.length, 0)
	await data.open('friend', id)
	assert.deepEqual(calls, [
		{ recipientIds: [id], joinCall: false, navigateToChannel: true },
	])
	await assert.rejects(data.open('guild', guild), /unavailable|not available/)
	await assert.rejects(data.open('friend', 'bad'))
	data.dispose()
	await assert.rejects(data.open('friend', id))
	assert.equal(calls.length, 1)
})
test('Friends shortcut opens the native list only on press and becomes unavailable on unload', async () => {
	const data = createStudioData()
	const calls: unknown[] = []
	const navigation = {
		isReady: () => true,
		navigate(this: unknown, ...args: unknown[]) {
			assert.equal(this, navigation)
			calls.push(args)
		},
	}
	assert.equal(data.canOpenFriends(), false)
	await assert.rejects(data.openFriends(), /not available/)
	data.attach('navigation', { getRootNavigationRef: () => navigation })
	assert.equal(data.canOpenFriends(), true)
	assert.deepEqual(calls, [])
	await data.openFriends()
	assert.deepEqual(calls, [
		['friends', { screen: 'root', params: { presentation: 'card' } }],
	])
	data.dispose()
	assert.equal(data.canOpenFriends(), false)
	await assert.rejects(data.openFriends(), /not available/)
	assert.equal(calls.length, 1)
})
test('Friends shortcut handles missing or unready navigation and forwards native failures', async () => {
	const data = createStudioData()
	for (const navigation of [
		null,
		{},
		{
			isReady: () => false,
			navigate: () => assert.fail('Must wait until navigation is ready'),
		},
	]) {
		data.attach('navigation', { getRootNavigationRef: () => navigation })
		await assert.rejects(data.openFriends(), /not available/)
	}
	data.attach('navigation', {
		getRootNavigationRef: () => ({
			navigate() {
				throw new Error('native failure')
			},
		}),
	})
	await assert.rejects(data.openFriends(), /native failure/)
	data.dispose()
})
test('font sizing uses supported native steps, preserves classic mode and never applies automatically', async () => {
	const data = createStudioData()
	let scale = 1
	const calls: unknown[] = []
	let cached: unknown
	data.attach('font', {
		getCustomFontScale: () => ({
			fontScale: scale,
			isClassicChatFontScaleEnabled: true,
		}),
		setCustomFontScale(value: number, classic: boolean) {
			calls.push([value, classic])
			scale = value
		},
	})
	data.attach('fontState', {
		useFontScaleStore: {
			setState: (value: unknown) => {
				cached = value
			},
		},
	})
	assert.deepEqual(calls, [])
	assert.equal(data.fontScale()?.fontScale, 1)
	await data.setFontScale(1.125)
	assert.deepEqual(calls, [[1.125, true]])
	assert.equal((cached as any).persistedFontScale, 1.125)
	await assert.rejects(data.setFontScale(99))
	assert.equal(calls.length, 1)
	data.dispose()
	await assert.rejects(data.setFontScale(1))
	assert.equal(calls.length, 1)
})
test('gallery cancellation and unload cannot commit a delayed image selection', async () => {
	const data = createStudioData()
	let resolve!: (value: unknown) => void
	data.attach('picker', {
		launchImageLibraryAsync: () =>
			new Promise(done => {
				resolve = done
			}),
	})
	const request = data.pick()
	data.dispose()
	resolve({ assets: [{ uri: 'content://photo/1' }] })
	assert.equal(await request, null)
})
test('shared storage serializes edits, merges Home and settings, rolls back to the last successful save', async () => {
	const initial = normalize({ enabled: true })
	runtime.update(initial)
	const stored: any[] = []
	let rejectLast = false
	const writer = createSettingsWriter({
		cache: initial,
		async set(value) {
			if (rejectLast) throw new Error('disk')
			stored.push(value)
		},
	})
	const first = writer.write({ accentColor: '#123456' })
	const second = writer.write(current => ({
		studio: { ...current.studio, favorites: [guild] },
	}))
	assert.equal(writer.isPending(), true)
	await Promise.all([first, second])
	assert.equal(writer.isPending(), false)
	assert.equal(stored[1].accentColor, '#123456')
	assert.deepEqual(stored[1].studio.favorites, [guild])
	rejectLast = true
	await assert.rejects(
		writer.write({ accentColor: '#FFFFFF' }),
		/Could not save/,
	)
	assert.equal(runtime.getSettings().accentColor, '#123456')
	assert.deepEqual(runtime.getSettings().studio.favorites, [guild])
	writer.stop()
	await assert.rejects(writer.write({ enabled: false }), /Reload/)
})
test('failed storage after unload cannot reactivate appearance', async () => {
	runtime.update({ enabled: true })
	let reject!: (error: Error) => void
	const writer = createSettingsWriter({
		cache: runtime.getSettings(),
		set: () =>
			new Promise((_resolve, fail) => {
				reject = fail
			}),
	})
	const job = writer.write({ accentColor: '#123456' })
	await Promise.resolve()
	writer.stop()
	runtime.update({ enabled: false })
	reject(new Error('disk'))
	await assert.rejects(job)
	assert.equal(runtime.getSettings().enabled, false)
})
