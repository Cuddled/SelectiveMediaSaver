import assert from 'node:assert/strict'
import test from 'node:test'
import { normalize, palette } from './core'
import {
	imageUri,
	normalizeStudio,
	pickedImage,
	resolveScene,
	togglePin,
} from './studioModel'

const channel = '123456789012345678'
const guild = '223456789012345678'
test('beta6 settings migrate without changing their switches, tint or accent', () => {
	const next = normalize({
		enabled: true,
		chats: false,
		panelColor: '#123456',
		accentColor: '#abcdef',
	})
	assert.equal(next.enabled, true)
	assert.equal(next.chats, false)
	assert.equal(next.panelColor, '#123456')
	assert.equal(next.accentColor, '#ABCDEF')
	assert.equal(next.studio.dashboard, true)
	assert.equal(next.studio.wallpaper, '')
	assert.notEqual(
		normalize({}).studio.favorites,
		normalize({}).studio.favorites,
	)
})
test('image locations reject executable protocols, credentials and malformed input', () => {
	for (const uri of [
		'javascript:alert(1)',
		'data:text/html,test',
		'http://example.com/a.png',
		'https://user:pass@example.com/a',
		'https://example.com/a\nb',
		'https://example.com/<svg>',
		'//example.com/a',
		'file://server/a',
		null,
		{},
	])
		assert.equal(imageUri(uri), '')
	for (const uri of [
		'https://example.com/a.png?sig=abc%20def',
		'file:///storage/emulated/0/Pictures/a.jpg',
		'content://media/external/images/12',
	])
		assert.equal(imageUri(uri), uri)
})
test('scene precedence is channel, server, app, then bundled wallpaper with independent accents', () => {
	const settings = normalize({
		studio: {
			wallpaper: 'https://example.com/app.jpg',
			scenes: {
				[`guild:${guild}`]: {
					wallpaper: 'https://example.com/guild.jpg',
					accent: '#11aabb',
				},
				[`channel:${channel}`]: {
					wallpaper: 'https://example.com/dm.jpg',
					accent: '',
				},
			},
		},
	})
	assert.deepEqual(resolveScene(settings, channel, guild), {
		wallpaper: 'https://example.com/dm.jpg',
		accent: '#11AABB',
	})
	assert.equal(
		resolveScene(settings, undefined, guild).wallpaper,
		'https://example.com/guild.jpg',
	)
	assert.equal(resolveScene(settings).wallpaper, 'https://example.com/app.jpg')
	assert.match(resolveScene(normalize({})).wallpaper, /background-v1\.png$/)
})
test('pins, rules and typography are bounded, independent copies', () => {
	const values = Array.from({ length: 130 }, (_, i) =>
		String(123456789012345678n + BigInt(i)),
	)
	const raw = {
		favorites: [...values, ...values, 'invalid'],
		scenes: Object.fromEntries(
			values.map(id => [
				`channel:${id}`,
				{ wallpaper: 'https://example.com/a', accent: '#FFFFFF' },
			]),
		),
		font: 'bad',
		letterSpacing: 100,
	}
	const normalized = normalizeStudio(raw)
	assert.equal(normalized.favorites.length, 24)
	assert.equal(Object.keys(normalized.scenes).length, 100)
	assert.equal(normalized.font, 'discord')
	assert.equal(normalized.letterSpacing, 0.6)
	assert.deepEqual(togglePin([channel], channel), [])
	assert.deepEqual(togglePin([], channel), [channel])
	assert.deepEqual(togglePin([], 'bad'), [])
	assert.deepEqual(
		normalizeStudio({
			scenes: {
				__proto__: {},
				wrong: {},
				[`channel:${channel}`]: { wallpaper: 'javascript:x', accent: 'red' },
			},
		}).scenes,
		{},
	)
})
test('photo cancellation is silent, picker failures are useful, native variants normalize', () => {
	assert.equal(pickedImage({ didCancel: true }), null)
	assert.equal(
		pickedImage({ assets: [{ uri: 'content://photo/123' }] }),
		'content://photo/123',
	)
	assert.equal(
		pickedImage([{ path: '/storage/photo.jpg' }]),
		'file:///storage/photo.jpg',
	)
	assert.throws(() => pickedImage({ errorCode: 'permission' }), /Photo access/)
	assert.throws(() => pickedImage({ assets: [] }), /No usable photo/)
})
test('reaction tokens are optional, use alpha hex, and do not replace role or danger colors', () => {
	const active = normalize({ enabled: true })
	const colors = palette(active)
	assert.match(colors.REACTION_BORDER_REACTED_DEFAULT, /^#[A-F0-9]{8}$/)
	assert.equal(colors.ROLE_DEFAULT, undefined)
	assert.equal(colors.TEXT_DANGER, undefined)
	assert.equal(
		palette(normalize({ ...active, chats: false })).REACTION_TEXT_DEFAULT,
		undefined,
	)
	assert.equal(
		palette(
			normalize({ ...active, studio: { ...active.studio, reactions: false } }),
		).REACTION_TEXT_DEFAULT,
		undefined,
	)
})
