import assert from 'node:assert/strict'
import test from 'node:test'
import {
	CONTROL_SEMANTIC_COLOR_KEYS,
	DEFAULT_SETTINGS as LIQUID_DEFAULTS,
	OVERLAY_SEMANTIC_COLOR_KEYS,
	PROFILE_SEMANTIC_COLOR_KEYS,
} from '../../com.cuddled.liquidglass/js/core'
import {
	asGlass,
	createState,
	DEFAULT_SETTINGS,
	navigationTheme,
	normalize,
	palette,
	surfaceColor,
} from './core'

const active = normalize({ enabled: true })

test('Full-App Glass starts paused and has independent, normalized storage', () => {
	assert.equal(DEFAULT_SETTINGS.enabled, false)
	assert.deepEqual(normalize(null), DEFAULT_SETTINGS)
	const value = normalize({
		schemaVersion: 50,
		transparency: 2,
		darkness: -3,
		blur: Infinity,
		lowPower: 'yes',
		panelColor: '#123',
		unknown: 'discard',
	})
	assert.equal(value.schemaVersion, 1)
	assert.equal(value.transparency, 1)
	assert.equal(value.darkness, 0)
	assert.equal(value.blur, 0)
	assert.equal(value.lowPower, true)
	assert.equal(value.panelColor, '#112233')
	assert.equal('unknown' in value, false)
	assert.deepEqual(normalize(JSON.parse(JSON.stringify(active))), active)
})

test('master transparency really spans solid through fully clear surfaces', () => {
	for (const transparency of [0, 0.5, 0.8, 1]) {
		const settings = normalize({ ...active, transparency })
		const mapped = asGlass(settings)
		for (const key of [
			'panelOpacity',
			'raisedOpacity',
			'profileOpacity',
			'overlayOpacity',
			'controlOpacity',
		] as const)
			assert.equal(mapped[key], 1 - transparency)
		assert.match(surfaceColor(settings), /^#[0-9A-F]{8}$/)
	}
	assert.equal(surfaceColor({ ...active, transparency: 0 }).slice(-2), 'FF')
	assert.equal(surfaceColor({ ...active, transparency: 1 }).slice(-2), '00')
})

test('area switches independently remove audited color groups', () => {
	const all = palette(active)
	assert.ok(all.BACKGROUND_SURFACE_HIGH)
	for (const [toggle, keys] of [
		['profiles', PROFILE_SEMANTIC_COLOR_KEYS],
		['menus', OVERLAY_SEMANTIC_COLOR_KEYS],
		['controls', CONTROL_SEMANTIC_COLOR_KEYS],
	] as const) {
		const changed = palette({ ...active, [toggle]: false })
		for (const key of keys)
			assert.equal(changed[key], undefined, `${toggle}.${key}`)
		assert.equal(changed.BACKGROUND_SURFACE_HIGH, all.BACKGROUND_SURFACE_HIGH)
		assert.equal(changed.INTERACTIVE_ICON_DEFAULT, all.INTERACTIVE_ICON_DEFAULT)
	}
	const noMain = palette({ ...active, mainScreens: false })
	assert.equal(noMain.BACKGROUND_SURFACE_HIGH, undefined)
	assert.equal(
		noMain.CHANNEL_BACKGROUND_DEFAULT,
		all.CHANNEL_BACKGROUND_DEFAULT,
	)
	const noChats = palette({ ...active, chats: false })
	assert.equal(noChats.CHANNEL_BACKGROUND_DEFAULT, undefined)
	assert.equal(noChats.BACKGROUND_SURFACE_HIGH, all.BACKGROUND_SURFACE_HIGH)
	assert.deepEqual(palette(DEFAULT_SETTINGS), {})
})

test('all emitted colors are Discord-compatible hex, with readable text and softer disabled icons', () => {
	for (const transparency of [0, 0.5, 1]) {
		const settings = normalize({
			...active,
			transparency,
			textColor: '#010203',
		})
		const result = palette(settings)
		for (const color of Object.values(result))
			assert.match(color, /^#[0-9A-F]{8}$/)
		assert.equal(result.TEXT_STRONG, '#F7F8FFFF')
		assert.notEqual(result.ICON_MUTED, result.INTERACTIVE_ICON_DEFAULT)
		assert.equal(result.CHAT_INPUT_SEND_BUTTON_ICON_ACTIVE_TINT, undefined)
	}
})

test('pure helper mapping never changes Liquid Glass defaults or user preferences', () => {
	const before = structuredClone(LIQUID_DEFAULTS)
	const settings = normalize({
		...active,
		lowPower: true,
		blur: 8,
		textColor: '#030405',
	})
	const original = structuredClone(settings)
	const mapped = asGlass(settings)
	mapped.customProfiles.push({ id: 'x' } as any)
	mapped.gradientColors[0] = '#FFFFFF'
	assert.deepEqual(settings, original)
	assert.deepEqual(LIQUID_DEFAULTS, before)
	assert.equal(mapped.wallpaperBlur, 8)
	assert.equal(mapped.lowPowerMode, true)
	assert.equal(mapped.backgroundMode, 'midnight-waves')
})

test('navigation change retains fonts, notifications and original objects', () => {
	const original = {
		dark: false,
		fonts: { bold: 'font' },
		colors: {
			card: '#FFF',
			background: '#FFF',
			text: '#EEE',
			notification: '#F00',
		},
	}
	const changed = navigationTheme(active, original) as any
	assert.notEqual(changed, original)
	assert.equal(changed.fonts, original.fonts)
	assert.equal(changed.colors.card, '#00000000')
	assert.equal(changed.colors.notification, '#F00')
	assert.equal(original.colors.card, '#FFF')
	assert.equal(navigationTheme(DEFAULT_SETTINGS, original), original)
	assert.equal(
		navigationTheme({ ...active, mainScreens: false }, original),
		original,
	)
	for (const unknown of [null, undefined, [], {}, { colors: [] }])
		assert.equal(navigationTheme(active, unknown), unknown)
})

test('runtime refreshes only on real changes and releases subscribers', () => {
	const state = createState()
	let notifications = 0
	const stop = state.subscribe(() => notifications++)
	state.update(DEFAULT_SETTINGS)
	assert.equal(notifications, 0)
	const first = state.getSnapshot()
	state.update(active)
	assert.notEqual(state.getSnapshot(), first)
	assert.equal(notifications, 1)
	state.update({ ...active })
	assert.equal(notifications, 1)
	stop()
	state.update({ ...active, enabled: false })
	assert.equal(notifications, 1)
	assert.equal(state.getSettings().enabled, false)
})
