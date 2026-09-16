import {
	DEFAULT_SETTINGS,
	DISCORD_ID_PATTERN,
	normalizeSettings,
} from './defaults'
import { getNativeCapabilities } from './native'
import {
	getRuntimeStatus,
	subscribeRuntimeStatus,
	updateRuntimeStatus,
} from './runtime'
import type { PluginApi } from '@revenge-mod/plugins/types'
import type { RuntimeStatus, SelectiveMediaSaverSettings } from './types'

type SmsPluginApi = PluginApi<{ jsonStorage: SelectiveMediaSaverSettings }>

function toast(key: string, content: string): void {
	try {
		revenge.discord.actions.ToastActionCreators.open({ key, content })
	} catch {
		console.log(`[SelectiveMediaSaver] ${content}`)
	}
}

function saveSetting<K extends keyof SelectiveMediaSaverSettings>(
	api: SmsPluginApi,
	key: K,
	value: SelectiveMediaSaverSettings[K],
): void {
	void api.jsonStorage.set({ [key]: value } as any).catch(error => {
		toast('sms-settings-write-error', 'Could not save that setting.')
		console.error('[SelectiveMediaSaver] settings write failed:', error)
	})
}

function useRuntimeStatus(): RuntimeStatus {
	const { useEffect, useState } = revenge.react.React
	const [status, setStatus] = useState(getRuntimeStatus())

	useEffect(() => subscribeRuntimeStatus(next => setStatus({ ...next })), [])
	return status
}

function StatusCard() {
	const status = useRuntimeStatus()
	const { View } = revenge.react.ReactNative
	const { Button, Card, Stack, Text } = revenge.discord.design.Design
	const ready = status.listening && status.nativeReady
	const phase = ready
		? 'Listening for new messages'
		: status.listening
			? 'Message hook active; native saver unavailable'
			: status.phase === 'starting'
				? 'Starting…'
				: status.phase === 'error'
					? 'Needs attention'
					: 'Stopped'

	const refreshBridge = () => {
		void getNativeCapabilities()
			.then(capabilities => {
				const nativeReady =
					capabilities.ok &&
					capabilities.streamDownload &&
					capabilities.mediaStore
				updateRuntimeStatus({
					capabilities,
					nativeReady,
					lastError: nativeReady
						? undefined
						: 'Native bridge loaded without streaming MediaStore support.',
				})
				toast(
					'sms-native-check',
					nativeReady
						? 'Native saver is ready.'
						: 'Native saver is missing required capabilities.',
				)
			})
			.catch(error => {
				const message = error instanceof Error ? error.message : String(error)
				updateRuntimeStatus({ nativeReady: false, lastError: message })
				toast('sms-native-check-error', 'Native saver could not be reached.')
			})
	}

	return (
		<Card
			variant="secondary"
			border="none"
			style={{
				backgroundColor: ready ? '#23a55a1f' : '#da373c1f',
				borderColor: ready ? '#23a55a66' : '#da373c66',
				borderWidth: 1,
			}}
		>
			<View style={{ padding: 16 }}>
				<Stack spacing={12}>
					<Stack direction="horizontal" justify="space-between" align="center">
						<Stack spacing={2}>
							<Text variant="heading-md/semibold" color="text-strong">
								{ready ? '● Ready' : '● Needs attention'}
							</Text>
							<Text variant="text-sm/normal" color="text-muted">
								{phase}
							</Text>
						</Stack>
						<Button
							size="sm"
							variant="tertiary"
							text="Check bridge"
							onPress={refreshBridge}
						/>
					</Stack>
					<Stack direction="horizontal" spacing={16}>
						<Text variant="text-sm/semibold">
							Saved: {status.savedThisSession}
						</Text>
						<Text variant="text-sm/semibold">
							Failed: {status.failedThisSession}
						</Text>
						<Text variant="text-sm/semibold">
							Queued: {status.queuedMessages}
						</Text>
					</Stack>
					{status.lastSavedName ? (
						<Text variant="text-sm/normal" color="text-muted" lineClamp={2}>
							Last saved: {status.lastSavedName}
						</Text>
					) : null}
					{status.lastError ? (
						<Text variant="text-sm/normal" color="text-feedback-critical">
							{status.lastError}
						</Text>
					) : null}
				</Stack>
			</View>
		</Card>
	)
}

function IdListEditor({
	title,
	description,
	placeholder,
	values,
	onChange,
}: {
	title: string
	description: string
	placeholder: string
	values: string[]
	onChange: (values: string[]) => void
}) {
	const { useState } = revenge.react.React
	const { View } = revenge.react.ReactNative
	const { Button, Stack, TableRow, TableRowGroup, Text, TextInput } =
		revenge.discord.design.Design
	const [value, setValue] = useState('')
	const [error, setError] = useState<string | undefined>()

	const add = () => {
		const id = value.trim()
		if (!DISCORD_ID_PATTERN.test(id)) {
			setError('Enter a Discord ID containing 15–22 digits.')
			return
		}
		if (values.includes(id)) {
			setError('That ID is already in this list.')
			return
		}
		onChange([...values, id])
		setValue('')
		setError(undefined)
	}

	return (
		<Stack spacing={10}>
			<Stack spacing={2}>
				<Text variant="heading-sm/semibold" color="text-strong">
					{title}
				</Text>
				<Text variant="text-sm/normal" color="text-muted">
					{description}
				</Text>
			</Stack>
			<Stack direction="horizontal" spacing={8} align="center">
				<View style={{ flex: 1 }}>
					<TextInput
						value={value}
						placeholder={placeholder}
						isClearable
						onChange={next => {
							setValue(next.replace(/\D/g, '').slice(0, 22))
							setError(undefined)
						}}
						returnKeyType="done"
					/>
				</View>
				<Button
					size="sm"
					variant="primary"
					text="Add"
					disabled={!value.trim()}
					onPress={add}
				/>
			</Stack>
			{error ? (
				<Text variant="text-sm/normal" color="text-feedback-critical">
					{error}
				</Text>
			) : null}
			{values.length ? (
				<TableRowGroup>
					{values.map(id => (
						<TableRow
							key={id}
							label={id}
							subLabel="Saved locally"
							trailing={
								<Button
									size="sm"
									variant="destructive"
									text="Remove"
									onPress={() => onChange(values.filter(value => value !== id))}
								/>
							}
						/>
					))}
				</TableRowGroup>
			) : (
				<Text variant="text-sm/normal" color="text-muted">
					No IDs added yet.
				</Text>
			)}
		</Stack>
	)
}

function DestinationEditor({
	api,
	settings,
}: {
	api: SmsPluginApi
	settings: SelectiveMediaSaverSettings
}) {
	const { useEffect, useState } = revenge.react.React
	const { View } = revenge.react.ReactNative
	const { Button, Stack, Text, TextInput } = revenge.discord.design.Design
	const [album, setAlbum] = useState(settings.albumName)
	const [maxMiB, setMaxMiB] = useState(String(settings.maxDownloadMiB))

	useEffect(() => setAlbum(settings.albumName), [settings.albumName])
	useEffect(
		() => setMaxMiB(String(settings.maxDownloadMiB)),
		[settings.maxDownloadMiB],
	)

	const save = () => {
		const normalizedAlbum =
			album.trim().slice(0, 64) || DEFAULT_SETTINGS.albumName
		const normalizedMax = Math.min(
			512,
			Math.max(1, Math.round(Number(maxMiB) || 100)),
		)
		void api.jsonStorage
			.set({ albumName: normalizedAlbum, maxDownloadMiB: normalizedMax })
			.then(() => toast('sms-destination-saved', 'Save destination updated.'))
			.catch(error => {
				console.error('[SelectiveMediaSaver] destination write failed:', error)
				toast('sms-destination-error', 'Could not update the save destination.')
			})
	}

	return (
		<Stack spacing={10}>
			<Text variant="heading-sm/semibold" color="text-strong">
				Save destination
			</Text>
			<Text variant="text-sm/normal" color="text-muted">
				Files are streamed by Android into MediaStore, so they appear in your
				gallery/files apps.
			</Text>
			<TextInput
				label="Album/folder name"
				value={album}
				maxLength={64}
				onChange={setAlbum}
			/>
			<Stack direction="horizontal" spacing={8} align="center">
				<View style={{ flex: 1 }}>
					<TextInput
						label="Maximum size per file (MiB)"
						value={maxMiB}
						onChange={value => setMaxMiB(value.replace(/\D/g, '').slice(0, 3))}
					/>
				</View>
				<Button size="sm" variant="primary" text="Save" onPress={save} />
			</Stack>
		</Stack>
	)
}

function ProfileMediaSettings({
	api,
	settings,
}: {
	api: SmsPluginApi
	settings: SelectiveMediaSaverSettings
}) {
	const { View } = revenge.react.ReactNative
	const { Button, Card, Stack, TableRowGroup, TableSwitchRow, Text } =
		revenge.discord.design.Design
	const recentHistory = [
		...settings.avatarHistory.map(entry => ({ ...entry, kind: 'Avatar' })),
		...settings.bannerHistory.map(entry => ({ ...entry, kind: 'Banner' })),
	]
		.sort((left, right) => right.savedAt - left.savedAt)
		.slice(0, 4)

	const clearHistory = (kind: 'avatar' | 'banner') => {
		const key = kind === 'avatar' ? 'avatarHistory' : 'bannerHistory'
		void api.jsonStorage
			.set({ [key]: [] } as any)
			.then(() =>
				toast(`sms-${kind}-history-cleared`, `${kind} history cleared.`),
			)
			.catch(error => {
				console.error(
					`[SelectiveMediaSaver] ${kind} history clear failed:`,
					error,
				)
				toast(
					`sms-${kind}-history-clear-error`,
					`Could not clear ${kind} history.`,
				)
			})
	}

	return (
		<Card
			variant="secondary"
			border="none"
			style={{
				backgroundColor: '#eb459e14',
				borderColor: '#eb459e55',
				borderWidth: 1,
			}}
		>
			<View style={{ padding: 16 }}>
				<Stack spacing={12}>
					<Stack spacing={3}>
						<Text variant="heading-md/semibold" color="text-strong">
							Profile media
						</Text>
						<Text variant="text-sm/normal" color="text-muted">
							Save avatar and banner changes only for IDs in Allowed users.
						</Text>
					</Stack>
					<TableRowGroup>
						<TableSwitchRow
							label="Save allowlisted avatars"
							subLabel="Checks qualifying messages and Discord user updates"
							value={settings.saveAvatarsForAllowlistedUsers}
							onValueChange={value =>
								saveSetting(api, 'saveAvatarsForAllowlistedUsers', value)
							}
						/>
						<TableSwitchRow
							label="Remember avatar versions"
							subLabel="Avoid saving the same avatar again after restarting"
							value={settings.trackAvatarChanges}
							onValueChange={value =>
								saveSetting(api, 'trackAvatarChanges', value)
							}
						/>
						<TableSwitchRow
							label="Save allowlisted banners"
							subLabel="Checks profile updates Discord emits while open"
							value={settings.saveBannersForAllowlistedUsers}
							onValueChange={value =>
								saveSetting(api, 'saveBannersForAllowlistedUsers', value)
							}
						/>
						<TableSwitchRow
							label="Remember banner versions"
							subLabel="Avoid saving the same banner again after restarting"
							value={settings.trackBannerChanges}
							onValueChange={value =>
								saveSetting(api, 'trackBannerChanges', value)
							}
						/>
					</TableRowGroup>
					<Text variant="text-sm/semibold" color="text-muted">
						Remembered: {settings.avatarHistory.length} avatar versions •{' '}
						{settings.bannerHistory.length} banner versions
					</Text>
					{recentHistory.length ? (
						<Stack spacing={4}>
							<Text variant="text-sm/semibold" color="text-strong">
								Recent versions
							</Text>
							{recentHistory.map(entry => (
								<Text
									key={`${entry.kind}:${entry.userId}:${entry.assetHash}`}
									variant="text-xs/normal"
									color="text-muted"
									lineClamp={1}
								>
									{entry.kind} • {entry.displayName ?? entry.userId} •{' '}
									{entry.savedAt
										? new Date(entry.savedAt).toLocaleString()
										: 'Imported'}
								</Text>
							))}
						</Stack>
					) : null}
					<Stack direction="horizontal" spacing={8}>
						<Button
							size="sm"
							variant="tertiary"
							text="Clear avatar history"
							disabled={!settings.avatarHistory.length}
							onPress={() => clearHistory('avatar')}
						/>
						<Button
							size="sm"
							variant="tertiary"
							text="Clear banner history"
							disabled={!settings.bannerHistory.length}
							onPress={() => clearHistory('banner')}
						/>
					</Stack>
					<Text variant="text-xs/normal" color="text-muted">
						Foreground events only. Banner capture has no background polling and
						will run when Discord loads or updates an allowlisted profile.
					</Text>
				</Stack>
			</View>
		</Card>
	)
}

export default function Settings({ api }: { api: SmsPluginApi }) {
	const { Page } = api.unscoped.components
	const { ScrollView, View } = revenge.react.ReactNative
	const { Card, Stack, TableRowGroup, TableSwitchRow, Text } =
		revenge.discord.design.Design
	const settings = normalizeSettings(api.jsonStorage.use() ?? DEFAULT_SETTINGS)

	return (
		<Page>
			<ScrollView
				contentContainerStyle={{ paddingBottom: 40 }}
				keyboardShouldPersistTaps="handled"
			>
				<Stack spacing={20}>
					<Card
						variant="secondary"
						border="none"
						style={{
							backgroundColor: '#5865f21f',
							borderColor: '#5865f266',
							borderWidth: 1,
						}}
					>
						<View style={{ padding: 16 }}>
							<Stack spacing={6}>
								<Text variant="heading-lg/semibold" color="text-strong">
									Selective Media Saver
								</Text>
								<Text variant="text-md/normal" color="text-muted">
									Automatically save new images and videos from the people and
									places you choose.
								</Text>
								<Text variant="text-sm/semibold" color="text-muted">
									Mobile preview • settings schema v{settings.schemaVersion}
								</Text>
							</Stack>
						</View>
					</Card>

					<StatusCard />

					<TableRowGroup title="Capture">
						<TableSwitchRow
							label="Media saving"
							subLabel="Master switch; your lists and preferences stay saved"
							value={settings.enabled}
							onValueChange={value => saveSetting(api, 'enabled', value)}
						/>
						<TableSwitchRow
							label="Images"
							subLabel="Attachments, image embeds, GIFs and supported thumbnails"
							value={settings.saveImages}
							onValueChange={value => saveSetting(api, 'saveImages', value)}
						/>
						<TableSwitchRow
							label="Videos"
							subLabel="Video attachments and direct video embeds"
							value={settings.saveVideos}
							onValueChange={value => saveSetting(api, 'saveVideos', value)}
						/>
						<TableSwitchRow
							label="Embed thumbnails"
							subLabel="Save thumbnails when Discord includes them as real image URLs"
							value={settings.includeEmbedThumbnails}
							onValueChange={value =>
								saveSetting(api, 'includeEmbedThumbnails', value)
							}
						/>
					</TableRowGroup>

					<TableRowGroup title="Privacy and noise">
						<TableSwitchRow
							label="Only save allowlisted media"
							subLabel="Recommended; with empty lists, nothing is saved"
							value={settings.onlySaveAllowlisted}
							onValueChange={value =>
								saveSetting(api, 'onlySaveAllowlisted', value)
							}
						/>
						<TableSwitchRow
							label="Match any list"
							subLabel="Off means every non-empty list must match"
							value={settings.matchAnyAllowlist}
							onValueChange={value =>
								saveSetting(api, 'matchAnyAllowlist', value)
							}
						/>
						<TableSwitchRow
							label="Ignore bots"
							value={settings.ignoreBots}
							onValueChange={value => saveSetting(api, 'ignoreBots', value)}
						/>
						<TableSwitchRow
							label="Ignore my messages"
							value={settings.ignoreSelf}
							onValueChange={value => saveSetting(api, 'ignoreSelf', value)}
						/>
					</TableRowGroup>

					<IdListEditor
						title="Allowed users"
						description="Save qualifying media posted by these user IDs."
						placeholder="User ID"
						values={settings.allowedUserIds}
						onChange={values => saveSetting(api, 'allowedUserIds', values)}
					/>
					<IdListEditor
						title="Allowed servers"
						description="Save qualifying media posted anywhere in these servers."
						placeholder="Server ID"
						values={settings.allowedGuildIds}
						onChange={values => saveSetting(api, 'allowedGuildIds', values)}
					/>
					<IdListEditor
						title="Allowed channels"
						description="Save qualifying media posted in these server channels or DMs."
						placeholder="Channel ID"
						values={settings.allowedChannelIds}
						onChange={values => saveSetting(api, 'allowedChannelIds', values)}
					/>

					<ProfileMediaSettings api={api} settings={settings} />

					<TableRowGroup title="Notifications and folders">
						<TableSwitchRow
							label="Saved-media toasts"
							subLabel="One summary toast per message, not one per file"
							value={settings.showSaveToasts}
							onValueChange={value => saveSetting(api, 'showSaveToasts', value)}
						/>
						<TableSwitchRow
							label="Error toasts"
							value={settings.showErrorToasts}
							onValueChange={value =>
								saveSetting(api, 'showErrorToasts', value)
							}
						/>
						<TableSwitchRow
							label="Separate Images and Videos"
							value={settings.separateFoldersByType}
							onValueChange={value =>
								saveSetting(api, 'separateFoldersByType', value)
							}
						/>
					</TableRowGroup>
					<DestinationEditor api={api} settings={settings} />

					<Text variant="text-sm/normal" color="text-muted">
						Only foreground events received while Discord is running can be
						saved. This preview does not scan message or profile history.
					</Text>
				</Stack>
			</ScrollView>
		</Page>
	)
}
