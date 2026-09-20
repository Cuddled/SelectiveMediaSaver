import assert from 'node:assert/strict'
import test from 'node:test'
import { normalize } from './core'
import {
	blendProfileColors,
	blendProfileGradient,
	profileGradientOverlay,
	profilePalette,
} from './profileTheme'

const settings = normalize({ enabled: true })
const pink = { primaryColor: 0xff75bf, secondaryColor: 0xa53c88 }
const original = {
	gradientFallbackBackground: '#171B2B33',
	gradientSecondaryBackground: '#171B2B33',
	containerBackground: 'rgba(255, 117, 191, 0.2)',
	containerBorderColor: '#FF75BFAA',
	avatarBackground: '#171B2B33',
	statusBackground: '#171B2B33',
	other: 'untouched',
}

test('custom pink profile colors remain distinct from the app and from the next profile', () => {
	const before = structuredClone(original)
	const colors = profilePalette(settings, pink)!
	const next = blendProfileColors(settings, original, pink) as typeof original
	assert.ok(
		parseInt(colors.primary.slice(1, 3), 16) >
			parseInt(colors.primary.slice(3, 5), 16) * 1.5,
	)
	assert.notEqual(colors.primary, settings.panelColor)
	assert.ok(next.containerBackground.startsWith(colors.primary))
	assert.ok(next.containerBorderColor.startsWith(colors.border))
	assert.equal(next.other, 'untouched')
	assert.deepEqual(original, before)
	const blue = blendProfileColors(settings, original, {
		primaryColor: 0x3c87ef,
		secondaryColor: 0x174d99,
	}) as typeof original
	assert.notEqual(blue.containerBackground, next.containerBackground)
	assert.deepEqual(blendProfileColors(settings, original, pink), next)
})

test('native rgba gradients become a readable two-color palette and a translucent backdrop', () => {
	const gradient = ['rgba(255, 117, 191, 1)', 'rgba(165, 60, 136, 1)']
	const next = blendProfileGradient(
		settings,
		gradient,
		pink.primaryColor,
		pink.secondaryColor,
	) as string[]
	const colors = profilePalette(settings, pink)!
	assert.equal(next[0], `${colors.primary}33`)
	assert.equal(next[1], `${colors.secondary}33`)
	const overlay = profileGradientOverlay(settings, [next[0], next[0], next[1]])!
	assert.equal(overlay.length, 3)
	assert.equal(overlay[0], overlay[1])
	assert.ok(overlay[2].startsWith(colors.secondary))
	assert.ok(parseInt(overlay[0].slice(-2), 16) < 255)
	assert.equal(gradient[0], 'rgba(255, 117, 191, 1)')
})

test('white, pale and vivid owner colors keep at least 4.5:1 contrast with white text', () => {
	for (const primaryColor of [
		0xffffff, 0xffeeee, 0xffff00, 0x00ff00, 0x00ffff, 0xff00ff, 0,
	]) {
		for (const panelColor of ['#FFFFFF', '#171B2B', '#000000']) {
			const colors = profilePalette(
				normalize({
					enabled: true,
					panelColor,
					studio: { profileColorStrength: 1 },
				}),
				{ primaryColor, secondaryColor: primaryColor },
			)!
			const c = [1, 3, 5]
				.map(i => parseInt(colors.primary.slice(i, i + 2), 16) / 255)
				.map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
			assert.ok(
				1.05 / (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] + 0.05) >= 4.5,
			)
		}
	}
})

test('uncolored profiles, pause, focus and opt-out keep the original appearance unchanged', () => {
	for (const theme of [
		null,
		{},
		{ primaryColor: 0 },
		{ primaryColor: NaN, secondaryColor: 1 },
		{ primaryColor: 'oops', secondaryColor: 0 },
		[],
	]) {
		assert.equal(blendProfileColors(settings, original, theme), original)
		assert.equal(profilePalette(settings, theme), undefined)
	}
	for (const off of [
		normalize({ enabled: false }),
		normalize({ enabled: true, profiles: false }),
		normalize({ enabled: true, studio: { profileColors: false } }),
		normalize({ enabled: true, studio: { focus: true } }),
	]) {
		assert.equal(blendProfileColors(off, original, pink), original)
		assert.equal(
			profileGradientOverlay(off, ['#FF75BF33', '#A53C8833']),
			undefined,
		)
	}
	const unknown = [{ dynamic: true }, '#FFFFFF']
	assert.equal(
		blendProfileGradient(
			settings,
			unknown,
			pink.primaryColor,
			pink.secondaryColor,
		),
		unknown,
	)
	assert.equal(profileGradientOverlay(settings, unknown), undefined)
})

test('old settings gain balanced color blending and invalid strength is bounded', () => {
	assert.equal(
		normalize({ studio: { mood: 'rose' } }).studio.profileColors,
		true,
	)
	assert.equal(normalize({}).studio.profileColorStrength, 0.65)
	assert.equal(
		normalize({ studio: { profileColorStrength: Infinity } }).studio
			.profileColorStrength,
		0.65,
	)
	assert.equal(
		normalize({ studio: { profileColorStrength: -1 } }).studio
			.profileColorStrength,
		0,
	)
	assert.equal(
		normalize({ studio: { profileColorStrength: 5 } }).studio
			.profileColorStrength,
		1,
	)
})
