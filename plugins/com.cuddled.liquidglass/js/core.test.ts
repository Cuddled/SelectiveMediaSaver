import assert from 'node:assert/strict'
import test from 'node:test'
import {
	applyCustomProfile,
	applyCustomSettings,
	applyPreset,
	applyProfileGlassToColors,
	applyProfileGlassToGradient,
	BUILT_IN_PRESETS,
	backgroundFingerprintFor,
	buildSemanticOverrides,
	CONTROL_SEMANTIC_COLOR_KEYS,
	chatWallpaperLayersFor,
	DEFAULT_SETTINGS,
	DEFAULT_WALLPAPER_SETTINGS,
	hexToRgba,
	hexWithAlpha,
	isChatWallpaperEnabled,
	normalizeHexColor,
	normalizeSettings,
	OVERLAY_SEMANTIC_COLOR_KEYS,
	PROFILE_SEMANTIC_COLOR_KEYS,
	removeCustomProfile,
	replaceDiscordHexAlpha,
	SEMANTIC_COLOR_KEYS,
	safeSemanticOverride,
	saveCustomProfile,
	semanticFingerprintFor,
	wallpaperLayersFor,
} from './core'

test('normalizes short and long hex colors into canonical uppercase RGB', () => {
	assert.equal(normalizeHexColor('#abc'), '#AABBCC')
	assert.equal(normalizeHexColor('12aBef'), '#12ABEF')
	assert.equal(normalizeHexColor('nope', '#123'), '#112233')
	assert.equal(normalizeHexColor(null, 'invalid' as `#${string}`), '#000000')
})

test('composes clamped rgba colors for plugin-owned React Native styles', () => {
	assert.equal(hexToRgba('#123', 0.5), 'rgba(17, 34, 51, 0.5)')
	assert.equal(hexToRgba('#FF0080', 9), 'rgba(255, 0, 128, 1)')
	assert.equal(hexToRgba('#000000', -2), 'rgba(0, 0, 0, 0)')
	assert.equal(hexToRgba('invalid', Number.NaN), 'rgba(0, 0, 0, 1)')
})

test('composes Discord-compatible alpha hex colors', () => {
	assert.equal(hexWithAlpha('#123', 0.5), '#1122337F')
	assert.equal(hexWithAlpha('#FF0080', 9), '#FF0080FF')
	assert.equal(hexWithAlpha('#000000', -2), '#00000000')
	assert.equal(hexWithAlpha('invalid', Number.NaN), '#000000FF')
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

test('migrates beta2 settings without resetting saved appearance data', () => {
	const settings = normalizeSettings({
		schemaVersion: 1,
		selectedPreset: 'custom',
		panelColor: '#123456',
		panelOpacity: 0.33,
		raisedOpacity: 0.61,
		customProfiles: [
			{
				id: 'old-look',
				name: 'Old Look',
				panelColor: '#654321',
				panelOpacity: 0.4,
			},
		],
	})

	assert.equal(settings.schemaVersion, 4)
	assert.equal(settings.panelColor, '#123456')
	assert.equal(settings.panelOpacity, 0.33)
	assert.equal(settings.raisedOpacity, 0.61)
	assert.equal(settings.profileGlassEnabled, true)
	assert.equal(settings.overlayGlassEnabled, true)
	assert.equal(settings.controlGlassEnabled, true)
	assert.equal(
		settings.profileOpacity,
		BUILT_IN_PRESETS.midnight.values.profileOpacity,
	)
	assert.equal(settings.customProfiles[0].panelColor, '#654321')
	assert.equal(
		settings.customProfiles[0].overlayOpacity,
		BUILT_IN_PRESETS.midnight.values.overlayOpacity,
	)
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
		'#171B278C',
	)
	assert.equal(
		buildSemanticOverrides(DEFAULT_SETTINGS).BACKGROUND_BASE_LOW,
		'#171B2773',
	)

	const off = normalizeSettings({
		...DEFAULT_SETTINGS,
		enabled: false,
	})
	assert.deepEqual(buildSemanticOverrides(off), {})
})

test('semantic overrides satisfy Discord hexWithOpacity for every preset', () => {
	for (const presetId of Object.keys(BUILT_IN_PRESETS)) {
		const settings = applyPreset(
			DEFAULT_SETTINGS,
			presetId as keyof typeof BUILT_IN_PRESETS,
		)
		const overrides = buildSemanticOverrides(settings)
		assert.deepEqual(Object.keys(overrides), [...SEMANTIC_COLOR_KEYS])
		for (const [name, color] of Object.entries(overrides)) {
			assert.match(color, /^#[0-9A-F]{8}$/, `${presetId}.${name}`)
		}
	}

	for (const panelOpacity of [0, 1]) {
		const overrides = buildSemanticOverrides(
			normalizeSettings({
				...DEFAULT_SETTINGS,
				panelColor: '#123456',
				tintColor: '#ABCDEF',
				panelOpacity,
				raisedOpacity: 1 - panelOpacity,
			}),
		)
		for (const color of Object.values(overrides)) {
			assert.match(color, /^#[0-9A-F]{8}$/)
		}
	}
})

test('surface-group switches remove only their own semantic colors', () => {
	const all = buildSemanticOverrides(DEFAULT_SETTINGS)
	const cases = [
		['profileGlassEnabled', PROFILE_SEMANTIC_COLOR_KEYS],
		['overlayGlassEnabled', OVERLAY_SEMANTIC_COLOR_KEYS],
		['controlGlassEnabled', CONTROL_SEMANTIC_COLOR_KEYS],
	] as const

	for (const [toggle, keys] of cases) {
		const overrides = buildSemanticOverrides({
			...DEFAULT_SETTINGS,
			[toggle]: false,
		})
		for (const key of keys)
			assert.equal(key in overrides, false, `${toggle}.${key}`)
		for (const key of Object.keys(all)) {
			if (!(keys as readonly string[]).includes(key)) {
				assert.equal(overrides[key], all[key], `${toggle}.${key}`)
			}
		}
	}
})

test('profile alpha replacement preserves RGB and rejects unfamiliar formats', () => {
	assert.equal(replaceDiscordHexAlpha('#123456', 0.5), '#1234567F')
	assert.equal(replaceDiscordHexAlpha('#123456AA', 0.25), '#1234563F')
	assert.equal(replaceDiscordHexAlpha('#abc', 1), '#AABBCCFF')
	assert.equal(replaceDiscordHexAlpha('#abcd', 0), '#AABBCC00')
	assert.equal(replaceDiscordHexAlpha('rgba(1, 2, 3, 1)', 0.5), '#0102037F')
	assert.equal(replaceDiscordHexAlpha('rgb(10, 20, 30)', 0.25), '#0A141E3F')
	assert.equal(
		replaceDiscordHexAlpha('rgba(999, 2, 3, 1)', 0.5),
		'rgba(999, 2, 3, 1)',
	)
	assert.equal(replaceDiscordHexAlpha('hsl(1, 2%, 3%)', 0.5), 'hsl(1, 2%, 3%)')
	assert.equal(replaceDiscordHexAlpha(123, 0.5), 123)
})

test('profile glass transforms own/member profile results without mutation', () => {
	const settings = normalizeSettings({
		...DEFAULT_SETTINGS,
		profileOpacity: 0.4,
	})
	const colors = Object.freeze({
		gradientFallbackBackground: '#112233',
		gradientSecondaryBackground: '#223344FF',
		containerBackground: '#334455',
		containerBorderColor: '#445566',
		avatarBackground: '#556677',
		statusBackground: '#667788',
		untouched: 'keep-me',
	})
	const gradient = Object.freeze(['#010203', 'rgba(170, 187, 204, 1)'])
	const transformedColors = applyProfileGlassToColors(
		settings,
		colors,
	) as Record<string, unknown>
	const transformedGradient = applyProfileGlassToGradient(
		settings,
		gradient,
	) as unknown[]

	assert.notEqual(transformedColors, colors)
	assert.equal(transformedColors.containerBackground, '#33445566')
	assert.equal(transformedColors.containerBorderColor, '#44556647')
	assert.equal(transformedColors.untouched, 'keep-me')
	assert.equal(colors.containerBackground, '#334455')
	assert.deepEqual(transformedGradient, ['#01020366', '#AABBCC66'])
	assert.deepEqual(gradient, ['#010203', 'rgba(170, 187, 204, 1)'])

	const disabled = normalizeSettings({
		...settings,
		profileGlassEnabled: false,
	})
	assert.equal(applyProfileGlassToColors(disabled, colors), colors)
	assert.equal(applyProfileGlassToGradient(disabled, gradient), gradient)
})

test('semantic override guard rejects formats that can crash Discord', () => {
	const invalid = [
		'rgba(23, 27, 39, 0.55)',
		'#1234',
		'transparent',
		'not-a-color',
	]
	for (const value of invalid) {
		assert.equal(safeSemanticOverride('TOKEN', { TOKEN: value }), undefined)
	}
	assert.equal(safeSemanticOverride('TOKEN', { TOKEN: '#112233' }), '#112233')
	assert.equal(
		safeSemanticOverride('TOKEN', { TOKEN: '#1122337F' }),
		'#1122337F',
	)
	assert.equal(safeSemanticOverride('MISSING', {}), undefined)
})

test('surface opacity still changes semantic colors and fingerprints', () => {
	const faint = normalizeSettings({ ...DEFAULT_SETTINGS, panelOpacity: 0.2 })
	const strong = normalizeSettings({ ...DEFAULT_SETTINGS, panelOpacity: 0.9 })
	const faintOverrides = buildSemanticOverrides(faint)
	const strongOverrides = buildSemanticOverrides(strong)

	assert.notEqual(
		faintOverrides.BACKGROUND_SURFACE_HIGH,
		strongOverrides.BACKGROUND_SURFACE_HIGH,
	)
	assert.notEqual(
		semanticFingerprintFor(faint, faintOverrides),
		semanticFingerprintFor(strong, strongOverrides),
	)
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
		'backgroundMode',
		'backgroundSoftness',
		'borderColor',
		'chatWallpaperDim',
		'chatWallpaperEnabled',
		'chatWallpaperOpacity',
		'controlOpacity',
		'gradientColors',
		'id',
		'name',
		'overlayOpacity',
		'panelColor',
		'panelOpacity',
		'profileOpacity',
		'raisedOpacity',
		'textColor',
		'tintColor',
		'wallpaperBlur',
		'wallpaperDim',
		'wallpaperOpacity',
		'wallpaperTintOpacity',
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

test('beta3 and legacy profiles migrate to gradients with existing appearance intact', () => {
	const stored = {
		schemaVersion: 2,
		selectedPreset: 'custom',
		panelColor: '#123456',
		profileOpacity: 0.27,
		backgroundEnabled: false,
		overlayGlassEnabled: false,
		customProfiles: [
			{
				id: 'legacy',
				name: 'Legacy',
				gradientColors: ['#123456', '#456789', '#ABCDEF'],
			},
		],
	}
	const migrated = normalizeSettings(stored)
	assert.equal(migrated.schemaVersion, 4)
	assert.equal(migrated.backgroundEnabled, false)
	assert.equal(migrated.overlayGlassEnabled, false)
	assert.equal(migrated.panelColor, '#123456')
	assert.equal(migrated.profileOpacity, 0.27)
	for (const [key, value] of Object.entries(DEFAULT_WALLPAPER_SETTINGS)) {
		assert.equal((migrated as any)[key], value)
		assert.equal((migrated.customProfiles[0] as any)[key], value)
	}
	assert.deepEqual(
		migrated.customProfiles[0].gradientColors,
		stored.customProfiles[0].gradientColors,
	)
	assert.equal(stored.schemaVersion, 2)
})

test('wallpaper settings reject invalid modes and clamp opacity and blur', () => {
	const invalid = normalizeSettings({
		backgroundMode: 'unknown',
		wallpaperOpacity: 9,
		wallpaperDim: -4,
		wallpaperTintOpacity: 'nope',
		wallpaperBlur: 999,
	})
	assert.equal(invalid.backgroundMode, 'gradient')
	assert.equal(invalid.wallpaperOpacity, 1)
	assert.equal(invalid.wallpaperDim, 0)
	assert.equal(invalid.wallpaperTintOpacity, 0.1)
	assert.equal(invalid.wallpaperBlur, 12)
	assert.equal(normalizeSettings({ wallpaperBlur: 2.8 }).wallpaperBlur, 3)
	assert.equal(
		normalizeSettings({ wallpaperOpacity: Number.NaN }).wallpaperOpacity,
		0.95,
	)
})

test('wallpaper selection survives every preset and saved profile round trips', () => {
	const waves = applyCustomSettings(DEFAULT_SETTINGS, {
		backgroundMode: 'midnight-waves',
		wallpaperOpacity: 0.72,
		wallpaperDim: 0.31,
		wallpaperTintOpacity: 0.2,
		wallpaperBlur: 4,
		chatWallpaperEnabled: true,
		chatWallpaperOpacity: 0.81,
		chatWallpaperDim: 0.47,
	})
	for (const preset of Object.values(BUILT_IN_PRESETS)) {
		const applied = applyPreset(waves, preset.id)
		for (const key of Object.keys(DEFAULT_WALLPAPER_SETTINGS))
			assert.equal((applied as any)[key], (waves as any)[key])
		assert.equal(applied.backgroundEnabled, true)
	}
	const saved = saveCustomProfile(waves, 'Waves')
	const changed = applyCustomSettings(saved, {
		backgroundMode: 'gradient',
		wallpaperBlur: 0,
		chatWallpaperEnabled: false,
		chatWallpaperDim: 0.2,
	})
	const restored = applyCustomProfile(
		normalizeSettings(JSON.parse(JSON.stringify(changed))),
		'waves',
	)
	assert.equal(restored.backgroundMode, 'midnight-waves')
	assert.equal(restored.wallpaperBlur, 4)
	assert.equal(restored.wallpaperDim, 0.31)
	assert.equal(restored.chatWallpaperEnabled, true)
	assert.equal(restored.chatWallpaperOpacity, 0.81)
	assert.equal(restored.chatWallpaperDim, 0.47)
	const updated = saveCustomProfile(
		{ ...restored, wallpaperDim: 0.6 },
		'Waves',
		'waves',
	)
	assert.equal(updated.customProfiles.length, 1)
	assert.equal(applyCustomProfile(updated, 'waves').wallpaperDim, 0.6)
})

test('wallpaper rendering refreshes for active controls and low power preserves stored blur', () => {
	const waves = applyCustomSettings(DEFAULT_SETTINGS, {
		backgroundMode: 'midnight-waves',
		wallpaperBlur: 6,
	})
	const base = backgroundFingerprintFor(waves)
	for (const changes of [
		{ wallpaperOpacity: 0.5 },
		{ wallpaperDim: 0.5 },
		{ wallpaperTintOpacity: 0.5 },
		{ wallpaperBlur: 2 },
		{ tintColor: '#FF0000' },
		{ backgroundMode: 'gradient' },
		{ lowPowerMode: true },
	]) {
		assert.notEqual(
			backgroundFingerprintFor(normalizeSettings({ ...waves, ...changes })),
			base,
		)
	}
	assert.equal(
		backgroundFingerprintFor({ ...waves, backgroundEnabled: false }),
		'off',
	)
	assert.equal(
		backgroundFingerprintFor(DEFAULT_SETTINGS),
		backgroundFingerprintFor({ ...DEFAULT_SETTINGS, wallpaperBlur: 5 }),
	)
	const lowPower = { ...waves, lowPowerMode: true }
	assert.equal(wallpaperLayersFor(lowPower).blurRadius, 0)
	assert.equal(lowPower.wallpaperBlur, 6)
	assert.equal(
		wallpaperLayersFor({ ...lowPower, lowPowerMode: false }).blurRadius,
		6,
	)
	assert.equal(wallpaperLayersFor(waves).tintColor, 'rgba(52, 58, 101, 0.1)')
	assert.equal(wallpaperLayersFor(waves).dimColor, 'rgba(0, 0, 0, 0.18)')
})

test('beta4 migrations preserve wallpaper settings and leave chat wallpaper opt-in', () => {
	const migrated = normalizeSettings({
		schemaVersion: 3,
		backgroundMode: 'midnight-waves',
		wallpaperOpacity: 0.68,
		wallpaperDim: 0.42,
	})
	assert.equal(migrated.schemaVersion, 4)
	assert.equal(migrated.backgroundMode, 'midnight-waves')
	assert.equal(migrated.wallpaperOpacity, 0.68)
	assert.equal(migrated.wallpaperDim, 0.42)
	assert.equal(migrated.chatWallpaperEnabled, false)
	assert.equal(migrated.chatWallpaperOpacity, 0.95)
	assert.equal(migrated.chatWallpaperDim, 0.3)
	const invalid = normalizeSettings({
		chatWallpaperEnabled: 'yes',
		chatWallpaperOpacity: 10,
		chatWallpaperDim: -5,
	})
	assert.equal(invalid.chatWallpaperEnabled, false)
	assert.equal(invalid.chatWallpaperOpacity, 1)
	assert.equal(invalid.chatWallpaperDim, 0)
	assert.equal(
		normalizeSettings({ chatWallpaperDim: Number.NaN }).chatWallpaperDim,
		0.3,
	)
})

test('chat wallpaper works independently and only active chat controls refresh it', () => {
	const chat = normalizeSettings({
		backgroundEnabled: false,
		chatWallpaperEnabled: true,
		wallpaperBlur: 4,
	})
	assert.equal(isChatWallpaperEnabled(chat), true)
	assert.equal(isChatWallpaperEnabled({ ...chat, enabled: false }), false)
	assert.equal(
		isChatWallpaperEnabled({ ...chat, chatWallpaperEnabled: false }),
		false,
	)
	const base = backgroundFingerprintFor(chat)
	assert.notEqual(base, 'off')
	for (const changes of [
		{ chatWallpaperOpacity: 0.4 },
		{ chatWallpaperDim: 0.7 },
		{ wallpaperBlur: 8 },
		{ wallpaperTintOpacity: 0.8 },
		{ tintColor: '#FF0000' },
		{ panelColor: '#010203' },
		{ lowPowerMode: true },
	]) {
		assert.notEqual(
			backgroundFingerprintFor(normalizeSettings({ ...chat, ...changes })),
			base,
		)
	}
	assert.equal(
		backgroundFingerprintFor({
			...chat,
			wallpaperOpacity: 0.2,
			wallpaperDim: 0.6,
		}),
		base,
	)
	assert.equal(backgroundFingerprintFor({ ...chat, enabled: false }), 'off')
	assert.equal(
		backgroundFingerprintFor({ ...DEFAULT_SETTINGS, chatWallpaperDim: 0.7 }),
		backgroundFingerprintFor(DEFAULT_SETTINGS),
	)
	assert.equal(chatWallpaperLayersFor(chat).opacity, 0.95)
	assert.equal(chatWallpaperLayersFor(chat).dimColor, 'rgba(0, 0, 0, 0.3)')
	assert.equal(
		chatWallpaperLayersFor({ ...chat, lowPowerMode: true }).blurRadius,
		0,
	)
})
