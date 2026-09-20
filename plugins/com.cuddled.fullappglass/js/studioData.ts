import { runtime } from './core'
import { pickedImage, resolveScene, validId } from './studioModel'
import type { Settings } from './core'

type RecordAny = Record<string, any>
export interface HomeItem {
	id: string
	name: string
	image?: string
	subtitle?: string
}
const avatar = (id: string, hash: unknown, kind: 'avatars' | 'icons') =>
	validId(id) && typeof hash === 'string' && /^(a_)?[0-9a-f]{32}$/i.test(hash)
		? `https://cdn.discordapp.com/${kind}/${id}/${hash}.png?size=128`
		: undefined
const userItem = (user: RecordAny): HomeItem => ({
	id: user.id,
	name: String(
		user.globalName || user.global_name || user.username || 'Friend',
	),
	image: avatar(user.id, user.avatar, 'avatars'),
})

export function createStudioData() {
	let revision = 0
	let alive = true
	const stores: Record<string, RecordAny> = {}
	const listeners = new Set<() => void>()
	const appearanceListeners = new Set<() => void>()
	let appearanceKey = runtime.getSnapshot()
	const cleanup: Array<() => void> = []
	const notify = () => {
		if (alive) {
			revision++
			for (const listener of listeners) listener()
			const key = `${runtime.getSnapshot()}:${JSON.stringify(api.scene())}`
			if (key !== appearanceKey) {
				appearanceKey = key
				for (const listener of appearanceListeners) listener()
			}
		}
	}
	const call = (key: string, method: string, ...args: any[]): any => {
		try {
			return stores[key]?.[method]?.(...args)
		} catch {
			return undefined
		}
	}
	const api = {
		subscribeAppearance(listener: () => void) {
			appearanceListeners.add(listener)
			return () => {
				appearanceListeners.delete(listener)
			}
		},
		getAppearanceSnapshot: () => appearanceKey,
		subscribe(listener: () => void) {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		getSnapshot: () => `${revision}:${runtime.getSnapshot()}`,
		attach(key: string, value: RecordAny | undefined) {
			if (!alive || !value || stores[key] === value) return
			stores[key] = value
			if (
				typeof value.addChangeListener === 'function' &&
				typeof value.removeChangeListener === 'function'
			) {
				value.addChangeListener(notify)
				cleanup.push(() => value.removeChangeListener(notify))
			}
			notify()
		},
		start() {
			cleanup.push(runtime.subscribe(notify))
			notify()
		},
		scene(channelId?: string) {
			let id = channelId ?? call('selectedChannel', 'getChannelId')
			const channel = call('channels', 'getChannel', id)
			// Explicit chat IDs must never inherit the selected, unrelated server.
			const selectedGuild = channelId
				? undefined
				: call('selectedGuild', 'getGuildId')
			const guildId = selectedGuild ?? channel?.guild_id
			if (!channelId && selectedGuild && channel?.guild_id !== selectedGuild)
				id = undefined
			return resolveScene(runtime.getSettings(), id, guildId)
		},
		effectiveSettings(): Settings {
			const settings = runtime.getSettings()
			return {
				...settings,
				accentColor: api.scene().accent as Settings['accentColor'],
			}
		},
		guilds(): HomeItem[] {
			const guilds = call('guilds', 'getGuilds')
			return guilds && typeof guilds === 'object'
				? Object.values(guilds)
						.filter((g: any) => validId(g?.id))
						.map((g: any) => ({
							id: g.id,
							name: String(g.name || 'Server'),
							image: avatar(g.id, g.icon, 'icons'),
						}))
						.sort((a, b) => a.name.localeCompare(b.name))
				: []
		},
		friends(): HomeItem[] {
			const ids = call('relationships', 'getFriendIDs')
			return Array.isArray(ids)
				? ids
						.map(id => call('users', 'getUser', id))
						.filter(user => validId(user?.id))
						.map(userItem)
						.sort((a, b) => a.name.localeCompare(b.name))
				: []
		},
		chats(): HomeItem[] {
			const channels = call('channels', 'getSortedPrivateChannels')
			return Array.isArray(channels)
				? channels
						.filter(c => validId(c?.id) && !c.guild_id)
						.map(channel => {
							const recipients = Array.isArray(channel.recipients)
								? channel.recipients
								: []
							const users = recipients
								.map((id: string) => call('users', 'getUser', id))
								.filter(Boolean)
							return {
								id: channel.id,
								name: String(
									channel.name ||
										users.map((u: any) => userItem(u).name).join(', ') ||
										'Conversation',
								),
								image:
									users.length === 1 ? userItem(users[0]).image : undefined,
								subtitle:
									recipients.length > 1
										? 'Group conversation'
										: 'Direct message',
							}
						})
				: []
		},
		self(): HomeItem | undefined {
			const user = call('users', 'getCurrentUser')
			return validId(user?.id) ? userItem(user) : undefined
		},
		music() {
			const user = api.self()
			const activities =
				call('selfPresence', 'getActivities') ??
				(user ? call('presence', 'getActivities', user.id) : [])
			const track = Array.isArray(activities)
				? activities.find(
						a =>
							a?.type === 2 &&
							a.name === 'Spotify' &&
							typeof a.details === 'string',
					)
				: undefined
			if (!track) return undefined
			const hash = track.assets?.large_image
			return {
				title: track.details,
				artist: typeof track.state === 'string' ? track.state : '',
				art:
					typeof hash === 'string' && /^spotify:[0-9a-f]{40}$/i.test(hash)
						? `https://i.scdn.co/image/${hash.slice(8)}`
						: undefined,
				url:
					typeof track.sync_id === 'string' &&
					/^[0-9a-z]{22}$/i.test(track.sync_id)
						? `https://open.spotify.com/track/${track.sync_id}`
						: undefined,
			}
		},
		canOpen(kind: 'guild' | 'channel' | 'friend') {
			return (
				typeof stores[kind === 'friend' ? 'openDM' : kind]?.[
					kind === 'guild'
						? 'transitionToGuild'
						: kind === 'channel'
							? 'transitionToChannel'
							: 'openPrivateChannel'
				] === 'function'
			)
		},
		async open(kind: 'guild' | 'channel' | 'friend', id: string) {
			if (!alive || !validId(id) || !api.canOpen(kind))
				throw new Error(
					'This shortcut is not available yet. Open the conversation in Discord first.',
				)
			if (kind === 'guild') await stores.guild.transitionToGuild(id)
			else if (kind === 'channel') await stores.channel.transitionToChannel(id)
			else
				await stores.openDM.openPrivateChannel({
					recipientIds: [id],
					joinCall: false,
					navigateToChannel: true,
				})
		},
		canPick: () => typeof stores.picker?.launchImageLibraryAsync === 'function',
		fontScale():
			| { fontScale: number; isClassicChatFontScaleEnabled: boolean }
			| undefined {
			const value = call('font', 'getCustomFontScale')
			return typeof stores.font?.setCustomFontScale === 'function' &&
				value &&
				typeof value.fontScale === 'number' &&
				Number.isFinite(value.fontScale) &&
				typeof value.isClassicChatFontScaleEnabled === 'boolean'
				? value
				: undefined
		},
		async setFontScale(scale: number) {
			const saved = api.fontScale()
			if (
				!alive ||
				!saved ||
				![0.75, 0.875, 0.9375, 1, 1.125, 1.25, 1.5, 1.75, 2].includes(scale)
			)
				throw new Error('Discord text size is unavailable on this build.')
			// Explicit user action only: the same saved native preference as Appearance.
			await stores.font.setCustomFontScale(
				scale,
				saved.isClassicChatFontScaleEnabled,
			)
			if (alive) {
				stores.fontState?.useFontScaleStore?.setState?.({
					fontScale: scale,
					persistedFontScale: scale,
					isClassicChatFontScaleEnabled: saved.isClassicChatFontScaleEnabled,
					persistedIsClassicChatFontScaleEnabled:
						saved.isClassicChatFontScaleEnabled,
				})
				notify()
			}
		},
		async pick() {
			if (!alive || !api.canPick())
				throw new Error(
					'Photo selection is unavailable. Paste an HTTPS image URL instead.',
				)
			const result = await stores.picker.launchImageLibraryAsync({
				mediaType: 'photo',
				selectionLimit: 1,
				multiple: false,
				selections: [],
			})
			return alive ? pickedImage(result) : null
		},
		dispose() {
			alive = false
			for (const dispose of cleanup) dispose()
			listeners.clear()
			appearanceListeners.clear()
			for (const key of Object.keys(stores)) delete stores[key]
		},
	}
	return api
}
export type StudioData = ReturnType<typeof createStudioData>
let active: StudioData | undefined
export const setStudioData = (value: StudioData | undefined) => {
	active = value
}
export const getStudioData = () => active
