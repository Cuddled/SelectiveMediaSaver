import { isId, messageRecords } from './workspaceModel'
import type { WorkspaceMessage } from './workspaceModel'

type Response = {
	status: number
	body?: any
	headers?: Record<string, unknown>
}
type JsonCursor =
	| null
	| string
	| number
	| boolean
	| JsonCursor[]
	| { [key: string]: JsonCursor }
export type MediaCursor =
	| string
	| JsonCursor[]
	| { [key: string]: JsonCursor }
	| null
export type MediaSearchMode = 'tabs' | 'messages'

class UnsupportedMediaResponse extends Error {}

/** Search cursors are opaque JSON. Bound and clone them without coercing objects to strings. */
function searchCursor(value: unknown): MediaCursor {
	if (value == null || value === '') return null
	let nodes = 0
	const visit = (item: unknown, depth: number): JsonCursor => {
		if (++nodes > 512 || depth > 8)
			throw new UnsupportedMediaResponse('Invalid search cursor.')
		if (item === null || typeof item === 'boolean') return item
		if (typeof item === 'string' && item.length <= 16384) return item
		if (typeof item === 'number' && Number.isFinite(item)) return item
		if (Array.isArray(item)) return item.map(child => visit(child, depth + 1))
		if (
			item &&
			typeof item === 'object' &&
			Object.getPrototypeOf(item) === Object.prototype
		) {
			const entries = Object.entries(item).sort(([a], [b]) =>
				a.localeCompare(b),
			)
			if (entries.length > 64)
				throw new UnsupportedMediaResponse('Invalid search cursor.')
			return Object.fromEntries(
				entries.map(([key, child]) => [key, visit(child, depth + 1)]),
			)
		}
		throw new UnsupportedMediaResponse('Invalid search cursor.')
	}
	if (typeof value !== 'string' && (typeof value !== 'object' || !value))
		throw new UnsupportedMediaResponse('Invalid search cursor.')
	const cursor = visit(value, 0) as MediaCursor
	if (JSON.stringify(cursor).length > 16384)
		throw new UnsupportedMediaResponse('Invalid search cursor.')
	return cursor
}

function searchPage(
	response: Response,
	mode: MediaSearchMode,
	channelId: string,
) {
	const body = response.body
	const tab = mode === 'tabs' ? body?.tabs?.media : body
	if (!Array.isArray(tab?.messages) || tab.messages.length > 200) {
		throw new UnsupportedMediaResponse(
			'Discord returned an unreadable media-search page. Refresh media to retry.',
		)
	}
	const rows = tab.messages.flatMap((group: any) => {
		const m = Array.isArray(group)
			? (group.find(v => v?.hit === true) ?? group[0])
			: group
		return m && m.channel_id === channelId ? [m] : []
	})
	let cursor: MediaCursor = null
	if (mode === 'tabs') cursor = searchCursor(tab.cursor)
	else if (tab.messages.length >= 25) {
		// Standard search pages backwards by the oldest hit, avoiding the offset ceiling.
		const ids = rows
			.map((m: any) => m.id)
			.filter(isId)
			.sort((a: string, b: string) => a.length - b.length || a.localeCompare(b))
		if (!ids.length)
			throw new UnsupportedMediaResponse(
				'Discord returned a media page outside this conversation.',
			)
		cursor = ids[0]
	}
	return {
		rows,
		cursor,
		total: tab.total_results,
		partial: body?.doing_deep_historical_index === true,
	}
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
		cursor: MediaCursor,
		signal: AbortSignal,
		mode: MediaSearchMode,
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
	let cursor: MediaCursor = null,
		mode: MediaSearchMode = 'tabs',
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
		mode = 'tabs'
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
					mode,
				)
			} catch (error: any) {
				if (![202, 429, 503, 400, 404, 405, 501].includes(error?.status))
					throw error
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
			if (mode === 'tabs' && [400, 404, 405, 501].includes(response.status))
				throw new UnsupportedMediaResponse('Tab media search is unavailable.')
			if (response.status !== 200)
				throw new Error(
					response.status === 403
						? 'Discord could not grant access to this conversation.'
						: 'Media search could not finish. Resume to retry.',
				)
			const page = searchPage(response, mode, state.channelId)
			const rows = page.rows.filter(deps.visible)
			for (const m of messageRecords(rows, state.channelId)) {
				if (m.attachments.some(a => a.kind !== 'audio'))
					messages.set(m.id, { ...m, content: '', links: [], replyId: '' })
			}
			const next = page.cursor
			const nextKey = JSON.stringify(next)
			if (
				next &&
				(nextKey === JSON.stringify(cursor) || seenCursors.has(nextKey))
			)
				throw new Error(
					'Discord repeated a search page. Refresh the library to try again.',
				)
			if (next) seenCursors.add(nextKey)
			cursor = next
			retryCount = 0
			const partial = page.partial
			const limited =
				messages.size >= (deps.maxMessages ?? 5000) && cursor !== null
			state = {
				...state,
				messages: [...messages.values()].sort(
					(a, b) => b.id.length - a.id.length || b.id.localeCompare(a.id),
				),
				pages: state.pages + 1,
				total:
					Number.isFinite(page.total) && page.total >= 0 ? page.total : null,
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
			if (error instanceof UnsupportedMediaResponse && mode === 'tabs') {
				mode = 'messages'
				cursor = null
				seenCursors.clear()
				retryCount = 0
				notBefore = now() + 1200
				state = {
					...state,
					status: 'waiting',
					detail: 'Switching to Discord’s standard media search…',
				}
				later(1200)
				emit()
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
	cursor: MediaCursor,
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

/** Same scoped GET search used by Discord 347's SearchFetcherImpl. */
export function standardMediaSearchRequest(
	channelId: string,
	guildId: string,
	cursor: MediaCursor,
	endpoints: Record<string, any>,
) {
	if (!isId(channelId) || (guildId && !isId(guildId)))
		throw new Error('Choose a conversation first.')
	if (cursor !== null && !isId(cursor))
		throw new Error('Invalid media continuation.')
	const endpoint = guildId ? endpoints.SEARCH_GUILD : endpoints.SEARCH_CHANNEL
	if (typeof endpoint !== 'function')
		throw new Error(
			'Standard media search is unavailable on this Discord build.',
		)
	const query = [
		['channel_id', channelId],
		['has', 'image'],
		['has', 'video'],
		['sort_by', 'timestamp'],
		['sort_order', 'desc'],
		['limit', '25'],
		['include_nsfw', 'false'],
	]
	if (cursor) query.push(['max_id', cursor as string])
	return {
		url: endpoint(guildId || channelId),
		query: query
			.map(
				([key, value]) =>
					`${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
			)
			.join('&'),
		oldFormErrors: true,
		rejectWithError: false,
	}
}
