import {
	DEFAULT_SETTINGS,
	formatSize,
	mediaKind,
	normalizeSettings,
} from './core'
import { runtime } from './runtime'
import type { PluginApi } from '@revenge-mod/plugins/types'
import type { Any, Prompt, Settings } from './core'

export function SettingsPage({
	api,
}: {
	api: PluginApi<{ jsonStorage: Settings }>
}) {
	const { ScrollView } = revenge.react.ReactNative
	const { Stack, Text, TableRowGroup, TableSwitchRow } =
		revenge.discord.design.Design
	const { Page } = api.unscoped.components
	const { useState, useSyncExternalStore } = revenge.react.React
	useSyncExternalStore(runtime.subscribe, runtime.snapshot, runtime.snapshot)
	const settings = normalizeSettings(api.jsonStorage.use() ?? DEFAULT_SETTINGS)
	const [error, setError] = useState('')
	const [saving, setSaving] = useState(false)
	async function save(patch: Partial<Settings>) {
		if (saving) return
		setSaving(true)
		try {
			await api.jsonStorage.set({ ...settings, ...patch }, true)
			setError('')
		} catch {
			setError('Could not save. Try again.')
		} finally {
			setSaving(false)
		}
	}
	return (
		<Page>
			<ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
				<Stack spacing={20}>
					<Text variant="heading-lg/semibold">Original Media</Text>
					<Text variant="text-md/normal">
						Send the original file, without reducing its resolution or
						re-encoding it.
					</Text>
					<TableRowGroup title="Upload defaults">
						<TableSwitchRow
							label="Original Media Mode"
							subLabel="Turn off to use Discord’s normal processing"
							value={settings.enabled}
							disabled={saving}
							onValueChange={enabled => {
								void save({ enabled })
							}}
						/>
						<TableSwitchRow
							label="Keep original images"
							subLabel="Preserve image quality, transparency, and animation"
							value={settings.originalImages}
							disabled={saving || !settings.enabled}
							onValueChange={originalImages => {
								void save({ originalImages })
							}}
						/>
						<TableSwitchRow
							label="Keep original videos"
							subLabel="Preserve resolution, frame rate, and audio"
							value={settings.originalVideos}
							disabled={saving || !settings.enabled}
							onValueChange={originalVideos => {
								void save({ originalVideos })
							}}
						/>
					</TableRowGroup>
					<Text variant="text-md/semibold">Choose for each attachment</Text>
					<Text variant="text-md/normal">
						Tap an attached photo or video before sending. Choose Original or
						Compress this upload. Defaults apply to files that have not started
						uploading.
					</Text>
					<Text variant="text-md/normal">
						If an original exceeds the current upload limit, choose Compress or
						Cancel. Compression uses Discord’s settings and may still be too
						large.
					</Text>
					<Text variant="text-sm/normal">
						Original files keep their embedded metadata. Some formats can be
						sent as files but may not play inline on every device.
					</Text>
					<Text variant="text-sm/normal">{runtime.status}</Text>
					{error ? <Text variant="text-md/normal">{error}</Text> : null}
				</Stack>
			</ScrollView>
		</Page>
	)
}

export function AttachmentChoice({ upload }: { upload: Any }) {
	const { useSyncExternalStore } = revenge.react.React
	useSyncExternalStore(runtime.subscribe, runtime.snapshot, runtime.snapshot)
	const { Stack, Text, Button } = revenge.discord.design.Design
	const controller = runtime.controller
	if (!controller || !runtime.settings.enabled || !mediaKind(upload))
		return null
	const editable = controller.editable(upload)
	return (
		<Stack spacing={8}>
			<Text variant="text-md/semibold">
				Upload quality ·{' '}
				{controller.mode(upload) === 'original'
					? 'Original'
					: 'Discord compression'}
			</Text>
			{editable ? (
				<Stack spacing={8}>
					<Button
						text="Original"
						variant={
							controller.mode(upload) === 'original' ? 'primary' : 'secondary'
						}
						onPress={() => {
							controller.choose(upload, 'original')
						}}
					/>
					<Button
						text="Compress this upload"
						variant={
							controller.mode(upload) === 'discord' ? 'primary' : 'secondary'
						}
						onPress={() => {
							controller.choose(upload, 'discord')
						}}
					/>
				</Stack>
			) : (
				<Text variant="text-sm/normal">
					Already preparing or uploaded. Remove and reattach to change quality.
				</Text>
			)}
		</Stack>
	)
}

/** Audited 347 shape: BottomSheet → BottomSheetScrollView → measured Stack. */
export function insertAttachmentChoice(React: Any, tree: any, choice: any) {
	const scroll = tree?.props?.children
	const stack = scroll?.props?.children
	const children = stack?.props?.children
	if (
		!React.isValidElement(tree) ||
		!React.isValidElement(scroll) ||
		!React.isValidElement(stack) ||
		!Array.isArray(children) ||
		children.length !== 4 ||
		typeof stack.props.onLayout !== 'function'
	)
		return tree
	return React.cloneElement(
		tree,
		{},
		React.cloneElement(
			scroll,
			{},
			React.cloneElement(stack, {}, [
				...children.slice(0, 3),
				choice,
				children[3],
			]),
		),
	)
}

let alertSequence = 0
export function askCompression(
	prompt: Prompt,
	signal: AbortSignal,
): Promise<'compress' | 'cancel'> {
	return new Promise(resolve => {
		if (signal.aborted) {
			resolve('cancel')
			return
		}
		const { AlertModal, AlertActionButton } = revenge.discord.design.Design
		const actions = revenge.discord.actions.AlertActionCreators
		const key = `original-media-${++alertSequence}`
		let settled = false
		const finish = (choice: 'compress' | 'cancel') => {
			if (settled) return
			settled = true
			signal.removeEventListener('abort', abort)
			try {
				actions.dismissAlert(key)
			} catch {
				/* The modal may already be gone. */
			}
			resolve(choice)
		}
		const abort = () => finish('cancel')
		signal.addEventListener('abort', abort, { once: true })
		const message =
			prompt.reason === 'oversize'
				? `${prompt.name} exceeds this conversation’s ${formatSize(prompt.limit!)} limit. Let Discord try compressing this file?`
				: `The original of ${prompt.name} could not be prepared. Let Discord process this file instead?`
		try {
			actions.openAlert(
				key,
				<AlertModal
					title={
						prompt.reason === 'oversize'
							? 'Original is too large'
							: 'Original unavailable'
					}
					content={message}
					actions={
						<>
							<AlertActionButton
								text="Compress this upload"
								onPress={() => finish('compress')}
							/>
							<AlertActionButton
								text="Cancel"
								variant="secondary"
								onPress={() => finish('cancel')}
							/>
						</>
					}
				/>,
				() => finish('cancel'),
			)
		} catch {
			finish('cancel')
		}
	})
}
