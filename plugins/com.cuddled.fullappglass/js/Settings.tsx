import { hexWithAlpha } from '../../com.cuddled.liquidglass/js/core'
import {
	ABSOLUTE_FILL,
	WALLPAPER_SOURCE,
} from '../../com.cuddled.liquidglass/js/wallpaper'
import { DEFAULT_SETTINGS, normalize, runtime, surfaceColor } from './core'
import { polishEnabled, polishStyles } from './polish'
import type { PluginApi } from '@revenge-mod/plugins/types'
import type { Settings } from './core'

const GROUPS = [
	[
		'mainScreens',
		'Main screens',
		'Chat lists, navigation and supported settings panels',
	],
	[
		'chats',
		'Conversations',
		'DM/server wallpaper, headers and message-box surroundings',
	],
	[
		'profiles',
		'Profiles',
		'Your profile and member profiles; media stays untouched',
	],
	[
		'menus',
		'Menus and overlays',
		'Sheets, popups and supported modal surfaces',
	],
	[
		'controls',
		'Inputs and cards',
		'Message boxes, list rows, buttons and tabs',
	],
] as const

function Preview({ settings }: { settings: Settings }) {
	const { View, Image } = revenge.react.ReactNative
	const { Text } = revenge.discord.design.Design
	const [ready, setReady] = revenge.react.React.useState(false)
	const surface = surfaceColor(settings)
	// The miniature preview works while the app-wide appearance is paused.
	const preview = { ...settings, enabled: true }
	const styles = polishStyles(preview)
	const channels = polishEnabled(preview, 'Channels')
	const composer = polishEnabled(preview, 'Composer')
	const menus = polishEnabled(preview, 'Menus')
	return (
		<View
			style={{
				minHeight: 340,
				borderRadius: 22,
				overflow: 'hidden',
				backgroundColor: '#0B0D17',
				borderWidth: 1,
				borderColor: '#FFFFFF30',
			}}
		>
			<Image
				source={WALLPAPER_SOURCE}
				resizeMode="cover"
				blurRadius={settings.lowPower ? 0 : settings.blur}
				onLoad={() => setReady(true)}
				onError={() => setReady(false)}
				style={[ABSOLUTE_FILL, { opacity: ready ? 1 : 0 }]}
			/>
			<View
				pointerEvents="none"
				style={[
					ABSOLUTE_FILL,
					{ backgroundColor: hexWithAlpha('#000000', settings.darkness) },
				]}
			/>
			<View
				style={{
					padding: 14,
					backgroundColor: settings.mainScreens ? surface : '#171B2B',
				}}
			>
				<Text variant="heading-md/semibold" style={{ color: '#F7F8FF' }}>
					Your look · Midnight Waves
				</Text>
			</View>
			<View style={{ padding: 14, gap: 12 }}>
				<View
					style={[
						{
							borderRadius: 14,
							padding: 12,
							backgroundColor: surface,
							borderWidth: 1,
							borderColor: '#FFFFFF35',
						},
						channels && {
							...styles.selected,
							borderColor: styles.channelOutline.borderColor,
						},
					]}
				>
					<Text variant="text-md/semibold" style={{ color: '#F7F8FF' }}>
						# general
					</Text>
				</View>
				<View
					style={{
						borderRadius: 24,
						padding: 14,
						backgroundColor: '#0B0D17',
						overflow: 'hidden',
					}}
				>
					{composer && <View pointerEvents="none" style={styles.composer} />}
					<Text variant="text-sm/normal" style={{ color: '#F7F8FF' }}>
						＋ Message #general ☺
					</Text>
				</View>
				<View
					style={[
						{
							padding: 14,
							gap: 12,
							borderRadius: 16,
							backgroundColor: surface,
						},
						menus && styles.sheet,
					]}
				>
					<View
						style={[
							{
								height: 4,
								width: 30,
								borderRadius: 4,
								alignSelf: 'center',
								backgroundColor: '#FFFFFF40',
							},
							menus && styles.handle,
						]}
					/>
					<Text variant="text-sm/normal" style={{ color: '#F7F8FF' }}>
						↩ Reply
					</Text>
					<Text variant="text-sm/normal" style={{ color: '#F7F8FF' }}>
						＋ Add reaction
					</Text>
				</View>
				<Text variant="text-xs/normal" style={{ color: '#F7F8FF' }}>
					{Math.round(settings.transparency * 100)}% transparent · illustrative
					preview
				</Text>
			</View>
		</View>
	)
}

const ACCENTS = [
	['Lavender', '#B8A1FF'],
	['Ice', '#9CCFFF'],
	['Rose', '#FFAFD4'],
	['Mint', '#9EE8CE'],
	['Gold', '#F3CF8C'],
	['Pearl', '#DCE3F5'],
] as const

function AccentPicker({
	value,
	onChange,
}: {
	value: Settings['accentColor']
	onChange(value: Settings['accentColor']): void
}) {
	const { useState, useEffect } = revenge.react.React
	const { View, Pressable, TextInput } = revenge.react.ReactNative
	const { Text, Button } = revenge.discord.design.Design
	const [input, setInput] = useState<string>(value)
	useEffect(() => setInput(value), [value])
	const valid = /^#[0-9a-f]{6}$/i.test(input.trim())
	return (
		<View style={{ gap: 12 }}>
			<Text variant="heading-md/semibold">Accent color</Text>
			<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
				{ACCENTS.map(([name, color]) => (
					<Pressable
						key={name}
						accessibilityRole="button"
						accessibilityLabel={`${name} accent`}
						accessibilityState={{ selected: value === color }}
						onPress={() => onChange(color)}
						style={{
							width: '30%',
							minHeight: 64,
							borderRadius: 14,
							padding: 10,
							gap: 6,
							alignItems: 'center',
							backgroundColor: '#121523',
							borderWidth: 2,
							borderColor: value === color ? color : '#FFFFFF25',
						}}
					>
						<View
							style={{
								width: 24,
								height: 24,
								borderRadius: 12,
								backgroundColor: color,
							}}
						/>
						<Text variant="text-xs/semibold" style={{ color: '#F7F8FF' }}>
							{name}
						</Text>
					</Pressable>
				))}
			</View>
			<TextInput
				accessibilityLabel="Custom accent hex color"
				value={input}
				onChangeText={setInput}
				autoCapitalize="characters"
				autoCorrect={false}
				maxLength={7}
				placeholder="#B8A1FF"
				placeholderTextColor="#A0A4BC"
				selectionColor={value}
				style={{
					minHeight: 48,
					borderWidth: 1,
					borderColor: value,
					borderRadius: 14,
					paddingHorizontal: 14,
					color: '#F7F8FF',
					backgroundColor: '#121523',
				}}
			/>
			{!valid && (
				<Text variant="text-xs/normal" color="text-muted">
					Use # followed by six hex digits, like #B8A1FF.
				</Text>
			)}
			<Button
				text="Apply custom accent"
				variant="secondary"
				disabled={!valid}
				onPress={() => {
					if (valid)
						onChange(input.trim().toUpperCase() as Settings['accentColor'])
				}}
			/>
		</View>
	)
}

function Slider({
	label,
	value,
	max = 1,
	onPreview,
	onCommit,
}: {
	label: string
	value: number
	max?: number
	onPreview(value: number): void
	onCommit(value: number): void
}) {
	const { Stack, Text, Slider: NativeSlider } = revenge.discord.design.Design
	return (
		<Stack spacing={5}>
			<Stack direction="horizontal" justify="space-between">
				<Text variant="text-md/semibold">{label}</Text>
				<Text variant="text-sm/normal">
					{max === 1
						? `${Math.round(value * 100)}%`
						: `${Math.round(value)} px`}
				</Text>
			</Stack>
			<NativeSlider
				value={value}
				minimumValue={0}
				maximumValue={max}
				step={max === 1 ? 0.01 : 1}
				onValueChange={onPreview}
				onSlidingComplete={onCommit}
			/>
		</Stack>
	)
}

export default function SettingsPage({
	api,
}: {
	api: PluginApi<{ jsonStorage: Settings }>
}) {
	const { useEffect, useRef, useState } = revenge.react.React
	const { Page } = api.unscoped.components
	const { ScrollView, View, Pressable } = revenge.react.ReactNative
	const { Text, Stack, TableRowGroup, TableSwitchRow, Button } =
		revenge.discord.design.Design
	const stored = normalize(api.jsonStorage.use() ?? DEFAULT_SETTINGS)
	const [draft, setDraft] = useState(stored)
	const [error, setError] = useState('')
	const current = useRef(stored)
	const saved = useRef(stored)
	const mounted = useRef(true)
	const sequence = useRef(0)
	const queue = useRef<Promise<unknown>>(Promise.resolve())
	useEffect(
		() => () => {
			mounted.current = false
		},
		[],
	)
	const commit = (changes: Partial<Settings>) => {
		const next = normalize({ ...current.current, ...changes })
		current.current = next
		setDraft(next)
		setError('')
		runtime.update(next)
		const revision = ++sequence.current
		queue.current = queue.current.then(async () => {
			try {
				await api.jsonStorage.set(next, true)
				saved.current = next
			} catch {
				if (sequence.current === revision) {
					current.current = saved.current
					runtime.update(saved.current)
					if (mounted.current) {
						setDraft(saved.current)
						setError(
							'Could not save that change. Your previous settings were restored.',
						)
					}
				}
			}
		})
	}
	return (
		<Page>
			<ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
				<Stack spacing={20}>
					<View
						style={{
							borderRadius: 20,
							padding: 18,
							backgroundColor: '#181D32',
							borderWidth: 1,
							borderColor: '#B29CFF70',
							gap: 8,
						}}
					>
						<Text variant="heading-lg/semibold" style={{ color: '#F7F8FF' }}>
							Full-App Glass · beta5
						</Text>
						<Text variant="text-sm/normal" style={{ color: '#E5DFFF' }}>
							Turn Liquid Glass and other appearance plugins OFF, then reload
							Discord before enabling this preview. They change the same colors.
							This plugin does not alter their settings.
						</Text>
						<Text variant="text-sm/semibold" style={{ color: '#BFFFD9' }}>
							{draft.enabled
								? 'Preview active on this device'
								: 'Paused · your settings are saved'}
						</Text>
					</View>
					<TableRowGroup>
						<TableSwitchRow
							label="Enable Full-App Glass"
							subLabel="Turn off to restore Discord's appearance immediately"
							value={draft.enabled}
							onValueChange={enabled => commit({ enabled })}
						/>
					</TableRowGroup>
					{error ? (
						<Text variant="text-sm/normal" color="text-danger">
							{error}
						</Text>
					) : null}
					<Preview settings={draft} />
					<TableRowGroup title="Your custom look">
						<TableSwitchRow
							label="Clean channel highlights"
							subLabel="Rounded selections with a subtle accent outline"
							value={draft.polishChannels}
							onValueChange={polishChannels => commit({ polishChannels })}
						/>
						<TableSwitchRow
							label="Polished message box"
							subLabel="A calmer dark pill with a fine accent edge"
							value={draft.polishComposer}
							onValueChange={polishComposer => commit({ polishComposer })}
						/>
						<TableSwitchRow
							label="Matching menus"
							subLabel="Dark action sheets, coordinated handles and clean rows"
							value={draft.polishMenus}
							onValueChange={polishMenus => commit({ polishMenus })}
						/>
					</TableRowGroup>
					<AccentPicker
						value={draft.accentColor}
						onChange={accentColor => commit({ accentColor })}
					/>
					<Slider
						label="Accent opacity"
						value={draft.accentOpacity}
						onPreview={accentOpacity =>
							setDraft({ ...current.current, accentOpacity })
						}
						onCommit={accentOpacity => commit({ accentOpacity })}
					/>
					<Text variant="text-xs/normal" color="text-muted">
						These details follow the area switches below. Matching menus use a
						solid glass-tinted backing to keep actions readable.
					</Text>
					<Slider
						label="Master transparency"
						value={draft.transparency}
						onPreview={transparency =>
							setDraft({ ...current.current, transparency })
						}
						onCommit={transparency => commit({ transparency })}
					/>
					<Text variant="text-xs/normal" color="text-muted">
						0% = solid panels · 100% = clear panels. Drag to preview above;
						release to apply across the app. Recommended starting point: 80%.
						Headers, bottom bars, and profiles have their own wallpaper
						backing—not the text underneath. Profile buttons keep a subtle color
						accent. Conversations temporarily use Discord's native dark colors;
						your saved appearance choice stays unchanged.
					</Text>
					<Slider
						label="Wallpaper darkness"
						value={draft.darkness}
						onPreview={darkness => setDraft({ ...current.current, darkness })}
						onCommit={darkness => commit({ darkness })}
					/>
					<Stack spacing={10}>
						<Text variant="heading-md/semibold">Glass tint</Text>
						<View style={{ flexDirection: 'row', gap: 12 }}>
							{[
								['Midnight', '#171B2B'],
								['Violet', '#291835'],
								['Ocean', '#102A35'],
								['Black', '#000000'],
							].map(([name, color]) => (
								<Pressable
									key={name}
									accessibilityRole="button"
									accessibilityLabel={`${name} tint`}
									accessibilityState={{ selected: draft.panelColor === color }}
									onPress={() => commit({ panelColor: color as `#${string}` })}
									style={{
										flex: 1,
										minHeight: 64,
										borderRadius: 16,
										borderWidth: 2,
										borderColor:
											draft.panelColor === color ? '#C5B5FF' : '#FFFFFF40',
										backgroundColor: color,
										justifyContent: 'center',
										alignItems: 'center',
									}}
								>
									<Text variant="text-xs/semibold" style={{ color: '#FFFFFF' }}>
										{name}
									</Text>
								</Pressable>
							))}
						</View>
					</Stack>
					<TableRowGroup title="Choose transparent areas">
						{GROUPS.map(([key, label, subLabel]) => (
							<TableSwitchRow
								key={key}
								label={label}
								subLabel={subLabel}
								value={draft[key]}
								onValueChange={value => commit({ [key]: value })}
							/>
						))}
					</TableRowGroup>
					<TableRowGroup title="Performance">
						<TableSwitchRow
							label="Low-power mode"
							subLabel="Keeps the wallpaper sharp; no image blur"
							value={draft.lowPower}
							onValueChange={lowPower => commit({ lowPower })}
						/>
					</TableRowGroup>
					{!draft.lowPower && (
						<Slider
							label="Wallpaper soft blur"
							value={draft.blur}
							max={10}
							onPreview={blur => setDraft({ ...current.current, blur })}
							onCommit={blur => commit({ blur })}
						/>
					)}
					<Text variant="text-sm/normal" color="text-muted">
						Local appearance only. This reveals the wallpaper inside Discord—not
						apps behind it. Media, avatars, videos, and some native screens can
						stay opaque. Blur softens the wallpaper; it is not live iOS-style
						blur.
					</Text>
					<Button
						text="Reset preview settings (paused)"
						variant="secondary"
						onPress={() => commit(DEFAULT_SETTINGS)}
					/>
				</Stack>
			</ScrollView>
		</Page>
	)
}
