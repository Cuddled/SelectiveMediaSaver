import { runtime } from './core'
import { applyMood } from './experience'
import { saveSettings } from './settingsWriter'
import { createMediaHistory, mediaSearchRequest } from './workspaceMedia'
import {
	accountFor,
	activeRule,
	isId,
	messageRecords,
	paletteFor,
	updateAccount,
} from './workspaceModel'
import type { Settings } from './core'
import type { StudioData } from './studioData'
import type { Session, WorkspaceAccount } from './workspaceModel'

type Any = Record<string, any>
export function createWorkspaceData(home: StudioData) {
	const stores: Record<string, Any> = {},
		listeners = new Set<() => void>(),
		cleanup: Array<() => void> = []
	const positions = new Map<string, string>()
	const messagesCache = new Map<string, ReturnType<typeof messageRecords>>()
	let history: ReturnType<typeof createMediaHistory> | undefined
	let peekChannel = ''
	let alive = true,
		revision = 0,
		timer: ReturnType<typeof setTimeout> | undefined,
		lastAccount = ''
	const emit = () => {
		if (alive) {
			history?.sync()
			messagesCache.clear()
			revision++
			for (const fn of listeners) fn()
		}
	}
	const notify = () => {
		if (!alive || timer) return
		timer = setTimeout(() => {
			timer = undefined
			emit()
			home.invalidate()
		}, 80)
	}
	const call = (key: string, method: string, ...args: any[]) => {
		try {
			return stores[key]?.[method]?.(...args)
		} catch {
			return undefined
		}
	}
	const api = {
		get mediaHistory() {
			return history!
		},
		mediaSearchReady() {
			return (
				typeof stores.http?.post === 'function' &&
				!!stores.searchConstants?.Endpoints
			)
		},
		mediaMessages(id: string) {
			if (!api.canRead(id)) return []
			const state = history!.snapshot()
			const all = new Map(
				(state.channelId === id ? state.messages : []).map(m => [m.id, m]),
			)
			for (const m of api.messages(id)) all.set(m.id, m)
			return [...all.values()].sort(
				(a, b) => b.id.length - a.id.length || b.id.localeCompare(a.id),
			)
		},
		subscribe(fn: () => void) {
			listeners.add(fn)
			return () => {
				listeners.delete(fn)
			}
		},
		getSnapshot: () => `${revision}:${home.getSnapshot()}`,
		accountId() {
			const id = home.self()?.id
			return isId(id) ? id : ''
		},
		account() {
			return accountFor(runtime.getSettings().workspace, api.accountId())
		},
		attach(key: string, value: Any | undefined) {
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
		context() {
			const id = call('selectedChannel', 'getChannelId'),
				channel = call('channels', 'getChannel', id)
			return {
				channelId: isId(id) ? id : '',
				guildId: isId(channel?.guild_id) ? channel.guild_id : '',
				voiceId: call('selectedChannel', 'getVoiceChannelId') as
					| string
					| undefined,
			}
		},
		channel(id: string) {
			const c = call('channels', 'getChannel', id)
			if (!isId(c?.id)) return undefined
			const dm = home.chats().find(v => v.id === id)
			return {
				id: c.id,
				name: dm?.name || String(c.name || 'Conversation'),
				guildId: isId(c.guild_id) ? c.guild_id : '',
				image: dm?.image,
			}
		},
		canRead(id: string) {
			if (!alive || !api.accountId() || !isId(id)) return false
			const c = call('channels', 'getChannel', id)
			if (!c || c.nsfw) return false // Let Discord handle its age-gated surfaces.
			if (c.guild_id)
				return (
					stores.permissionConstants?.Permissions?.VIEW_CHANNEL != null &&
					stores.permissionConstants?.Permissions?.READ_MESSAGE_HISTORY !=
						null &&
					call(
						'permissions',
						'can',
						stores.permissionConstants.Permissions.VIEW_CHANNEL,
						c,
					) === true &&
					call(
						'permissions',
						'can',
						stores.permissionConstants.Permissions.READ_MESSAGE_HISTORY,
						c,
					) === true
				)
			return home.chats().some(item => item.id === id)
		},
		messages(id: string) {
			if (!api.canRead(id)) return []
			const cached = messagesCache.get(id)
			if (cached) return cached
			const value = call('messages', 'getMessages', id)
			let items: unknown
			try {
				items = Array.isArray(value) ? value : value?.toArray?.()
			} catch {
				return []
			}
			const records = messageRecords(items, id)
			if (messagesCache.size >= 32)
				messagesCache.delete(messagesCache.keys().next().value!)
			messagesCache.set(id, records)
			return records
		},
		message(channelId: string, messageId: string) {
			return api.messages(channelId).find(m => m.id === messageId)
		},
		conversations() {
			const context = api.context(),
				current = api.channel(context.channelId)
			return [
				...(current ? [current] : []),
				...home.chats().filter(c => c.id !== current?.id),
			].slice(0, 50)
		},
		position(channelId: string) {
			return positions.get(channelId) || ''
		},
		peek: () => peekChannel,
		setPeek(id: string) {
			peekChannel = id && api.canRead(id) ? id : ''
			emit()
		},
		recordPosition(channelId: string, event: unknown) {
			if (!api.canRead(channelId) || !event || typeof event !== 'object') return
			const raw = event as Any,
				value = raw.nativeEvent ?? raw
			// Native Chat's visible-message event includes a stable message ID.
			const id = value.middleVisibleMessage ?? value.topVisibleMessage
			if (isId(id)) {
				positions.delete(channelId)
				positions.set(channelId, id)
				if (positions.size > 50)
					positions.delete(positions.keys().next().value!)
			}
		},
		async save(update: (a: WorkspaceAccount) => WorkspaceAccount) {
			const id = api.accountId()
			if (!alive || !id) throw new Error('Sign in to save your workspace.')
			return saveSettings(current => ({
				workspace: updateAccount(current.workspace, id, update),
			}))
		},
		async openMessage(channelId: string, messageId: string) {
			if (
				!api.canRead(channelId) ||
				!isId(messageId) ||
				typeof stores.channel?.transitionToMessage !== 'function'
			)
				throw new Error(
					'This message is unavailable. Open its conversation in Discord first.',
				)
			await stores.channel.transitionToMessage(channelId, messageId)
			if (alive) positions.set(channelId, messageId)
		},
		webPlayer() {
			return stores.webPlayer?.default
		},
		playerStates() {
			return (
				stores.webPlayer?.PlayerState ?? {
					READY: 1,
					PAUSED: 6,
					PLAYING: 5,
					ERRORED: 2,
				}
			)
		},
		rule() {
			return activeRule(api.account(), api.context())
		},
		effective(settings: Settings): Settings {
			if (!settings.enabled || !settings.workspace.enabled) return settings
			const account = api.account(),
				rule = activeRule(account, api.context())
			let next = rule
				? { ...settings, ...applyMood(settings, rule.mood) }
				: settings
			if (
				next.studio.focus ||
				next.studio.mood === 'oled' ||
				account.atmosphere === 'off'
			)
				return next
			let accent = ''
			if (account.atmosphere === 'server')
				accent = paletteFor(api.context().guildId || api.context().channelId)
			if (account.atmosphere === 'music') {
				const music = home.music()
				if (music) accent = paletteFor(`${music.title}:${music.artist}`)
			}
			if (account.atmosphere === 'voice' && api.context().voiceId)
				accent =
					call('speaking', 'isAnyoneElseSpeaking') ||
					call('speaking', 'isCurrentUserSpeaking')
						? '#9ACFBF'
						: '#93CCED'
			if (accent) {
				const blend = (a: string, b: string) =>
					'#' +
					[1, 3, 5]
						.map(i =>
							Math.round(
								parseInt(a.slice(i, i + 2), 16) * (1 - account.intensity) +
									parseInt(b.slice(i, i + 2), 16) * account.intensity,
							)
								.toString(16)
								.padStart(2, '0'),
						)
						.join('')
				next = {
					...next,
					accentColor: blend(
						next.accentColor,
						accent,
					) as Settings['accentColor'],
				}
			}
			return next
		},
		async restore(session: Session) {
			const account = api.accountId()
			if (!api.canRead(session.channelId))
				throw new Error(
					'This conversation is no longer available to this account.',
				)
			if (session.messageId)
				await api.openMessage(session.channelId, session.messageId)
			else await home.open('channel', session.channelId)
			if (!alive || account !== api.accountId())
				throw new Error('The active account changed. Restore cancelled.')
			await saveSettings(current => ({
				...current,
				accentColor: session.accent as Settings['accentColor'],
				panelColor: session.panel as Settings['panelColor'],
				menuColor: session.menu as Settings['menuColor'],
				darkness: session.darkness,
				transparency: session.transparency,
				blur: session.blur,
				lowPower: session.lowPower,
				studio: {
					...current.studio,
					mood: session.mood,
					wallpaper: session.wallpaper,
					homeWallpaper: session.wallpaper,
				},
			}))
		},
		dispose() {
			alive = false
			history?.dispose()
			if (timer) clearTimeout(timer)
			for (const fn of cleanup) fn()
			listeners.clear()
			positions.clear()
			messagesCache.clear()
			peekChannel = ''
			home.setAppearanceResolver(undefined)
			for (const key of Object.keys(stores)) delete stores[key]
		},
	}
	history = createMediaHistory({
		account: api.accountId,
		allowed: id =>
			api.canRead(id) &&
			runtime.getSettings().enabled &&
			runtime.getSettings().workspace.enabled,
		visible: m =>
			call('relationships', 'isBlockedOrIgnoredForMessage', m) !== true &&
			call('relationships', 'isBlocked', m.author?.id) !== true,
		changed: emit,
		request: async (id, cursor, signal) => {
			if (!api.mediaSearchReady())
				throw new Error(
					'Media search is still initializing. Try again in a moment.',
				)
			const channel = api.channel(id)
			if (!channel) throw new Error('This conversation is unavailable.')
			return stores.http.post({
				...mediaSearchRequest(
					id,
					channel.guildId,
					cursor,
					stores.searchConstants.Endpoints,
				),
				signal,
			})
		},
	})
	cleanup.push(
		home.subscribe(() => {
			const id = api.accountId()
			if (id !== lastAccount) {
				lastAccount = id
				positions.clear()
				peekChannel = ''
			}
			emit()
		}),
	)
	home.setAppearanceResolver(api.effective)
	return api
}
export type WorkspaceData = ReturnType<typeof createWorkspaceData>
let active: WorkspaceData | undefined
export const getWorkspaceData = () => active
export const setWorkspaceData = (value: WorkspaceData | undefined) => {
	active = value
}
