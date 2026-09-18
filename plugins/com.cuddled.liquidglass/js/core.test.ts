import assert from 'node:assert/strict'
import test from 'node:test'
import {
	applyCustomProfile,
	applyCustomSettings,
	applyPreset,
	BUILT_IN_PRESETS,
	backgroundFingerprintFor,
	buildSemanticOverrides,
	DEFAULT_SETTINGS,
	hexToRgba,
	normalizeHexColor,
	normalizeSettings,
	removeCustomProfile,
	saveCustomProfile,
	semanticFingerprintFor,
} from './core'

test('normalizes short and long hex colors into canonical uppercase RGB', () => {
	assert.equal(normalizeHexColor('#abc'), '#AABBCC')
	assert.equal(normalizeHexColor('12aBef'), '#12ABEF')
	assert.equal(normalizeHexColor('nope', '#123'), '#112233')
	assert.equal(normalizeHexColor(null, 'invalid' as `#${string}`), '#000000')
})

test('composes clamped rgba colors', () => {
	assert.equal(hexToRgba('#123', 0.5), 'rgba(17, 34, 51, 0.5)')
	assert.equal(hexToRgba('#FF0080', 9), 'rgba(255, 0, 128, 1)')
	assert.equal(hexToRgba('#000000', -2), 'rgba(0, 0, 0, 0)')
	assert.equal(hexToRgba('invalid', Number.NaN), 'rgba(0, 0, 0, 1)')
})

test('falls back safely for missing and invalid stored settings', () => {
	const empty = normalizeSettings(null)
	assert.deepEqual(empty, DEFAULT_SETTINGS)
	assert.notEqual(empty.gradientColors, DEFAULT_SETTINGS.gradientColors)

	const invalid = normalizeSettings({
		selectedPreset: 'missing',
		enabled: 'yes',
		gradientColors: ['no', '#fff'],
		panelColor: 'wat',
	})
	assert.equal(invalid.selectedPreset, 'midnight')
	assert.equal(invalid.enabled, true)
	assert.deepEqual(
		invalid.gradientColors,
		BUILT_IN_PRESETS.midnight.values.gradientColors,
	)
	assert.equal(invalid.panelColor, BUILT_IN_PRESETS.midnight.values.panelColor)
})

test('migrates aliases, expands colors, and clamps visual values', () => {
	const settings = normalizeSettings({
		selectedPreset: 'custom',
		gradient: ['#123', '#abcdef', '#fff'],
		panelColor: '#abc',
		glassOpacity: -5,
		raisedOpacity: 5,
		softness: -1,
		angle: 700,
	})

	assert.equal(settings.selectedPreset, 'custom')
	assert.deepEqual(settings.gradientColors, ['#112233', '#ABCDEF', '#FFFFFF'])
	assert.equal(settings.panelColor, '#AABBCC')
	assert.equal(settings.panelOpacity, 0)
	assert.equal(settings.raisedOpacity, 1)
	assert.equal(settings.backgroundSoftness, 0)
	assert.equal(settings.angle, 360)
})

test('uses a selected preset as the fallback for partial saved settings', () => {
	const ocean = normalizeSettings({
		selectedPreset: 'ocean',
		accentColor: '#abc',
	})
	assert.equal(ocean.panelColor, BUILT_IN_PRESETS.ocean.values.panelColor)
	assert.deepEqual(
		ocean.gradientColors,
		BUILT_IN_PRESETS.ocean.values.gradientColors,
	)
	assert.equal(ocean.accentColor, '#AABBCC')
})

test('applies presets without mutating the current settings or preset registry', () => {
	const current = normalizeSettings({
		selectedPreset: 'custom',
		accentColor: '#123456',
		lowPowerMode: true,
	})
	const before = structuredClone(current)
	const presetBefore = structuredClone(BUILT_IN_PRESETS.rose)
	const rose = applyPreset(current, 'rose')

	assert.deepEqual(current, before)
	assert.deepEqual(BUILT_IN_PRESETS.rose, presetBefore)
	assert.equal(rose.selectedPreset, 'rose')
	assert.equal(rose.accentColor, BUILT_IN_PRESETS.rose.values.accentColor)
	assert.equal(rose.lowPowerMode, true)

	rose.gradientColors[0] = '#000000'
	assert.notEqual(
		rose.gradientColors[0],
		BUILT_IN_PRESETS.rose.values.gradientColors[0],
	)
})

test('custom edits normalize values and switch the preset to custom', () => {
	const customized = applyCustomSettings(DEFAULT_SETTINGS, {
		accentColor: '#0af',
		panelOpacity: 2,
		gradientColors: ['#111', '#222', '#333'],
	})
	assert.equal(customized.selectedPreset, 'custom')
	assert.equal(customized.accentColor, '#00AAFF')
	assert.equal(customized.panelOpacity, 1)
	assert.deepEqual(customized.gradientColors, ['#111111', '#222222', '#333333'])
})

test('builds an audited semantic payload and honors feature toggles', () => {
	assert.equal(
		buildSemanticOverrides(DEFAULT_SETTINGS).BACKGROUND_SURFACE_HIGH,
		'rgba(23, 27, 39, 0.55)',
	)

	const off = normalizeSettings({
		...DEFAULT_SETTINGS,
		enabled: false,
	})
	assert.deepEqual(buildSemanticOverrides(off), {})
})

test('semantic fingerprints change only when rendered surface colors change', () => {
	const initial = normalizeSettings(DEFAULT_SETTINGS)
	const initialOverrides = buildSemanticOverrides(initial)
	const initialFingerprint = semanticFingerprintFor(initial, initialOverrides)
	assert.notEqual(initialFingerprint, 'off')

	const angleOnly = normalizeSettings({ ...initial, angle: 45 })
	assert.equal(
		semanticFingerprintFor(angleOnly, buildSemanticOverrides(angleOnly)),
		initialFingerprint,
	)

	const recolored = normalizeSettings({ ...initial, panelColor: '#010203' })
	assert.notEqual(
		semanticFingerprintFor(recolored, buildSemanticOverrides(recolored)),
		initialFingerprint,
	)

	const disabled = normalizeSettings({ ...initial, semanticEnabled: false })
	assert.equal(
		semanticFingerprintFor(disabled, buildSemanticOverrides(disabled)),
		'off',
	)
})

test('background fingerprints track only live gradient inputs', () => {
	const initial = normalizeSettings(DEFAULT_SETTINGS)
	const initialFingerprint = backgroundFingerprintFor(initial)
	assert.notEqual(initialFingerprint, 'off')

	const recoloredText = normalizeSettings({ ...initial, textColor: '#010203' })
	assert.equal(backgroundFingerprintFor(recoloredText), initialFingerprint)

	const rotated = normalizeSettings({ ...initial, angle: 45 })
	assert.notEqual(backgroundFingerprintFor(rotated), initialFingerprint)

	const disabled = normalizeSettings({ ...initial, backgroundEnabled: false })
	assert.equal(backgroundFingerprintFor(disabled), 'off')
})

test('normalizes, deduplicates, and bounds saved custom profiles', () => {
	const customProfiles = Array.from({ length: 23 }, (_, index) => ({
		id: index === 22 ? 'duplicate' : `Profile ${index}`,
		name: `  Glass   ${index}  `,
		accentColor: '#abc',
		panelOpacity: 99,
	})).concat({
		id: 'duplicate',
		name: 'Newest Duplicate',
		accentColor: '#123456',
		panelOpacity: -1,
	} as never)
	const settings = normalizeSettings({
		customProfiles,
		activeProfileId: 'duplicate',
	})
	assert.equal(settings.customProfiles.length, 20)
	assert.equal(settings.customProfiles.at(-1)?.name, 'Newest Duplicate')
	assert.equal(settings.customProfiles.at(-1)?.accentColor, '#123456')
	assert.equal(settings.customProfiles.at(-1)?.panelOpacity, 0)
	assert.equal(settings.activeProfileId, 'duplicate')
})

test('saves, applies, and removes independent custom profile snapshots', () => {
	const source = normalizeSettings({
		...DEFAULT_SETTINGS,
		accentColor: '#123456',
		panelOpacity: 0.42,
	})
	const saved = saveCustomProfile(source, '  My   Glass  ')
	assert.equal(saved.selectedPreset, 'custom')
	assert.equal(saved.activeProfileId, 'my-glass')
	assert.equal(saved.customProfiles[0].name, 'My Glass')
	assert.deepEqual(Object.keys(saved.customProfiles[0]).sort(), [
		'accentColor',
		'angle',
		'backgroundEnabled',
		'backgroundSoftness',
		'borderColor',
		'gradientColors',
		'id',
		'name',
		'panelColor',
		'panelOpacity',
		'raisedOpacity',
		'textColor',
		'tintColor',
	])

	const changed = applyCustomSettings(saved, { accentColor: '#FFFFFF' })
	const applied = applyCustomProfile(changed, 'my-glass')
	assert.equal(applied.accentColor, '#123456')
	assert.equal(applied.panelOpacity, 0.42)
	assert.equal(changed.customProfiles[0].accentColor, '#123456')
	assert.equal('id' in applied, false)
	assert.equal('name' in applied, false)

	const removed = removeCustomProfile(applied, 'my-glass')
	assert.equal(removed.customProfiles.length, 0)
	assert.equal(removed.activeProfileId, null)
})

test('duplicate profile names receive stable unique IDs and explicit IDs upsert', () => {
	const first = saveCustomProfile(DEFAULT_SETTINGS, 'Neon')
	const second = saveCustomProfile(first, 'Neon')
	assert.deepEqual(
		second.customProfiles.map(profile => profile.id),
		['neon', 'neon-2'],
	)
	const updated = saveCustomProfile(
		{ ...second, accentColor: '#010203' },
		'Neon Updated',
		'neon',
	)
	assert.equal(updated.customProfiles.length, 2)
	assert.equal(updated.customProfiles.at(-1)?.id, 'neon')
	assert.equal(updated.customProfiles.at(-1)?.accentColor, '#010203')
})
