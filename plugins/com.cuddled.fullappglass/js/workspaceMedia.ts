import { isId, messageRecords } from './workspaceModel'
import type { WorkspaceMessage } from './workspaceModel'

type Response = {
	status: number
	body?: any
	headers?: Record<string, unknown>
}
export type MediaHistoryStatus =
	| 'idle'
	| 'loading'
	| 'waiting'
	| 'paused'
	| 'complete'
	| 'partial'
	| 'error'
	| 'limited'
export interface MediaHistoryState {
	channelId: string
	status: MediaHistoryStatus
	messages: WorkspaceMessage[]
	pages: number
	total: number | null
	detail: string
}
interface Dependencies {
	account(): string
	allowed(channelId: string): boolean
	visible(message: any): boolean
	request(
		channelId: string,
		cursor: string | null,
		signal: AbortSignal,
	): Promise<Response>
	changed(): void
	now?(): number
	schedule?(fn: () => void, ms: number): ReturnType<typeof setTimeout>
	cancel?(timer: ReturnType<typeof setTimeout>): void
	maxMessages?: number
}
const empty = (): MediaHistoryState => ({
	channelId: '',
	status: 'idle',
	messages: [],
	pages: 0,
	total: null,
	detail: '',
})

/** A private search session. Never dispatches to Discord's message/search/ack stores. */
export function createMediaHistory(deps: Dependencies) {
	let state = empty(),
		owner = deps.account(),
		alive = true,
		active = false
	let cursor: string | null = null,
		generation = 0,
		retryCount = 0,
		notBefore = 0
	let timer: ReturnType<typeof setTimeout> | undefined,
		controller: AbortController | undefined
	const seenCursors = new Set<string>(),
		messages = new Map<string, WorkspaceMessage>()
	const now = deps.now ?? Date.now,
		schedule =
			deps.schedule ?? ((fn: () => void, ms: number) => setTimeout(fn, ms)),
		cancel =
			deps.cancel ??
			((value: ReturnType<typeof setTimeout>) => clearTimeout(value))
	const emit = () => {
		if (alive) deps.changed()
	}
	const stop = () => {
		generation++
		active = false
		if (timer !== undefined) cancel(timer)
		timer = undefined
		controller?.abort()
		controller = undefined
	}
	const reset = (channelId = '') => {
		stop()
		cursor = null
		retryCount = 0
		seenCursors.clear()
		messages.clear()
		state = { ...empty(), channelId }
		owner = deps.account()
	}
	const valid = () =>
		alive && owner === deps.account() && deps.allowed(state.channelId)
	const sync = () => {
		if (
			owner !== deps.account() ||
			(state.channelId && !deps.allowed(state.channelId))
		) {
			reset()
			emit()
		}
	}
	const later = (ms: number) => {
		if (!active || !valid()) return
		timer = schedule(() => {
			timer = undefined
			void fetchPage()
		}, ms)
	}
	const fetchPage = async () => {
		if (!active || !valid()) {
			sync()
			return
		}
		if (now() < notBefore) {
			later(notBefore - now())
			return
		}
		const token = generation
		controller = new AbortController()
		state = {
			...state,
			status: 'loading',
			detail: 'Finding older images and videos…',
		}
		emit()
		try {
			let response: Response
			try {
				response = await deps.request(
					state.channelId,
					cursor,
					controller.signal,
				)
			} catch (error: any) {
				if (![202, 429, 503].includes(error?.status)) throw error
				response = error
			}
			if (token !== generation || !active || !valid()) {
				sync()
				return
			}
			if ([202, 429, 503].includes(response.status)) {
				const seconds = Number(
					response.body?.retry_after ??
						response.headers?.['retry-after'] ??
						response.headers?.['Retry-After'],
				)
				const delay =
					Number.isFinite(seconds) && seconds > 0
						? Math.min(seconds * 1000, 2147483647)
						: 5000
				notBefore = now() + Math.max(1000, delay)
				retryCount++
				const indexing = response.status === 202
				state = {
					...state,
					status: retryCount >= 6 ? 'paused' : 'waiting',
					detail: indexing
						? 'Discord is indexing this conversation. Older results may take a little longer.'
						: 'Waiting for Discord before loading the next batch.',
				}
				if (retryCount >= 6) active = false
				else later(notBefore - now())
				emit()
				return
			}
			if (response.status !== 200)
				throw new Error(
					response.status === 403
						? 'Discord could not grant access to this conversation.'
						: 'Media search could not finish. Resume to retry.',
				)
			const tab = response.body?.tabs?.media
			if (
				!Array.isArray(tab?.messages) ||
				tab.messages.length > 200 ||
				(tab.cursor != null &&
					(typeof tab.cursor !== 'string' || tab.cursor.length > 16384))
			)
				throw new Error(
					'This Discord build returned an unsupported media-search response.',
				)
			const rows = tab.messages.flatMap((group: any) => {
				// 347 returns groups with the matching message first, followed by optional context.
				const m = Array.isArray(group)
					? (group.find(v => v?.hit === true) ?? group[0])
					: group
				return m && m.channel_id === state.channelId && deps.visible(m)
					? [m]
					: []
			})
			for (const m of messageRecords(rows, state.channelId)) {
				if (m.attachments.some(a => a.kind !== 'audio'))
					messages.set(m.id, { ...m, content: '', links: [], replyId: '' })
			}
			const next = tab.cursor || null
			if (next && (next === cursor || seenCursors.has(next)))
				throw new Error(
					'Discord repeated a search page. Refresh the library to try again.',
				)
			if (next) seenCursors.add(next)
			cursor = next
			retryCount = 0
			const partial = response.body?.doing_deep_historical_index === true
			const limited =
				messages.size >= (deps.maxMessages ?? 5000) && cursor !== null
			state = {
				...state,
				messages: [...messages.values()].sort(
					(a, b) => b.id.length - a.id.length || b.id.localeCompare(a.id),
				),
				pages: state.pages + 1,
				total:
					Number.isFinite(tab.total_results) && tab.total_results >= 0
						? tab.total_results
						: null,
				status: limited
					? 'limited'
					: cursor
						? 'loading'
						: partial
							? 'partial'
							: 'complete',
				detail: limited
					? 'This batch is full. Browse an older batch to keep your phone responsive.'
					: cursor
						? 'Loading older media…'
						: partial
							? 'Discord is still indexing older history. Refresh later for more results.'
							: 'All currently available search results loaded.',
			}
			if (!cursor || limited) active = false
			else {
				notBefore = now() + 1200
				later(1200)
			}
			emit()
		} catch (error) {
			if (token !== generation || !active || !valid()) {
				sync()
				return
			}
			active = false
			state = {
				...state,
				status: 'error',
				detail:
					error instanceof Error
						? error.message
						: 'Media search could not finish. Resume to retry.',
			}
			emit()
		} finally {
			if (token === generation) controller = undefined
		}
	}
	const api = {
		snapshot() {
			sync()
			return state
		},
		sync,
		start(channelId: string) {
			if (!alive || !isId(channelId) || !deps.allowed(channelId)) return
			if (owner !== deps.account() || channelId !== state.channelId)
				reset(channelId)
			if (active || ['complete', 'partial', 'limited'].includes(state.status))
				return
			active = true
			retryCount = 0
			state = {
				...state,
				status: now() < notBefore ? 'waiting' : 'loading',
				detail: 'Loading older media…',
			}
			emit()
			void fetchPage()
		},
		pause() {
			if (!active) return
			stop()
			state = {
				...state,
				status: 'paused',
				detail: 'Loading paused. Your results are still here.',
			}
			emit()
		},
		refresh(channelId: string) {
			reset(channelId)
			api.start(channelId)
			emit()
		},
		older() {
			if (state.status !== 'limited' || !valid()) return
			messages.clear()
			state = { ...state, messages: [], status: 'paused' }
			api.start(state.channelId)
		},
		dispose() {
			reset()
			alive = false
		},
	}
	return api
}

/** Discord 347's native media-search payload, isolated from the visible search UI. */
export function mediaSearchRequest(
	channelId: string,
	guildId: string,
	cursor: string | null,
	endpoints: Record<string, any>,
) {
	if (!isId(channelId) || (guildId && !isId(guildId)))
		throw new Error('Choose a conversation first.')
	const endpoint = guildId
		? endpoints.SEARCH_TABS_GUILD
		: endpoints.SEARCH_TABS_CHANNEL
	if (typeof endpoint !== 'function')
		throw new Error('Media search is unavailable on this Discord build.')
	return {
		url: endpoint(guildId || channelId),
		body: {
			include_nsfw: false,
			channel_ids: [channelId],
			tabs: {
				media: {
					has: ['image', 'video'],
					sort_by: 'timestamp',
					sort_order: 'desc',
					limit: 25,
					cursor,
				},
			},
			track_exact_total_hits: true,
		},
		oldFormErrors: true,
		rejectWithError: false,
	}
}
