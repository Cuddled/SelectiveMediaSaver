import { repairGlass } from './core'
import type { PluginApi } from '@revenge-mod/plugins/types'

let installing = false

function Settings({ api }: { api: PluginApi }) {
	const { useEffect, useRef, useState } = revenge.react.React
	const { ScrollView } = revenge.react.ReactNative
	const { Page } = api.unscoped.components
	const { Stack, Text, Button } = revenge.discord.design.Design
	const [status, setStatus] = useState(
		'Ready to upgrade beta14 or older to beta15.',
	)
	const [busy, setBusy] = useState(false)
	const [done, setDone] = useState(false)
	const mounted = useRef(true)
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])
	async function update() {
		if (installing) return
		installing = true
		setBusy(true)
		try {
			await repairGlass(
				(name, args) =>
					revenge.modules.native.callNativeMethod(name as never, args as never),
				message => {
					if (mounted.current) setStatus(message)
				},
				() => mounted.current,
			)
			if (mounted.current) setDone(true)
		} catch (error) {
			if (mounted.current)
				setStatus(error instanceof Error ? error.message : String(error))
		} finally {
			installing = false
			if (mounted.current) setBusy(false)
		}
	}
	return (
		<Page>
			<ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
				<Stack spacing={20}>
					<Text variant="heading-lg/semibold">Get Glass updates working</Text>
					<Text variant="text-md/normal">
						This replaces the older Glass plugin with beta15 and links it to
						Cuddled’s repository. Your wallpaper, theme, and saved settings stay
						in place.
					</Text>
					<Text variant="text-sm/normal">
						Keep this page open while installing. Restart Discord when it
						finishes.
					</Text>
					<Button
						text={
							busy
								? 'Updating…'
								: done
									? 'Restart Discord to finish'
									: 'Link and update Glass'
						}
						variant="primary"
						disabled={busy || done}
						onPress={() => {
							void update()
						}}
					/>
					<Text variant="text-md/normal">{status}</Text>
					<Text variant="text-sm/normal">
						Keep Full-App Glass installed. Once beta15 is running and its
						Repository shows Cuddled’s repository, remove only “Full-App Glass
						Update Helper.”
					</Text>
				</Stack>
			</ScrollView>
		</Page>
	)
}

export default plugin({ SettingsComponent: Settings })
