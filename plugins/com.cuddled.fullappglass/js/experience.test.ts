import assert from 'node:assert/strict'
import test from 'node:test'
import { WALLPAPER_SOURCE } from '../../com.cuddled.liquidglass/js/wallpaper'
import { normalize, palette } from './core'
import {
	applyMood,
	createMotionPolicy,
	createSharedMotionPolicy,
	focusAppearance,
	generatedBackdrop,
	MOODS,
	motionAllowed,
} from './experience'

test('beta7 settings migrate additively and mood changes retain scope, pins, scenes and power preferences', () => {
	const original = normalize({
		enabled: true,
		chats: false,
		lowPower: true,
		studio: {
			wallpaper: 'content://photos/1',
			homeWallpaper: 'https://example.com/home.png',
			favorites: ['123456789012345678'],
			scenes: {
				'guild:123456789012345678': {
					wallpaper: 'https://example.com/server.png',
					accent: '#123456',
				},
			},
		},
	})
	assert.equal(original.studio.focus, false)
	assert.equal(original.studio.mood, 'custom')
	for (const mood of Object.keys(MOODS) as Array<keyof typeof MOODS>) {
		const changed = normalize({ ...original, ...applyMood(original, mood) })
		assert.equal(changed.enabled, true)
		assert.equal(changed.chats, false)
		assert.equal(changed.lowPower, true)
		assert.deepEqual(changed.studio.scenes, original.studio.scenes)
		assert.deepEqual(changed.studio.favorites, original.studio.favorites)
		assert.equal(changed.studio.wallpaper, '')
		assert.equal(changed.studio.homeWallpaper, '')
		assert.equal(changed.accentColor, MOODS[mood].accent)
		assert.equal(generatedBackdrop(changed, WALLPAPER_SOURCE.uri), true)
		assert.equal(
			generatedBackdrop(changed, 'https://example.com/server.png'),
			false,
		)
	}
	assert.equal(original.studio.wallpaper, 'content://photos/1')
	assert.equal(
		normalize({ studio: { mood: 'bogus', focus: 'yes' } }).studio.focus,
		false,
	)
	assert.equal(normalize({ studio: { mood: 'bogus' } }).studio.mood, 'custom')
})

test('focus overrides presentation without destroying saved preferences, and calls obey their own switch', () => {
	const original = normalize({
		enabled: true,
		transparency: 0.74,
		studio: { focus: true, hideGift: false, music: true },
	})
	const focused = focusAppearance(original)
	assert.equal(focused.transparency, 0)
	assert.equal(focused.studio.hideGift, true)
	assert.equal(focused.studio.music, false)
	assert.equal(original.transparency, 0.74)
	assert.equal(original.studio.hideGift, false)
	const exited = normalize({
		...original,
		studio: { ...original.studio, focus: false },
	})
	assert.equal(focusAppearance(exited), exited)
	const paused = normalize({ ...original, enabled: false })
	assert.equal(focusAppearance(paused), paused)
	assert.equal(generatedBackdrop(original, 'content://photos/1'), true)
	assert.equal(
		palette(normalize({ enabled: false })).MOBILE_VOICE_PANEL_BACKGROUND,
		undefined,
	)
	assert.equal(
		palette(normalize({ enabled: true, studio: { calls: false } }))
			.MOBILE_VOICE_PANEL_BACKGROUND,
		undefined,
	)
	assert.match(palette(exited).MOBILE_VOICE_PANEL_BACKGROUND, /^#[A-F0-9]{8}$/)
})

function platform() {
	let resolve!: (value: boolean) => void
	const pending = new Promise<boolean>(done => {
		resolve = done
	})
	const events: Record<string, (value: any) => void> = {}
	let added = 0
	let removed = 0
	const add = (key: string, callback: (value: any) => void) => {
		events[key] = callback
		added++
		return {
			remove() {
				removed++
				delete events[key]
			},
		}
	}
	return {
		events,
		resolve,
		added: () => added,
		removed: () => removed,
		native: {
			AppState: { currentState: 'active', addEventListener: add },
			AccessibilityInfo: {
				addEventListener: add,
				isReduceMotionEnabled: () => pending,
			},
		},
	}
}

test('motion waits for accessibility, respects background/low-power/focus, and ignores stale accessibility reads', async () => {
	const os = platform()
	const policy = createMotionPolicy(os.native)
	const settings = normalize({ enabled: true, lowPower: false })
	assert.equal(policy.allows(settings), false)
	os.events.reduceMotionChanged(true)
	os.resolve(false)
	await Promise.resolve()
	assert.equal(policy.allows(settings), false)
	os.events.reduceMotionChanged(false)
	assert.equal(policy.allows(settings), true)
	os.events.change('background')
	assert.equal(policy.allows(settings), false)
	os.events.change('active')
	assert.equal(policy.allows(settings), true)
	for (const changed of [
		normalize({ ...settings, enabled: false }),
		normalize({ ...settings, lowPower: true }),
		normalize({ ...settings, studio: { focus: true } }),
		normalize({ ...settings, studio: { mood: 'oled' } }),
	])
		assert.equal(motionAllowed(changed, false, true), false)
	policy.dispose()
	assert.equal(os.removed(), 2)
	assert.equal(policy.allows(settings), false)
})

test('many animated surfaces share two native listeners, release them, and resubscribe cleanly', async () => {
	const os = platform()
	const shared = createSharedMotionPolicy(os.native)
	assert.equal(os.added(), 0)
	const unsubscribers = Array.from({ length: 50 }, () =>
		shared.subscribe(() => {}),
	)
	assert.equal(os.added(), 2)
	os.resolve(false)
	await Promise.resolve()
	assert.equal(
		shared.allows(normalize({ enabled: true, lowPower: false })),
		true,
	)
	for (const unsubscribe of unsubscribers.slice(0, -1)) unsubscribe()
	assert.equal(os.removed(), 0)
	unsubscribers.at(-1)!()
	assert.equal(os.removed(), 2)
	assert.equal(
		shared.allows(normalize({ enabled: true, lowPower: false })),
		false,
	)
	const stop = shared.subscribe(() => {})
	assert.equal(os.added(), 4)
	await Promise.resolve()
	assert.equal(
		shared.allows(normalize({ enabled: true, lowPower: false })),
		true,
	)
	stop()
	assert.equal(os.removed(), 4)
})

test('missing platform APIs keep motion still and late accessibility work cannot revive disposed policy', async () => {
	const settings = normalize({ enabled: true, lowPower: false })
	const missing = createMotionPolicy({})
	await Promise.resolve()
	assert.equal(missing.allows(settings), false)
	missing.dispose()
	const os = platform()
	const policy = createMotionPolicy(os.native)
	let calls = 0
	policy.subscribe(() => calls++)
	policy.dispose()
	os.resolve(false)
	await Promise.resolve()
	assert.equal(calls, 0)
	assert.equal(policy.allows(settings), false)
})
