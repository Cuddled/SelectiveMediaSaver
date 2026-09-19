import assert from 'node:assert/strict'
import test from 'node:test'
import { normalize, profileButtonTheme } from './core'
import {
	PROFILE_ACCENT,
	profileAccent,
	profileControlColor,
	profileSemanticContext,
} from './profileAccents'

const settings = normalize({ enabled: true })

test('profile color is retained as a local accent while the opaque profile-button theme is removed', () => {
	const parent = {
		theme: 'light',
		primaryColor: 0x6030ab,
		secondaryColor: 0x123456,
		key: 'profile',
		contrast: 1.2,
	}
	const next = profileButtonTheme(settings, parent) as any
	assert.equal(next[PROFILE_ACCENT], '#6030AB')
	assert.equal(next.primaryColor, null)
	assert.equal(next.secondaryColor, null)
	assert.equal(next.contrast, parent.contrast)
	assert.equal(parent.primaryColor, 0x6030ab)
	const changed = profileButtonTheme(settings, {
		...parent,
		primaryColor: 0x23a0cc,
	}) as any
	assert.notEqual(
		changed.key,
		next.key,
		'Profile accent changes invalidate semantic caches even with the same parent key',
	)
	assert.equal(profileAccent('#abcd12'), '#ABCD12')
	assert.equal(profileAccent(0), '#000000')
	for (const value of [-1, 0x1000000, NaN, '#xyz', 'rgb(0,0,0)', null, {}, 2.5])
		assert.equal(profileAccent(value), '#8E83FF')
})

test('only tagged profile semantic contexts get accent borders and translucent fills with distinct pressed states', () => {
	const original = {
		contrast: 1,
		saturation: 1,
		gradient: null,
		isProfileTheme: false,
		enabledExperiments: [],
	}
	const theme = profileButtonTheme(settings, {
		primaryColor: 0x6030ab,
		key: 'member',
	})
	const context = profileSemanticContext(theme, original) as any
	assert.notEqual(context, original)
	assert.equal(context.enabledExperiments, original.enabledExperiments)
	assert.equal(context[PROFILE_ACCENT], '#6030AB')
	assert.equal((original as any)[PROFILE_ACCENT], undefined)
	for (const variant of ['PRIMARY', 'SECONDARY']) {
		const token = `CONTROL_${variant}`
		assert.equal(
			profileControlColor(settings, `${token}_BORDER_DEFAULT`, context),
			'#6030AB7F',
		)
		assert.equal(
			profileControlColor(settings, `${token}_BORDER_ACTIVE`, context),
			'#6030ABCC',
		)
		const normal = profileControlColor(
			settings,
			`${token}_BACKGROUND_DEFAULT`,
			context,
		)!
		const pressed = profileControlColor(
			settings,
			`${token}_BACKGROUND_ACTIVE`,
			context,
		)!
		assert.match(normal, /^#[\dA-F]{6}33$/)
		assert.match(pressed, /^#[\dA-F]{6}56$/)
		assert.notEqual(normal, pressed)
		assert.match(
			profileControlColor(
				{ ...settings, transparency: 1 },
				`${token}_BACKGROUND_DEFAULT`,
				context,
			)!,
			/00$/,
		)
		assert.match(
			profileControlColor(
				{ ...settings, transparency: 0 },
				`${token}_BACKGROUND_ACTIVE`,
				context,
			)!,
			/FF$/,
		)
	}
})

test('disabled settings, danger/purchase tokens and unrelated contexts are not accented', () => {
	const context = { [PROFILE_ACCENT]: '#123456' }
	for (const key of ['enabled', 'profiles', 'controls'])
		assert.equal(
			profileControlColor(
				{ ...settings, [key]: false },
				'CONTROL_PRIMARY_BACKGROUND_DEFAULT',
				context,
			),
			undefined,
		)
	for (const token of [
		'CONTROL_CRITICAL_PRIMARY_BACKGROUND_DEFAULT',
		'REDESIGN_BUTTON_PREMIUM_PRIMARY_PURPLE_FOR_GRADIENT',
		'TEXT_DEFAULT',
		'CONTROL_PRIMARY_TEXT_DEFAULT',
		'TOGGLEBUTTON_BACKGROUND_SELECTED',
	])
		assert.equal(profileControlColor(settings, token, context), undefined)
	for (const theme of [null, [], {}, 'dark']) {
		assert.equal(profileSemanticContext(theme, context), context)
		assert.equal(
			profileControlColor(
				settings,
				'CONTROL_PRIMARY_BACKGROUND_DEFAULT',
				theme,
			),
			undefined,
		)
	}
	for (const original of [null, [], 'unknown'])
		assert.equal(profileSemanticContext(context, original), original)
})
