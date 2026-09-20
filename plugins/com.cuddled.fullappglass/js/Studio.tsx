import { hexWithAlpha } from '../../com.cuddled.liquidglass/js/core'
import {
	ABSOLUTE_FILL,
	WALLPAPER_SOURCE,
} from '../../com.cuddled.liquidglass/js/wallpaper'
import { runtime } from './core'
import { saveSettings } from './settingsWriter'
import { getStudioData } from './studioData'
import { imageUri, interfaceFont, togglePin } from './studioModel'
import type { ReactNode } from 'react'
import type { HomeItem, StudioData } from './studioData'
import type { StudioSettings } from './studioModel'

const ink = '#F7F8FF'
const muted = '#B6BCD1'
const accents = [
	'#B8A1FF',
	'#9CCFFF',
	'#FFAFD4',
	'#9EE8CE',
	'#F3CF8C',
	'#DCE3F5',
]
const card = {
	backgroundColor: '#111522EB',
	borderColor: '#FFFFFF1C',
	borderWidth: 1,
	borderRadius: 22,
	padding: 18,
	gap: 12,
}

function Label({
	children,
	large = false,
	subtle = false,
}: {
	children: ReactNode
	large?: boolean
	subtle?: boolean
}) {
	const { Text } = revenge.react.ReactNative
	const settings = runtime.getSettings().studio
	return (
		<Text
			style={{
				color: subtle ? muted : ink,
				fontSize: large ? 22 : 15,
				fontWeight: large ? '700' : '400',
				lineHeight: large ? 29 : 23,
				fontFamily: interfaceFont(settings.font),
				letterSpacing: settings.letterSpacing,
			}}
		>
			{children}
		</Text>
	)
}
function Action({
	children,
	onPress,
	selected = false,
	disabled = false,
	compact = false,
}: {
	children: ReactNode
	onPress(): void
	selected?: boolean
	disabled?: boolean
	compact?: boolean
}) {
	const { Pressable, Text } = revenge.react.ReactNative
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected, disabled }}
			disabled={disabled}
			hitSlop={compact ? 8 : undefined}
			onPress={onPress}
			style={{
				minHeight: compact ? 28 : 44,
				justifyContent: 'center',
				paddingHorizontal: 14,
				paddingVertical: compact ? 2 : 10,
				borderRadius: 14,
				borderWidth: 1,
				borderColor: selected ? runtime.getSettings().accentColor : '#FFFFFF26',
				backgroundColor: selected ? '#B8A1FF22' : '#20263BE6',
				opacity: disabled ? 0.45 : 1,
			}}
		>
			<Text
				maxFontSizeMultiplier={compact ? 1.2 : undefined}
				style={{ color: ink, fontSize: 14, fontWeight: '600' }}
			>
				{children}
			</Text>
		</Pressable>
	)
}
function Avatar({ item }: { item: HomeItem }) {
	const { View, Image, Text } = revenge.react.ReactNative
	const [failed, setFailed] = revenge.react.React.useState(false)
	revenge.react.React.useEffect(() => setFailed(false), [item.image])
	return (
		<View
			style={{
				height: 46,
				width: 46,
				borderRadius: 16,
				overflow: 'hidden',
				backgroundColor: '#35304F',
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			{item.image && !failed ? (
				<Image
					source={{ uri: item.image }}
					style={{ width: 46, height: 46 }}
					onError={() => setFailed(true)}
				/>
			) : (
				<Text style={{ color: ink, fontSize: 19, fontWeight: '600' }}>
					{Array.from(item.name)[0]?.toUpperCase()}
				</Text>
			)}
		</View>
	)
}
function Tile({
	item,
	subtitle,
	onPress,
	disabled = false,
}: {
	item: HomeItem
	subtitle?: string
	onPress(): void
	disabled?: boolean
}) {
	const { View, Pressable } = revenge.react.ReactNative
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={item.name}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={{
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				paddingVertical: 8,
				minHeight: 64,
				opacity: disabled ? 0.5 : 1,
			}}
		>
			<Avatar item={item} />
			<View style={{ flex: 1 }}>
				<Label>{item.name}</Label>
				{subtitle ? <Label subtle>{subtitle}</Label> : null}
			</View>
			<Label subtle>›</Label>
		</Pressable>
	)
}
export function StudioLauncher({ compact = false }: { compact?: boolean }) {
	const React = revenge.react.React
	const native = revenge.react.ReactNative
	const data = getStudioData()
	React.useSyncExternalStore(
		data?.subscribe ?? runtime.subscribe,
		data?.getSnapshot ?? runtime.getSnapshot,
		data?.getSnapshot ?? runtime.getSnapshot,
	)
	const [open, setOpen] = React.useState(false)
	const settings = runtime.getSettings()
	React.useEffect(() => {
		if (!settings.enabled && compact) setOpen(false)
	}, [settings.enabled, compact])
	if (
		!native.Modal ||
		(compact &&
			(!settings.enabled ||
				!settings.mainScreens ||
				!settings.studio.dashboard))
	)
		return null
	return (
		<>
			<Action compact={compact} onPress={() => setOpen(true)}>
				{compact ? '⌂ Home' : 'Open Appearance Studio'}
			</Action>
			<native.Modal
				visible={open}
				animationType={settings.lowPower ? 'none' : 'slide'}
				onRequestClose={() => setOpen(false)}
				presentationStyle="fullScreen"
			>
				<StudioScreen
					data={data}
					onClose={() => setOpen(false)}
					initialTab={compact ? 'home' : 'style'}
				/>
			</native.Modal>
		</>
	)
}

function StudioScreen({
	data,
	onClose,
	initialTab,
}: {
	data?: StudioData
	onClose(): void
	initialTab: 'home' | 'style'
}) {
	const { useState, useEffect, useRef } = revenge.react.React
	const { View, ScrollView, Image, StatusBar } = revenge.react.ReactNative
	const [tab, setTab] = useState(initialTab)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const mounted = useRef(true)
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])
	const settings = runtime.getSettings()
	const studio = settings.studio
	const wallpaper =
		studio.homeWallpaper || studio.wallpaper || WALLPAPER_SOURCE.uri
	const run = async (job: () => Promise<unknown>) => {
		if (busy) return
		setBusy(true)
		setError('')
		try {
			await job()
		} catch (cause) {
			if (mounted.current)
				setError(
					cause instanceof Error
						? cause.message
						: 'That change could not be completed.',
				)
		} finally {
			if (mounted.current) setBusy(false)
		}
	}
	const change = (changes: Partial<StudioSettings>) =>
		run(() =>
			saveSettings(current => ({ studio: { ...current.studio, ...changes } })),
		)
	const open = (kind: 'guild' | 'channel' | 'friend', id: string) =>
		run(async () => {
			await data?.open(kind, id)
			if (data) onClose()
		})
	return (
		<View
			style={{
				flex: 1,
				backgroundColor: '#0B0D17',
				paddingTop: Math.max(24, StatusBar?.currentHeight ?? 24),
			}}
		>
			<Image
				key={wallpaper}
				source={{ uri: wallpaper }}
				style={ABSOLUTE_FILL}
				resizeMode="cover"
				blurRadius={settings.lowPower ? 0 : settings.blur}
				accessible={false}
			/>
			<View
				pointerEvents="none"
				style={[
					ABSOLUTE_FILL,
					{
						backgroundColor: hexWithAlpha(
							'#080A12',
							Math.max(0.62, settings.darkness),
						),
					},
				]}
			/>
			<View
				style={{
					padding: 16,
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 8,
				}}
			>
				<View style={{ flex: 1 }}>
					<Label large>
						{tab === 'home' ? 'Your space' : 'Appearance Studio'}
					</Label>
					<Label subtle>
						{tab === 'home'
							? 'A quieter place to start.'
							: 'Make Discord feel like yours.'}
					</Label>
				</View>
				<Action onPress={onClose}>Close</Action>
			</View>
			<View
				style={{
					flexDirection: 'row',
					gap: 8,
					paddingHorizontal: 16,
					paddingBottom: 12,
				}}
			>
				<Action selected={tab === 'home'} onPress={() => setTab('home')}>
					Home
				</Action>
				<Action selected={tab === 'style'} onPress={() => setTab('style')}>
					Customize
				</Action>
			</View>
			{error ? (
				<View
					accessibilityRole="alert"
					style={{
						marginHorizontal: 16,
						padding: 12,
						borderRadius: 12,
						backgroundColor: '#4A1D2D',
					}}
				>
					<Label>{error}</Label>
				</View>
			) : null}
			<ScrollView
				contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
				keyboardShouldPersistTaps="handled"
			>
				{tab === 'home' ? (
					<Home
						data={data}
						open={open}
						customize={() => setTab('style')}
						busy={busy}
					/>
				) : (
					<Customize data={data} change={change} run={run} busy={busy} />
				)}
			</ScrollView>
		</View>
	)
}

function Home({
	data,
	open,
	customize,
	busy,
}: {
	data?: StudioData
	open(kind: 'guild' | 'channel' | 'friend', id: string): void
	customize(): void
	busy: boolean
}) {
	const { View, Image, Linking } = revenge.react.ReactNative
	const studio = runtime.getSettings().studio
	const guilds = data?.guilds() ?? []
	const friends = data?.friends() ?? []
	const favorites = studio.favorites
		.map(id => guilds.find(g => g.id === id))
		.filter((g): g is HomeItem => !!g)
	const pins = studio.pinnedFriends
		.map(id => friends.find(f => f.id === id))
		.filter((f): f is HomeItem => !!f)
	const music = data?.music()
	const [linkError, setLinkError] = revenge.react.React.useState(false)
	return (
		<>
			<View
				style={[
					card,
					{ backgroundColor: '#27213AE8', borderColor: '#B8A1FF55' },
				]}
			>
				<Label large>
					{data?.self() ? `Welcome, ${data.self()!.name}` : 'Welcome home'}
				</Label>
				<Label subtle>Your favorite places and people, one tap away.</Label>
			</View>
			<View style={card}>
				<Label large>Favorite servers</Label>
				{favorites.length ? (
					favorites.map(item => (
						<Tile
							key={item.id}
							item={item}
							disabled={busy || !data?.canOpen('guild')}
							onPress={() => open('guild', item.id)}
						/>
					))
				) : (
					<>
						<Label subtle>Choose the servers you want to keep close.</Label>
						<Action onPress={customize}>Choose favorites</Action>
					</>
				)}
			</View>
			<View style={card}>
				<Label large>Pinned friends</Label>
				{pins.length ? (
					pins.map(item => (
						<Tile
							key={item.id}
							item={item}
							disabled={busy || !data?.canOpen('friend')}
							onPress={() => open('friend', item.id)}
						/>
					))
				) : (
					<>
						<Label subtle>Pin your people here.</Label>
						<Action onPress={customize}>Pin friends</Action>
					</>
				)}
			</View>
			<View style={card}>
				<Label large>Recent conversations</Label>
				{data?.chats().length ? (
					data
						.chats()
						.slice(0, 8)
						.map(item => (
							<Tile
								key={item.id}
								item={item}
								subtitle={item.subtitle}
								disabled={busy || !data.canOpen('channel')}
								onPress={() => open('channel', item.id)}
							/>
						))
				) : (
					<Label subtle>
						Your recent conversations will appear when Discord loads them.
					</Label>
				)}
			</View>
			{studio.music ? (
				<View style={card}>
					<Label large>On repeat</Label>
					{music ? (
						<>
							<View
								style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
							>
								{music.art ? (
									<Image
										source={{ uri: music.art }}
										style={{ width: 76, height: 76, borderRadius: 16 }}
									/>
								) : null}
								<View style={{ flex: 1 }}>
									<Label>{music.title}</Label>
									<Label subtle>{music.artist}</Label>
								</View>
							</View>
							{music.url ? (
								<Action
									onPress={() => {
										setLinkError(false)
										void Linking.openURL(music.url!).catch(() =>
											setLinkError(true),
										)
									}}
								>
									Open in Spotify ↗
								</Action>
							) : null}
							{linkError ? (
								<Label subtle>Spotify could not be opened.</Label>
							) : null}
						</>
					) : (
						<Label subtle>
							Your shared Spotify activity appears here while you listen.
						</Label>
					)}
				</View>
			) : null}
		</>
	)
}

function PictureField({
	title,
	value,
	onChange,
	onPick,
	data,
	busy,
	run,
}: {
	title: string
	value: string
	onChange(uri: string): void
	onPick(uri: string): Promise<unknown>
	data?: StudioData
	busy: boolean
	run(job: () => Promise<unknown>): void
}) {
	const { View, TextInput, Image } = revenge.react.ReactNative
	const { useState, useEffect } = revenge.react.React
	const [input, setInput] = useState(value)
	const [failed, setFailed] = useState(false)
	useEffect(() => {
		setInput(value)
		setFailed(false)
	}, [value])
	return (
		<View style={{ gap: 10 }}>
			<Label>{title}</Label>
			{value && !failed ? (
				<Image
					key={value}
					source={{ uri: value }}
					onError={() => setFailed(true)}
					resizeMode="cover"
					style={{ height: 110, width: '100%', borderRadius: 14 }}
				/>
			) : null}
			{failed ? (
				<Label subtle>
					That image could not load. Choose it again or use a different image.
				</Label>
			) : null}
			<TextInput
				accessibilityLabel={`${title} image URL`}
				value={input}
				onChangeText={setInput}
				autoCapitalize="none"
				autoCorrect={false}
				maxLength={2048}
				placeholder="https://… image URL"
				placeholderTextColor={muted}
				style={{
					minHeight: 48,
					borderWidth: 1,
					borderColor: '#FFFFFF35',
					borderRadius: 12,
					paddingHorizontal: 12,
					color: ink,
					backgroundColor: '#0B0D17',
				}}
			/>
			<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
				<Action
					disabled={busy || !imageUri(input)}
					onPress={() => onChange(imageUri(input))}
				>
					Use image
				</Action>
				<Action
					disabled={busy || !data?.canPick()}
					onPress={() =>
						run(async () => {
							const uri = await data?.pick()
							if (uri) await onPick(uri)
						})
					}
				>
					Choose photo
				</Action>
				<Action disabled={busy || !value} onPress={() => onChange('')}>
					Reset
				</Action>
			</View>
		</View>
	)
}

function Customize({
	data,
	change,
	run,
	busy,
}: {
	data?: StudioData
	change(changes: Partial<StudioSettings>): void
	run(job: () => Promise<unknown>): void
	busy: boolean
}) {
	const { View, Switch, TextInput } = revenge.react.ReactNative
	const { useState } = revenge.react.React
	const studio = runtime.getSettings().studio
	const [search, setSearch] = useState('')
	const [collection, setCollection] = useState<'guild' | 'friend' | 'channel'>(
		'guild',
	)
	const [sceneKey, setSceneKey] = useState('')
	const [sceneName, setSceneName] = useState('')
	const candidates =
		collection === 'guild'
			? (data?.guilds() ?? [])
			: collection === 'friend'
				? (data?.friends() ?? [])
				: (data?.chats() ?? [])
	const shown = candidates
		.filter(item =>
			item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
		)
		.slice(0, 30)
	const scene = studio.scenes[sceneKey] ?? { wallpaper: '', accent: '' }
	const updateScene = (changes: Partial<typeof scene>) =>
		change({
			scenes: { ...studio.scenes, [sceneKey]: { ...scene, ...changes } },
		})
	const picture = (
		title: string,
		value: string,
		save: (uri: string) => Partial<StudioSettings>,
	) => (
		<PictureField
			title={title}
			value={value}
			onChange={uri => change(save(uri))}
			onPick={uri =>
				saveSettings(current => ({
					studio: { ...current.studio, ...save(uri) },
				}))
			}
			data={data}
			busy={busy}
			run={run}
		/>
	)
	return (
		<>
			<View style={card}>
				<Label large>Wallpapers</Label>
				<Label subtle>
					Photos stay on this device. If a photo is moved or removed, choose it
					again.
				</Label>
				{picture('App wallpaper', studio.wallpaper, wallpaper => ({
					wallpaper,
				}))}
				{picture('Home wallpaper', studio.homeWallpaper, homeWallpaper => ({
					homeWallpaper,
				}))}
			</View>
			<View style={card}>
				<Label large>People & places</Label>
				<Label subtle>
					Pin favorites or give a server or conversation its own look.
				</Label>
				<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
					{(['guild', 'friend', 'channel'] as const).map(key => (
						<Action
							key={key}
							selected={collection === key}
							onPress={() => {
								setCollection(key)
								setSearch('')
							}}
						>
							{key === 'guild'
								? 'Servers'
								: key === 'friend'
									? 'Friends'
									: 'DMs'}
						</Action>
					))}
				</View>
				<TextInput
					accessibilityLabel="Find a server, friend or conversation"
					placeholder="Search names…"
					placeholderTextColor={muted}
					value={search}
					onChangeText={setSearch}
					style={{
						color: ink,
						padding: 12,
						borderRadius: 12,
						backgroundColor: '#0B0D17',
						minHeight: 48,
					}}
				/>
				{shown.length ? (
					shown.map(item => (
						<View
							key={item.id}
							style={{
								gap: 8,
								borderBottomWidth: 1,
								borderColor: '#FFFFFF18',
								paddingVertical: 8,
							}}
						>
							<View
								style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
							>
								<Avatar item={item} />
								<View style={{ flex: 1 }}>
									<Label>{item.name}</Label>
								</View>
							</View>
							<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
								{collection !== 'channel' ? (
									<Action
										disabled={busy}
										selected={(collection === 'guild'
											? studio.favorites
											: studio.pinnedFriends
										).includes(item.id)}
										onPress={() =>
											change(
												collection === 'guild'
													? { favorites: togglePin(studio.favorites, item.id) }
													: {
															pinnedFriends: togglePin(
																studio.pinnedFriends,
																item.id,
															),
														},
											)
										}
									>
										{(collection === 'guild'
											? studio.favorites
											: studio.pinnedFriends
										).includes(item.id)
											? 'Unpin'
											: 'Pin to Home'}
									</Action>
								) : null}
								{collection !== 'friend' ? (
									<Action
										onPress={() => {
											setSceneKey(`${collection}:${item.id}`)
											setSceneName(item.name)
										}}
									>
										Wallpaper & accent
									</Action>
								) : null}
							</View>
						</View>
					))
				) : (
					<Label subtle>
						No matches are loaded yet. Open your server or conversation in
						Discord, then return here.
					</Label>
				)}
				<Label subtle>
					Up to 24 favorites and 24 friends. Search to narrow large lists.
				</Label>
				<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
					<Action
						disabled={busy || !studio.favorites.length}
						onPress={() => change({ favorites: [] })}
					>
						Clear favorite servers
					</Action>
					<Action
						disabled={busy || !studio.pinnedFriends.length}
						onPress={() => change({ pinnedFriends: [] })}
					>
						Clear pinned friends
					</Action>
				</View>
			</View>
			{sceneKey ? (
				<View style={[card, { borderColor: '#B8A1FF66' }]}>
					<Label large>{sceneName}</Label>
					{picture('Selected wallpaper', scene.wallpaper, wallpaper => ({
						scenes: { ...studio.scenes, [sceneKey]: { ...scene, wallpaper } },
					}))}
					<Label>Accent</Label>
					<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
						{accents.map(accent => (
							<Swatch
								key={accent}
								color={accent}
								selected={scene.accent === accent}
								disabled={busy}
								onPress={() => updateScene({ accent })}
							/>
						))}
						<Action disabled={busy} onPress={() => updateScene({ accent: '' })}>
							Default accent
						</Action>
					</View>
					<Action
						disabled={busy}
						onPress={() => {
							const scenes = { ...studio.scenes }
							delete scenes[sceneKey]
							change({ scenes })
							setSceneKey('')
						}}
					>
						Remove override
					</Action>
					<Action onPress={() => setSceneKey('')}>Done</Action>
				</View>
			) : null}
			<View style={card}>
				<Label large>Typography</Label>
				<Label subtle>
					Interface labels use these fonts. Chat messages keep Discord’s native
					font.
				</Label>
				<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
					{(['discord', 'rounded', 'serif', 'mono'] as const).map(font => (
						<Action
							key={font}
							selected={studio.font === font}
							disabled={busy}
							onPress={() => change({ font })}
						>
							{
								{
									discord: 'Discord',
									rounded: 'Soft sans',
									serif: 'Editorial',
									mono: 'Mono',
								}[font]
							}
						</Action>
					))}
				</View>
				<Label>Letter spacing</Label>
				<View style={{ flexDirection: 'row', gap: 8 }}>
					{[0, 0.3, 0.6].map(letterSpacing => (
						<Action
							key={letterSpacing}
							selected={studio.letterSpacing === letterSpacing}
							disabled={busy}
							onPress={() => change({ letterSpacing })}
						>
							{letterSpacing === 0
								? 'Original'
								: letterSpacing === 0.3
									? 'Airy'
									: 'Wide'}
						</Action>
					))}
				</View>
				<Label>Discord text size</Label>
				<Label subtle>
					This changes Discord’s saved text-size setting, including messages. It
					stays at your chosen size when Glass is paused. 100% restores the
					default.
				</Label>
				<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
					{[0.875, 1, 1.125, 1.25, 1.5].map(scale => (
						<Action
							key={scale}
							disabled={busy || !data?.fontScale()}
							selected={data?.fontScale()?.fontScale === scale}
							onPress={() =>
								run(async () => {
									await data?.setFontScale(scale)
								})
							}
						>
							{scale * 100}%
						</Action>
					))}
				</View>
			</View>
			<View style={card}>
				<Label large>Finishing touches</Label>
				{(
					[
						[
							'dashboard',
							'Home shortcut',
							'Add Home beside the Messages heading.',
						],
						[
							'floatingRail',
							'Floating server rail',
							'A fine accent edge behind your server list.',
						],
						[
							'lineIcons',
							'Thin-line icons',
							'Matching navigation, chat, search and media icons.',
						],
						[
							'mediaCards',
							'Media cards',
							'Rounded galleries, embed thumbnails and calmer card colors.',
						],
						[
							'notifications',
							'Compact banners',
							'Restyle in-app alerts; keep sender and actions.',
						],
						[
							'reactions',
							'Accent reactions',
							'Coordinated reaction colors in conversations.',
						],
						['hideGift', 'Hide gift shortcut', 'Keep the message box focused.'],
						[
							'hideApps',
							'Hide app launcher',
							'Keep attachments, emoji and sending available.',
						],
						['music', 'Music on Home', 'Show your shared Spotify activity.'],
						[
							'emptyArt',
							'Custom empty screens',
							'A quiet orbital illustration or your own artwork.',
						],
					] as const
				).map(([key, title, description]) => (
					<View
						key={key}
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 10,
							paddingVertical: 8,
						}}
					>
						<View style={{ flex: 1 }}>
							<Label>{title}</Label>
							<Label subtle>{description}</Label>
						</View>
						<Switch
							accessibilityLabel={title}
							value={studio[key]}
							disabled={busy}
							onValueChange={value => change({ [key]: value })}
							trackColor={{ false: '#41465E', true: '#7960BE' }}
							thumbColor={ink}
						/>
					</View>
				))}
				{picture('Empty-screen artwork', studio.emptyImage, emptyImage => ({
					emptyImage,
				}))}
			</View>
		</>
	)
}
function Swatch({
	color,
	selected,
	disabled,
	onPress,
}: {
	color: string
	selected: boolean
	disabled: boolean
	onPress(): void
}) {
	const { Pressable, View } = revenge.react.ReactNative
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`Accent ${color}`}
			accessibilityState={{ selected, disabled }}
			disabled={disabled}
			onPress={onPress}
			style={{
				width: 48,
				height: 48,
				borderWidth: 2,
				borderRadius: 16,
				borderColor: selected ? ink : '#FFFFFF20',
				padding: 7,
			}}
		>
			<View style={{ flex: 1, borderRadius: 9, backgroundColor: color }} />
		</Pressable>
	)
}
