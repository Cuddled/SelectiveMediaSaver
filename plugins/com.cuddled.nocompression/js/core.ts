export type Settings = {
	enabled: boolean
	originalImages: boolean
	originalVideos: boolean
}
export type Mode = 'original' | 'discord'
export class OriginalMediaError extends Error {}
export type Any = Record<string, any>
export const DEFAULT_SETTINGS: Settings = {
	enabled: true,
	originalImages: true,
	originalVideos: true,
}
export function normalizeSettings(value: unknown): Settings {
	const raw = value && typeof value === 'object' ? (value as Any) : {}
	return Object.fromEntries(
		Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [
			key,
			typeof raw[key] === 'boolean' ? raw[key] : fallback,
		]),
	) as Settings
}
export function mediaKind(upload: Any): 'image' | 'video' | undefined {
	// Discord 347: only native message attachments, never profile/shop uploads.
	if (
		upload?.item?.platform !== 0 ||
		(upload.item.target != null && upload.item.target !== 0) ||
		typeof upload.channelId !== 'string'
	)
		return
	const mime = upload.item.mimeType || upload.mimeType
	if (typeof mime !== 'string') return
	if (mime.toLowerCase().startsWith('image/')) return 'image'
	if (mime.toLowerCase().startsWith('video/')) return 'video'
}
export function defaultMode(settings: Settings, upload: Any): Mode {
	const kind = mediaKind(upload)
	return settings.enabled &&
		((kind === 'image' && settings.originalImages) ||
			(kind === 'video' && settings.originalVideos))
		? 'original'
		: 'discord'
}
export function validSize(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}
export function formatSize(bytes: number): string {
	return bytes >= 1024 * 1024
		? `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
		: `${Math.ceil(bytes / 1024)} KiB`
}
export function sourceUri(upload: Any): string | undefined {
	const uri = upload.item?.originalUri || upload.item?.uri
	return typeof uri === 'string' && /^(content:\/\/|file:\/\/|\/)/i.test(uri)
		? uri
		: undefined
}
export type Prompt = {
	name: string
	reason: 'oversize' | 'unavailable'
	limit?: number
	size?: number
}
export type Dependencies = {
	settings: () => Settings
	account: () => string | undefined
	limit: (upload: Any) => number | undefined
	prepare: (id: string, uri: string, limit: number) => Promise<Any>
	cancel: (id: string) => void
	release: (uri: string) => void
	ask: (prompt: Prompt, signal: AbortSignal) => Promise<'compress' | 'cancel'>
	changed: () => void
}

/** Owns decisions per upload, never a global compression flag shared by files. */
export function createController(deps: Dependencies) {
	let alive = true
	let sequence = 0
	const session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
	const choices = new WeakMap<Any, Mode>()
	const jobs = new Map<
		Any,
		{ id: string; abort: AbortController; account: string }
	>()
	const prepared = new Map<Any, string>()
	const inFlight = new WeakMap<Any, Promise<any>>()
	let promptTail: Promise<unknown> = Promise.resolve()
	const changed = () => deps.changed()
	function mode(upload: Any): Mode {
		return !alive || !deps.settings().enabled
			? 'discord'
			: (choices.get(upload) ?? defaultMode(deps.settings(), upload))
	}
	function editable(upload: Any): boolean {
		return (
			alive &&
			!jobs.has(upload) &&
			!upload.reactNativeFilePrepped &&
			!upload._aborted
		)
	}
	function release(upload: Any) {
		const uri = prepared.get(upload)
		if (uri) {
			prepared.delete(upload)
			deps.release(uri)
		}
	}
	function cancel(upload: Any) {
		const job = jobs.get(upload)
		if (job) {
			job.abort.abort()
			deps.cancel(job.id)
		}
	}
	function sync() {
		for (const [upload, job] of jobs) {
			if (!alive || !deps.settings().enabled || deps.account() !== job.account)
				cancel(upload)
		}
		changed()
	}
	async function process(upload: Any, original: () => any) {
		if (
			!mediaKind(upload) ||
			mode(upload) === 'discord' ||
			upload.reactNativeFilePrepped
		)
			return original()
		const account = deps.account()
		if (!account)
			throw new OriginalMediaError(
				'Sign in again before uploading this attachment.',
			)
		const id = `${session}-${++sequence}`
		const abort = new AbortController()
		const job = { id, abort, account }
		jobs.set(upload, job)
		changed()
		let cachedUri: string | undefined
		function ensureActive() {
			if (
				!alive ||
				abort.signal.aborted ||
				deps.account() !== account ||
				upload._aborted ||
				upload.isCancelled?.()
			)
				throw new OriginalMediaError(
					'Original media upload canceled. Reattach the file to try again.',
				)
		}
		async function ask(prompt: Prompt) {
			const task = promptTail.then(async () => {
				ensureActive()
				return deps.ask(prompt, abort.signal)
			})
			promptTail = task.catch(() => {})
			const choice = await task
			ensureActive()
			if (choice !== 'compress')
				throw new OriginalMediaError(
					'Upload canceled. The original was not compressed.',
				)
			choices.set(upload, 'discord')
			return original()
		}
		try {
			ensureActive()
			const uri = sourceUri(upload)
			const limit = deps.limit(upload)
			const name = String(
				upload.filename || upload.item.filename || 'Attachment',
			)
			if (!uri || !validSize(limit))
				return await ask({ name, reason: 'unavailable' })
			let result: Any
			try {
				result = await deps.prepare(id, uri, limit)
			} catch {
				ensureActive()
				return await ask({ name, reason: 'unavailable' })
			}
			if (result?.ok && typeof result.uri === 'string') cachedUri = result.uri
			ensureActive()
			if (!result?.ok) {
				return await ask({
					name,
					reason: result?.code === 'TOO_LARGE' ? 'oversize' : 'unavailable',
					limit,
					size: validSize(result?.size) ? result.size : undefined,
				})
			}
			if (!cachedUri?.startsWith('file://') || !validSize(result.size))
				return await ask({ name, reason: 'unavailable' })
			// Recheck after asynchronous preparation: account/boost limits can change.
			const currentLimit = deps.limit(upload)
			if (!validSize(currentLimit))
				return await ask({ name, reason: 'unavailable' })
			if (result.size > currentLimit)
				return await ask({
					name,
					reason: 'oversize',
					limit: currentLimit,
					size: result.size,
				})
			ensureActive()
			// Only the transport file changes. Draft captions, spoilers, thumbnails,
			// dimensions and the original URI are retained for Discord's own payload.
			upload.item = {
				...upload.item,
				uri: cachedUri,
				filename: upload.filename || upload.item.filename,
				mimeType: upload.item.mimeType || upload.mimeType,
			}
			upload.currentSize = result.size
			upload.preCompressionSize = result.size
			upload.postCompressionSize = result.size
			upload.reactNativeFilePrepped = true
			prepared.set(upload, cachedUri)
			cachedUri = undefined
			return upload
		} finally {
			if (cachedUri) deps.release(cachedUri)
			jobs.delete(upload)
			changed()
		}
	}
	return {
		mode,
		editable,
		cancel,
		release,
		sync,
		choose(upload: Any, value: Mode) {
			if (!mediaKind(upload) || !editable(upload)) return false
			choices.set(upload, value)
			changed()
			return true
		},
		prepare(upload: Any, original: () => any): Promise<any> {
			const running = inFlight.get(upload)
			if (running) return running
			const task = process(upload, original)
			inFlight.set(upload, task)
			void task.finally(() => inFlight.delete(upload)).catch(() => {})
			return task
		},
		stop() {
			alive = false
			sync()
			// An already prepared file can still be in Discord's network uploader.
			// Native cache expiry cleans those files after restart, never mid-upload.
			prepared.clear()
		},
	}
}
