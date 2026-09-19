import {
	applyCustomProfile,
	applyCustomSettings,
	applyPreset,
	BUILT_IN_PRESETS,
	chatWallpaperLayersFor,
	DEFAULT_SETTINGS,
	hexToRgba,
	isChatWallpaperEnabled,
	isWallpaperBackground,
	MAX_CUSTOM_PROFILES,
	normalizeHexColor,
	normalizeSettings,
	removeCustomProfile,
	saveCustomProfile,
	wallpaperLayersFor,
} from './core'
import { previewRuntimeSettings } from './runtime'
import { ABSOLUTE_FILL, WALLPAPER_SOURCE } from './wallpaper'
import type { PluginApi } from '@revenge-mod/plugins/types'
import type {
	BackgroundMode,
	BuiltInPresetId,
	HexColor,
	LiquidGlassAppearanceSettings,
	LiquidGlassSettings,
} from './types'

type GlassApi = PluginApi<{ jsonStorage: LiquidGlassSettings }>

const GRADIENT_STOPS = ['Start', 'Middle', 'End'] as const
const RUNTIME_PREVIEW_INTERVAL_MS = 45

function toast(key: string, content: string): void {
	try {
		revenge.discord.actions.ToastActionCreators.open({ key, content })
	} catch {
		console.log(`[LiquidGlass] ${content}`)
	}
}

function GlassPreview({ settings }: { settings: LiquidGlassSettings }) {
	const { View } = revenge.react.ReactNative
	const { Stack, Text } = revenge.discord.design.Design
	const panel = hexToRgba(settings.panelColor, settings.panelOpacity)
	const profile = hexToRgba(settings.panelColor, settings.profileOpacity)
	const overlay = hexToRgba(settings.tintColor, settings.overlayOpacity)
	const control = hexToRgba(settings.tintColor, settings.controlOpacity)
	const border = hexToRgba(settings.borderColor, 0.22)
	const surfacesEnabled = settings.enabled && settings.semanticEnabled

	return (
		<View
			style={{
				height: 242,
				overflow: 'hidden',
				borderRadius: 24,
				backgroundColor: settings.gradientColors[0],
				borderWidth: 1,
				borderColor: border,
			}}
		>
			<View
				style={{
					position: 'absolute',
					top: -48,
					right: -36,
					width: 220,
					height: 160,
					borderRadius: 90,
					backgroundColor: hexToRgba(settings.gradientColors[2], 0.72),
				}}
			/>
			<View
				style={{
					position: 'absolute',
					bottom: -55,
					left: -40,
					width: 230,
					height: 160,
					borderRadius: 100,
					backgroundColor: hexToRgba(settings.gradientColors[1], 0.78),
				}}
			/>
			{isWallpaperBackground(settings) && (
				<WallpaperPreview settings={settings} />
			)}
			<View style={{ flex: 1, padding: 14 }}>
				<Stack spacing={10}>
					<View
						style={{
							padding: 12,
							borderRadius: 18,
							backgroundColor:
								surfacesEnabled && settings.profileGlassEnabled
									? profile
									: panel,
							borderWidth: 1,
							borderColor: border,
						}}
					>
						<Text
							variant="heading-md/semibold"
							style={{ color: settings.textColor }}
						>
							Profile glass
						</Text>
						<Text
							variant="text-sm/normal"
							style={{ color: hexToRgba(settings.textColor, 0.72) }}
						>
							Your profile and every member profile keep their own colors.
						</Text>
					</View>
					<View
						style={{
							alignSelf: 'flex-end',
							maxWidth: '78%',
							paddingHorizontal: 12,
							paddingVertical: 9,
							borderRadius: 16,
							backgroundColor:
								surfacesEnabled && settings.overlayGlassEnabled
									? overlay
									: panel,
							borderWidth: 1,
							borderColor: hexToRgba(settings.accentColor, 0.42),
						}}
					>
						<Text
							variant="text-sm/medium"
							style={{ color: settings.textColor }}
						>
							Menus, sheets, popups ✨
						</Text>
					</View>
					<View
						style={{
							marginTop: 2,
							paddingHorizontal: 13,
							paddingVertical: 10,
							borderRadius: 18,
							backgroundColor:
								surfacesEnabled && settings.controlGlassEnabled
									? control
									: panel,
						}}
					>
						<Text
							variant="text-sm/normal"
							style={{ color: hexToRgba(settings.textColor, 0.64) }}
						>
							Buttons • inputs • lists
						</Text>
					</View>
				</Stack>
			</View>
		</View>
	)
}

function WallpaperPreview({
	settings,
	chat = false,
}: {
	settings: LiquidGlassSettings
	chat?: boolean
}) {
	const { View, Image } = revenge.react.ReactNative
	const [ready, setReady] = revenge.react.React.useState(false)
	const layers = chat
		? chatWallpaperLayersFor(settings)
		: wallpaperLayersFor(settings)
	return (
		<View
			style={ABSOLUTE_FILL}
			pointerEvents="none"
			accessible={false}
			importantForAccessibility="no-hide-descendants"
		>
			<Image
				source={WALLPAPER_SOURCE}
				resizeMode="cover"
				blurRadius={layers.blurRadius}
				style={[ABSOLUTE_FILL, { opacity: ready ? layers.opacity : 0 }]}
				onLoad={() => setReady(true)}
				onError={() => setReady(false)}
			/>
			{ready && (
				<View style={[ABSOLUTE_FILL, { backgroundColor: layers.tintColor }]} />
			)}
			{ready && (
				<View style={[ABSOLUTE_FILL, { backgroundColor: layers.dimColor }]} />
			)}
		</View>
	)
}

function ChatPreview({ settings }: { settings: LiquidGlassSettings }) {
	const { View } = revenge.react.ReactNative
	const { Stack, Text } = revenge.discord.design.Design
	return (
		<View
			style={{
				minHeight: 166,
				overflow: 'hidden',
				borderRadius: 20,
				backgroundColor: settings.panelColor,
			}}
		>
			{isChatWallpaperEnabled(settings) && (
				<WallpaperPreview settings={settings} chat />
			)}
			<View style={{ padding: 18 }}>
				<Stack spacing={10}>
					<Text
						variant="text-sm/semibold"
						style={{ color: settings.accentColor }}
					>
						Chat preview · only you see this
					</Text>
					<Text
						variant="text-md/semibold"
						style={{ color: settings.textColor }}
					>
						You
					</Text>
					<Text variant="text-md/normal" style={{ color: settings.textColor }}>
						Purple waves behind your conversations ✨
					</Text>
					<Text variant="text-sm/normal" style={{ color: settings.textColor }}>
						Increase darkness if messages are hard to read.
					</Text>
				</Stack>
			</View>
		</View>
	)
}

function BackgroundPicker({
	settings,
	onSelect,
}: {
	settings: LiquidGlassSettings
	onSelect: (mode: BackgroundMode) => void
}) {
	const { View, Pressable, Image } = revenge.react.ReactNative
	const { Text } = revenge.discord.design.Design
	return (
		<View style={{ flexDirection: 'row', gap: 10 }}>
			{(['gradient', 'midnight-waves'] as const).map(mode => {
				const selected = settings.backgroundMode === mode
				return (
					<Pressable
						key={mode}
						accessibilityRole="button"
						accessibilityState={{ selected }}
						onPress={() => onSelect(mode)}
						style={{
							flex: 1,
							overflow: 'hidden',
							borderRadius: 18,
							borderWidth: 2,
							borderColor: selected
								? settings.accentColor
								: hexToRgba(settings.borderColor, 0.18),
							backgroundColor: settings.panelColor,
						}}
					>
						<View
							style={{
								height: 90,
								overflow: 'hidden',
								backgroundColor: settings.gradientColors[0],
							}}
						>
							<View style={{ ...ABSOLUTE_FILL, flexDirection: 'row' }}>
								{settings.gradientColors.map((color, index) => (
									<View
										key={GRADIENT_STOPS[index]}
										style={{ flex: 1, backgroundColor: color }}
									/>
								))}
							</View>
							{mode === 'midnight-waves' && (
								<Image
									source={WALLPAPER_SOURCE}
									resizeMode="cover"
									style={ABSOLUTE_FILL}
								/>
							)}
						</View>
						<View style={{ padding: 10 }}>
							<Text
								variant="text-sm/semibold"
								style={{ color: settings.textColor }}
							>
								{selected ? '✓ ' : ''}
								{mode === 'gradient' ? 'Gradient' : 'Midnight Waves'}
							</Text>
						</View>
					</Pressable>
				)
			})}
		</View>
	)
}

function PresetPicker({
	settings,
	onSelect,
}: {
	settings: LiquidGlassSettings
	onSelect: (id: BuiltInPresetId) => void
}) {
	const { View, Pressable } = revenge.react.ReactNative
	const { Stack, Text } = revenge.discord.design.Design

	return (
		<Stack spacing={8}>
			{Object.values(BUILT_IN_PRESETS).map(preset => {
				const selected = settings.selectedPreset === preset.id
				return (
					<Pressable
						key={preset.id}
						onPress={() => onSelect(preset.id)}
						style={{
							borderRadius: 16,
							borderWidth: selected ? 2 : 1,
							borderColor: selected
								? preset.values.accentColor
								: hexToRgba(preset.values.borderColor, 0.18),
							backgroundColor: hexToRgba(preset.values.panelColor, 0.82),
							padding: 12,
						}}
					>
						<Stack direction="horizontal" spacing={12} align="center">
							<View style={{ flexDirection: 'row' }}>
								{preset.values.gradientColors.map((color, index) => (
									<View
										key={`${preset.id}-${GRADIENT_STOPS[index]}`}
										style={{
											width: 22,
											height: 36,
											marginLeft: index ? -5 : 0,
											borderRadius: 10,
											backgroundColor: color,
											borderWidth: 1,
											borderColor: hexToRgba('#FFFFFF', 0.18),
										}}
									/>
								))}
							</View>
							<View style={{ flex: 1 }}>
								<Text
									variant="text-md/semibold"
									style={{ color: preset.values.textColor }}
								>
									{selected ? '✓ ' : ''}
									{preset.label}
								</Text>
								<Text
									variant="text-xs/normal"
									style={{ color: hexToRgba(preset.values.textColor, 0.66) }}
								>
									{preset.description}
								</Text>
							</View>
						</Stack>
					</Pressable>
				)
			})}
		</Stack>
	)
}

function ColorField({
	label,
	value,
	onValidColor,
}: {
	label: string
	value: HexColor
	onValidColor: (value: HexColor) => void
}) {
	const { useEffect, useState } = revenge.react.React
	const { View } = revenge.react.ReactNative
	const { Stack, Text, TextInput } = revenge.discord.design.Design
	const [draft, setDraft] = useState<string>(value)
	const [error, setError] = useState(false)
	useEffect(() => {
		setDraft(value)
		setError(false)
	}, [value])

	return (
		<Stack spacing={5}>
			<Text variant="text-sm/semibold" color="text-strong">
				{label}
			</Text>
			<Stack direction="horizontal" spacing={10} align="center">
				<View
					style={{
						width: 34,
						height: 34,
						borderRadius: 12,
						backgroundColor: value,
						borderWidth: 1,
						borderColor: hexToRgba('#FFFFFF', 0.22),
					}}
				/>
				<View style={{ flex: 1 }}>
					<TextInput
						value={draft}
						placeholder="#7C8CFF"
						maxLength={7}
						status={error ? 'error' : 'default'}
						errorMessage={error ? 'Use #RGB or #RRGGBB.' : undefined}
						onChange={next => {
							setDraft(next)
							setError(false)
							if (/^#?[a-f\d]{6}$/i.test(next.trim())) {
								onValidColor(normalizeHexColor(next, value))
							}
						}}
						onBlur={() => {
							if (/^#?(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(draft.trim())) {
								const normalized = normalizeHexColor(draft, value)
								setDraft(normalized)
								onValidColor(normalized)
								setError(false)
							} else {
								setError(true)
							}
						}}
					/>
				</View>
			</Stack>
		</Stack>
	)
}

function SliderField({
	label,
	value,
	minimumValue,
	maximumValue,
	step,
	format,
	onCommit,
	onPreview,
}: {
	label: string
	value: number
	minimumValue: number
	maximumValue: number
	step: number
	format: (value: number) => string
	onCommit: (value: number) => void
	onPreview?: (value: number) => void
}) {
	const { useEffect, useState } = revenge.react.React
	const { Stack, Text, Slider } = revenge.discord.design.Design
	const [draft, setDraft] = useState(value)
	useEffect(() => setDraft(value), [value])

	return (
		<Stack spacing={4}>
			<Stack direction="horizontal" justify="space-between">
				<Text variant="text-sm/semibold">{label}</Text>
				<Text variant="text-sm/normal" color="text-muted">
					{format(draft)}
				</Text>
			</Stack>
			<Slider
				step={step}
				value={draft}
				minimumValue={minimumValue}
				maximumValue={maximumValue}
				onValueChange={next => {
					setDraft(next)
					onPreview?.(next)
				}}
				onSlidingComplete={onCommit}
			/>
		</Stack>
	)
}

export default function Settings({ api }: { api: GlassApi }) {
	const { useEffect, useMemo, useRef, useState } = revenge.react.React
	const { Page } = api.unscoped.components
	const { ScrollView, View } = revenge.react.ReactNative
	const {
		Button,
		Card,
		Stack,
		TableRowGroup,
		TableSwitchRow,
		Text,
		TextInput,
	} = revenge.discord.design.Design
	const settings = normalizeSettings(api.jsonStorage.use() ?? DEFAULT_SETTINGS)
	const settingsKey = useMemo(() => JSON.stringify(settings), [settings])
	const [previewSettings, setPreviewSettings] = useState(settings)
	const [profileName, setProfileName] = useState('')
	const [renamingProfileId, setRenamingProfileId] = useState<string | null>(
		null,
	)
	const persistedSettingsRef = useRef(settings)
	const pendingRuntimePreviewRef = useRef<LiquidGlassSettings | null>(null)
	const runtimePreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	)
	useEffect(() => {
		persistedSettingsRef.current = settings
		setPreviewSettings(settings)
	}, [settingsKey])
	useEffect(
		() => () => {
			if (runtimePreviewTimerRef.current) {
				clearTimeout(runtimePreviewTimerRef.current)
			}
			runtimePreviewTimerRef.current = null
			pendingRuntimePreviewRef.current = null
			previewRuntimeSettings(persistedSettingsRef.current)
		},
		[],
	)
	const restorePersistedPreview = () => {
		if (runtimePreviewTimerRef.current) {
			clearTimeout(runtimePreviewTimerRef.current)
		}
		runtimePreviewTimerRef.current = null
		pendingRuntimePreviewRef.current = null
		setPreviewSettings(persistedSettingsRef.current)
		previewRuntimeSettings(persistedSettingsRef.current)
	}

	const save = (next: LiquidGlassSettings, success?: string) => {
		return api.jsonStorage
			.set(normalizeSettings(next), true)
			.then(() => {
				if (success) toast('liquid-glass-setting', success)
				return true
			})
			.catch(error => {
				console.error('[LiquidGlass] settings write failed:', error)
				restorePersistedPreview()
				toast(
					'liquid-glass-setting-error',
					'That appearance change could not be saved.',
				)
				return false
			})
	}
	const patch = (changes: Partial<LiquidGlassSettings>) =>
		save(normalizeSettings({ ...settings, ...changes }))
	const customize = (changes: Partial<LiquidGlassAppearanceSettings>) =>
		save(applyCustomSettings(settings, changes))
	const previewRuntimeThrottled = (next: LiquidGlassSettings) => {
		if (settings.lowPowerMode) return
		pendingRuntimePreviewRef.current = next
		if (runtimePreviewTimerRef.current) return

		previewRuntimeSettings(next)
		pendingRuntimePreviewRef.current = null
		runtimePreviewTimerRef.current = setTimeout(() => {
			runtimePreviewTimerRef.current = null
			const pending = pendingRuntimePreviewRef.current
			pendingRuntimePreviewRef.current = null
			if (pending) previewRuntimeSettings(pending)
		}, RUNTIME_PREVIEW_INTERVAL_MS)
	}
	const flushRuntimePreview = (next: LiquidGlassSettings) => {
		if (runtimePreviewTimerRef.current) {
			clearTimeout(runtimePreviewTimerRef.current)
		}
		runtimePreviewTimerRef.current = null
		pendingRuntimePreviewRef.current = null
		previewRuntimeSettings(next)
	}
	const previewCustom = (changes: Partial<LiquidGlassAppearanceSettings>) => {
		const next = applyCustomSettings(settings, changes)
		setPreviewSettings(next)
		previewRuntimeThrottled(next)
	}
	const commitCustom = (changes: Partial<LiquidGlassAppearanceSettings>) => {
		const next = applyCustomSettings(settings, changes)
		setPreviewSettings(next)
		flushRuntimePreview(next)
		save(next)
	}
	const clearProfileEditor = () => {
		setProfileName('')
		setRenamingProfileId(null)
	}
	const saveProfile = (profileId?: string) => {
		const existing = profileId
			? settings.customProfiles.find(profile => profile.id === profileId)
			: undefined
		const name = profileId
			? (existing?.name ?? 'Custom Glass')
			: profileName.trim() || 'Custom Glass'
		void save(
			saveCustomProfile(settings, name, profileId),
			profileId ? 'Profile updated.' : 'Custom profile saved.',
		).then(saved => {
			if (saved) clearProfileEditor()
		})
	}
	const renameProfile = () => {
		if (!renamingProfileId || !profileName.trim()) return
		const customProfiles = settings.customProfiles.map(profile =>
			profile.id === renamingProfileId
				? { ...profile, name: profileName.trim().slice(0, 32) }
				: profile,
		)
		void save(
			normalizeSettings({ ...settings, customProfiles }),
			'Profile renamed.',
		).then(saved => {
			if (saved) clearProfileEditor()
		})
	}
	const deleteProfile = (profileId: string) => {
		save(removeCustomProfile(settings, profileId), 'Profile deleted.')
	}

	return (
		<Page>
			<ScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ paddingBottom: 48 }}
			>
				<Stack spacing={20}>
					<Card
						variant="secondary"
						border="none"
						style={{
							backgroundColor: hexToRgba(settings.panelColor, 0.76),
							borderColor: hexToRgba(settings.accentColor, 0.52),
							borderWidth: 1,
						}}
					>
						<View style={{ padding: 16 }}>
							<Stack spacing={6}>
								<Text variant="heading-lg/semibold" color="text-strong">
									Liquid Glass • {settings.enabled ? 'Live' : 'Paused'}
								</Text>
								<Text variant="text-md/normal" color="text-muted">
									Custom backgrounds and translucent Discord surfaces, tuned for
									Android.
								</Text>
								<Text variant="text-sm/semibold" color="text-muted">
									Discord 347.1 live appearance engine
								</Text>
							</Stack>
						</View>
					</Card>

					<GlassPreview settings={previewSettings} />

					<TableRowGroup title="Glass engine">
						<TableSwitchRow
							label="Liquid Glass"
							subLabel="Pause the visual patches without losing your colors"
							value={settings.enabled}
							onValueChange={enabled => patch({ enabled })}
						/>
						<TableSwitchRow
							label="Full-app background"
							subLabel="Show your selected gradient or Midnight Waves wallpaper"
							value={settings.backgroundEnabled}
							onValueChange={backgroundEnabled =>
								save(applyCustomSettings(settings, { backgroundEnabled }))
							}
						/>
						<TableSwitchRow
							label="Transparent surfaces"
							subLabel="Master switch for transparent Discord surfaces"
							value={settings.semanticEnabled}
							onValueChange={semanticEnabled => patch({ semanticEnabled })}
						/>
						<TableSwitchRow
							label="Profile glass"
							subLabel="Your profile, member profiles, cards, roles, and statuses"
							value={settings.profileGlassEnabled}
							onValueChange={profileGlassEnabled =>
								patch({ profileGlassEnabled })
							}
						/>
						<TableSwitchRow
							label="Menus & overlays"
							subLabel="Sheets, modals, search, pickers, popups, and floating bars"
							value={settings.overlayGlassEnabled}
							onValueChange={overlayGlassEnabled =>
								patch({ overlayGlassEnabled })
							}
						/>
						<TableSwitchRow
							label="Controls & lists"
							subLabel="Buttons, inputs, tabs, selected rows, and interactive cards"
							value={settings.controlGlassEnabled}
							onValueChange={controlGlassEnabled =>
								patch({ controlGlassEnabled })
							}
						/>
						<TableSwitchRow
							label="Low-power mode"
							subLabel="Disables wallpaper blur and live slider previews; keeps your settings"
							value={settings.lowPowerMode}
							onValueChange={lowPowerMode => patch({ lowPowerMode })}
						/>
					</TableRowGroup>

					<Stack spacing={10}>
						<Text variant="heading-md/semibold">Background style</Text>
						<BackgroundPicker
							settings={settings}
							onSelect={backgroundMode =>
								save(
									applyCustomSettings(settings, {
										backgroundMode,
										backgroundEnabled: true,
									}),
								)
							}
						/>
						{settings.backgroundMode === 'midnight-waves' && (
							<Stack spacing={14}>
								<SliderField
									label="App wallpaper opacity"
									value={settings.wallpaperOpacity}
									minimumValue={0}
									maximumValue={1}
									step={0.01}
									format={value => `${Math.round(value * 100)}%`}
									onCommit={wallpaperOpacity =>
										commitCustom({ wallpaperOpacity })
									}
									onPreview={wallpaperOpacity =>
										previewCustom({ wallpaperOpacity })
									}
								/>
								<SliderField
									label="App wallpaper darkness"
									value={settings.wallpaperDim}
									minimumValue={0}
									maximumValue={1}
									step={0.01}
									format={value => `${Math.round(value * 100)}%`}
									onCommit={wallpaperDim => commitCustom({ wallpaperDim })}
									onPreview={wallpaperDim => previewCustom({ wallpaperDim })}
								/>
							</Stack>
						)}
						{(settings.backgroundMode === 'midnight-waves' ||
							settings.chatWallpaperEnabled) && (
							<Stack spacing={14}>
								<SliderField
									label="Color tint"
									value={settings.wallpaperTintOpacity}
									minimumValue={0}
									maximumValue={1}
									step={0.01}
									format={value => `${Math.round(value * 100)}%`}
									onCommit={wallpaperTintOpacity =>
										commitCustom({ wallpaperTintOpacity })
									}
									onPreview={wallpaperTintOpacity =>
										previewCustom({ wallpaperTintOpacity })
									}
								/>
								<SliderField
									label="Soft blur"
									value={settings.wallpaperBlur}
									minimumValue={0}
									maximumValue={12}
									step={1}
									format={value =>
										`${value}${settings.lowPowerMode ? ' · paused in low-power mode' : ''}`
									}
									onCommit={wallpaperBlur => commitCustom({ wallpaperBlur })}
								/>
								<Text variant="text-xs/normal" color="text-muted">
									Tint and blur apply to both app and chat wallpapers. Tint uses
									your Raised panel / input color. Blur applies when you release
									the slider.
								</Text>
							</Stack>
						)}
					</Stack>

					<Stack spacing={14}>
						<TableRowGroup title="Chat wallpaper">
							<TableSwitchRow
								label="Midnight Waves in chats"
								subLabel="Behind messages in DMs and server channels · only visible to you"
								value={settings.chatWallpaperEnabled}
								onValueChange={chatWallpaperEnabled =>
									customize({ chatWallpaperEnabled })
								}
							/>
						</TableRowGroup>
						{settings.chatWallpaperEnabled && (
							<Stack spacing={14}>
								<ChatPreview settings={previewSettings} />
								<SliderField
									label="Chat wallpaper opacity"
									value={settings.chatWallpaperOpacity}
									minimumValue={0}
									maximumValue={1}
									step={0.01}
									format={value => `${Math.round(value * 100)}%`}
									onCommit={chatWallpaperOpacity =>
										commitCustom({ chatWallpaperOpacity })
									}
									onPreview={chatWallpaperOpacity =>
										previewCustom({ chatWallpaperOpacity })
									}
								/>
								<SliderField
									label="Chat wallpaper darkness"
									value={settings.chatWallpaperDim}
									minimumValue={0}
									maximumValue={1}
									step={0.01}
									format={value => `${Math.round(value * 100)}%`}
									onCommit={chatWallpaperDim =>
										commitCustom({ chatWallpaperDim })
									}
									onPreview={chatWallpaperDim =>
										previewCustom({ chatWallpaperDim })
									}
								/>
								<Text variant="text-xs/normal" color="text-muted">
									Independent of the full-app background. Defaults: 95% opacity,
									30% darkness.
								</Text>
							</Stack>
						)}
					</Stack>

					<Stack spacing={10}>
						<Text variant="heading-md/semibold">Presets</Text>
						<PresetPicker
							settings={settings}
							onSelect={id =>
								save(
									applyPreset(settings, id),
									`${BUILT_IN_PRESETS[id].label} applied.`,
								)
							}
						/>
					</Stack>

					<Stack spacing={12}>
						<Text variant="heading-md/semibold">Custom colors</Text>
						{GRADIENT_STOPS.map((stop, index) => (
							<ColorField
								key={stop}
								label={`Gradient ${index + 1} · ${stop}`}
								value={settings.gradientColors[index]}
								onValidColor={next => {
									const gradientColors = [
										...settings.gradientColors,
									] as LiquidGlassSettings['gradientColors']
									gradientColors[index] = next
									customize({ gradientColors })
								}}
							/>
						))}
						<ColorField
							label="Glass panel"
							value={settings.panelColor}
							onValidColor={panelColor => customize({ panelColor })}
						/>
						<ColorField
							label="Raised panel / input"
							value={settings.tintColor}
							onValidColor={tintColor => customize({ tintColor })}
						/>
						<ColorField
							label="Accent glow"
							value={settings.accentColor}
							onValidColor={accentColor => customize({ accentColor })}
						/>
						<ColorField
							label="Main text"
							value={settings.textColor}
							onValidColor={textColor => customize({ textColor })}
						/>
						<ColorField
							label="Borders and highlights"
							value={settings.borderColor}
							onValidColor={borderColor => customize({ borderColor })}
						/>
					</Stack>

					<Stack spacing={14}>
						<Text variant="heading-md/semibold">Glass strength</Text>
						<SliderField
							label="Panel opacity"
							value={settings.panelOpacity}
							minimumValue={0.05}
							maximumValue={0.95}
							step={0.05}
							format={value => `${Math.round(value * 100)}%`}
							onCommit={panelOpacity => commitCustom({ panelOpacity })}
							onPreview={panelOpacity => previewCustom({ panelOpacity })}
						/>
						<SliderField
							label="Raised surface opacity"
							value={settings.raisedOpacity}
							minimumValue={0.1}
							maximumValue={0.98}
							step={0.05}
							format={value => `${Math.round(value * 100)}%`}
							onCommit={raisedOpacity => commitCustom({ raisedOpacity })}
							onPreview={raisedOpacity => previewCustom({ raisedOpacity })}
						/>
						<SliderField
							label="Profile opacity"
							value={settings.profileOpacity}
							minimumValue={0.05}
							maximumValue={0.95}
							step={0.05}
							format={value => `${Math.round(value * 100)}%`}
							onCommit={profileOpacity => commitCustom({ profileOpacity })}
							onPreview={profileOpacity => previewCustom({ profileOpacity })}
						/>
						<SliderField
							label="Menu & overlay opacity"
							value={settings.overlayOpacity}
							minimumValue={0.15}
							maximumValue={0.98}
							step={0.05}
							format={value => `${Math.round(value * 100)}%`}
							onCommit={overlayOpacity => commitCustom({ overlayOpacity })}
							onPreview={overlayOpacity => previewCustom({ overlayOpacity })}
						/>
						<SliderField
							label="Control & list opacity"
							value={settings.controlOpacity}
							minimumValue={0.1}
							maximumValue={0.98}
							step={0.05}
							format={value => `${Math.round(value * 100)}%`}
							onCommit={controlOpacity => commitCustom({ controlOpacity })}
							onPreview={controlOpacity => previewCustom({ controlOpacity })}
						/>
						<SliderField
							label={
								settings.backgroundMode === 'midnight-waves'
									? 'Fallback gradient softness'
									: 'Background softness'
							}
							value={settings.backgroundSoftness}
							minimumValue={0}
							maximumValue={1}
							step={0.05}
							format={value => `${Math.round(value * 100)}%`}
							onCommit={backgroundSoftness =>
								commitCustom({ backgroundSoftness })
							}
							onPreview={backgroundSoftness =>
								previewCustom({ backgroundSoftness })
							}
						/>
						<SliderField
							label={
								settings.backgroundMode === 'midnight-waves'
									? 'Fallback gradient angle'
									: 'Gradient angle'
							}
							value={settings.angle}
							minimumValue={0}
							maximumValue={360}
							step={15}
							format={value => `${Math.round(value)}°`}
							onCommit={angle => commitCustom({ angle })}
							onPreview={angle => previewCustom({ angle })}
						/>
					</Stack>

					<Stack spacing={10}>
						<Stack spacing={2}>
							<Text variant="heading-md/semibold">Saved profiles</Text>
							<Text variant="text-sm/normal" color="text-muted">
								Save up to {MAX_CUSTOM_PROFILES} looks and swap between them
								with one tap.
							</Text>
						</Stack>
						<TextInput
							label={renamingProfileId ? 'New profile name' : 'Profile name'}
							value={profileName}
							maxLength={32}
							placeholder="My glass look"
							onChange={setProfileName}
						/>
						<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
							{renamingProfileId ? (
								<>
									<Button
										size="sm"
										variant="primary"
										text="Save name"
										disabled={!profileName.trim()}
										onPress={renameProfile}
									/>
									<Button
										size="sm"
										variant="tertiary"
										text="Cancel"
										onPress={clearProfileEditor}
									/>
								</>
							) : (
								<Button
									size="sm"
									variant="primary"
									text="Save current"
									disabled={
										!profileName.trim() ||
										settings.customProfiles.length >= MAX_CUSTOM_PROFILES
									}
									onPress={() => saveProfile()}
								/>
							)}
						</View>
						{settings.customProfiles.map(profile => {
							const active = settings.activeProfileId === profile.id
							return (
								<Card
									key={profile.id}
									variant="secondary"
									border="none"
									style={{
										backgroundColor: hexToRgba(profile.panelColor, 0.72),
										borderWidth: active ? 2 : 1,
										borderColor: active
											? profile.accentColor
											: hexToRgba(profile.borderColor, 0.16),
									}}
								>
									<View style={{ padding: 12 }}>
										<Stack spacing={8}>
											<Text
												variant="text-md/semibold"
												style={{ color: profile.textColor }}
											>
												{active ? '✓ ' : ''}
												{profile.name}
											</Text>
											<View
												style={{
													flexDirection: 'row',
													flexWrap: 'wrap',
													gap: 6,
												}}
											>
												<Button
													size="sm"
													variant={active ? 'tertiary' : 'primary'}
													text={active ? 'Active' : 'Apply'}
													disabled={active}
													onPress={() =>
														save(
															applyCustomProfile(settings, profile.id),
															`${profile.name} applied.`,
														)
													}
												/>
												<Button
													size="sm"
													variant="tertiary"
													text="Update"
													onPress={() => saveProfile(profile.id)}
												/>
												<Button
													size="sm"
													variant="tertiary"
													text="Rename"
													onPress={() => {
														setRenamingProfileId(profile.id)
														setProfileName(profile.name)
													}}
												/>
												<Button
													size="sm"
													variant="destructive"
													text="Delete"
													onPress={() => deleteProfile(profile.id)}
												/>
											</View>
										</Stack>
									</View>
								</Card>
							)
						})}
					</Stack>

					<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
						<Button
							size="sm"
							variant="primary"
							text="Apply now"
							onPress={() => {
								previewRuntimeSettings(settings)
								toast('liquid-glass-applied', 'Liquid Glass refreshed.')
							}}
						/>
						<Button
							size="sm"
							variant="tertiary"
							text="Apply Midnight"
							onPress={() =>
								save(applyPreset(settings, 'midnight'), 'Midnight applied.')
							}
						/>
					</View>
					<Text variant="text-xs/normal" color="text-muted">
						Liquid Glass now reaches profiles, cards, menus, sheets, inputs,
						buttons, lists, voice panels, embeds, and navigation surfaces.
						Profile banners, avatars, media, and important warning colors stay
						crisp. The hosted Classic theme is installed separately. Midnight
						Waves loads from the plugin's website and uses the image cache. Your
						gradient stays visible while loading or if the image is unavailable.
					</Text>
				</Stack>
			</ScrollView>
		</Page>
	)
}
