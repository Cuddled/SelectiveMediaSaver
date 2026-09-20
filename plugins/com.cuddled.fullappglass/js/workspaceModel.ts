/** Bounded, account-scoped personal data. Message bodies and attachment URLs are not persisted. */
export const TOOL_NAMES = {
	lenses: 'Conversation lenses',
	peek: 'Floating peek',
	media: 'Media Studio',
	wheel: 'Gesture wheel',
	rules: 'Personal rules',
	notes: 'Notebooks',
	voice: 'Voice-note tools',
	home: 'Home builder',
	atmosphere: 'Reactive atmosphere',
	sessions: 'Saved sessions',
} as const
export type Tool = keyof typeof TOOL_NAMES
export const WIDGETS = [
	'friends',
	'music',
	'notes',
	'sessions',
	'media',
	'shortcuts',
] as const
export type Widget = (typeof WIDGETS)[number]
export const MOOD_IDS = [
	'waves',
	'frosted',
	'midnight',
	'ice',
	'rose',
	'oled',
] as const
export type SceneMood = (typeof MOOD_IDS)[number]
export type Lens = 'Messages' | 'Media' | 'Links' | 'Questions' | 'Reply map'
export interface Bookmark {
	channelId: string
	messageId: string
	label: string
	seconds: number
	attachmentId: string
}
export interface Notebook {
	text: string
	followUp: string
	done: boolean
}
export interface MediaMark extends Bookmark {
	collection: string
	tags: string
	transcript: string
	start: number
	end: number
}
export interface Rule {
	id: string
	name: string
	trigger: 'guild' | 'channel' | 'voice'
	target: string
	mood: SceneMood
	tool: Tool
	enabled: boolean
}
export interface Session {
	id: string
	name: string
	channelId: string
	messageId: string
	mood: SceneMood | 'custom'
	wallpaper: string
	accent: string
	panel: string
	menu: string
	darkness: number
	transparency: number
	blur: number
	lowPower: boolean
	savedAt: number
	tool: Tool
}
export interface Layout {
	id: string
	name: string
	widgets: Widget[]
	compact: boolean
}
export interface WorkspaceAccount {
	notes: Record<string, Notebook>
	bookmarks: Bookmark[]
	media: MediaMark[]
	rules: Rule[]
	sessions: Session[]
	widgets: Widget[]
	compact: boolean
	layouts: Layout[]
	wheel: Tool[]
	atmosphere: 'off' | 'music' | 'server' | 'voice'
	intensity: number
}
export interface WorkspaceSettings {
	enabled: boolean
	accounts: Record<string, WorkspaceAccount>
}
export const isId = (v: unknown): v is string =>
	typeof v === 'string' && /^\d{17,20}$/.test(v)
const object = (v: unknown): Record<string, any> =>
	v && typeof v === 'object' && !Array.isArray(v)
		? (v as Record<string, any>)
		: {}
const text = (v: unknown, max: number) =>
	typeof v === 'string' ? v.slice(0, max) : ''
const number = (v: unknown, fallback: number, max = 1) =>
	typeof v === 'number' && Number.isFinite(v)
		? Math.min(max, Math.max(0, v))
		: fallback
const list = (v: unknown, limit: number): any[] =>
	Array.isArray(v) ? v.slice(0, limit) : []
const color = (v: unknown, fallback: string) =>
	typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback
const unique = <T>(v: T[]) => [...new Set(v)]
const localId = (v: unknown): v is string =>
	typeof v === 'string' && /^[a-z0-9-]{1,64}$/i.test(v)
export const isTool = (v: unknown): v is Tool =>
	typeof v === 'string' && Object.hasOwn(TOOL_NAMES, v)
export const isMood = (v: unknown): v is SceneMood =>
	MOOD_IDS.includes(v as SceneMood)
export function wallpaperUri(v: unknown) {
	const s = text(v, 2049)
	return s.length <= 2048 &&
		!/[\s<>"\\]/.test(s) &&
		/^(https:\/\/[^/@?#]+(?:[/?#]|$)|file:\/\/\/|content:\/\/)/i.test(s)
		? s
		: ''
}
export function emptyAccount(): WorkspaceAccount {
	return {
		notes: {},
		bookmarks: [],
		media: [],
		rules: [],
		sessions: [],
		widgets: [...WIDGETS],
		compact: false,
		layouts: [],
		wheel: ['lenses', 'media', 'notes', 'sessions', 'peek', 'atmosphere'],
		atmosphere: 'off',
		intensity: 0.55,
	}
}
function mark(v: unknown): Bookmark | null {
	const r = object(v)
	return isId(r.channelId) && isId(r.messageId)
		? {
				channelId: r.channelId,
				messageId: r.messageId,
				attachmentId: isId(r.attachmentId) ? r.attachmentId : '',
				label: text(r.label, 100),
				seconds: number(r.seconds, 0, 86400),
			}
		: null
}
const widgets = (v: unknown) =>
	unique(list(v, 12).filter(x => WIDGETS.includes(x))) as Widget[]
export function normalizeAccount(value: unknown): WorkspaceAccount {
	const r = object(value),
		out = emptyAccount()
	for (const [id, value] of Object.entries(object(r.notes)).slice(0, 100)) {
		if (!isId(id)) continue
		const n = object(value)
		out.notes[id] = {
			text: text(n.text, 6000),
			followUp: text(n.followUp, 300),
			done: n.done === true,
		}
	}
	out.bookmarks = list(r.bookmarks, 200)
		.map(mark)
		.filter((v): v is Bookmark => !!v)
	out.media = list(r.media, 150).flatMap(v => {
		const m = mark(v)
		if (!m?.attachmentId) return []
		const start = number(v.start, 0, 86400),
			end = number(v.end, 0, 86400)
		return [
			{
				...m,
				collection: text(v.collection, 60),
				tags: text(v.tags, 160),
				transcript: text(v.transcript, 12000),
				start,
				end: end > start ? end : 0,
			},
		]
	})
	out.rules = list(r.rules, 24).flatMap(v => {
		const n = object(v)
		return localId(n.id) &&
			['guild', 'channel', 'voice'].includes(n.trigger) &&
			(n.trigger === 'voice' || isId(n.target)) &&
			isMood(n.mood) &&
			isTool(n.tool)
			? [
					{
						id: n.id,
						name: text(n.name, 60),
						trigger: n.trigger,
						target: n.trigger === 'voice' ? '' : n.target,
						mood: n.mood,
						tool: n.tool,
						enabled: n.enabled === true,
					} as Rule,
				]
			: []
	})
	out.sessions = list(r.sessions, 24).flatMap(v => {
		const n = object(v)
		if (!localId(n.id) || !isId(n.channelId)) return []
		return [
			{
				id: n.id,
				name: text(n.name, 60),
				channelId: n.channelId,
				messageId: isId(n.messageId) ? n.messageId : '',
				mood: isMood(n.mood) ? n.mood : 'custom',
				wallpaper: wallpaperUri(n.wallpaper),
				accent: color(n.accent, '#B8A1FF'),
				panel: color(n.panel, '#171B2B'),
				menu: color(n.menu, '#111321'),
				darkness: number(n.darkness, 0.28),
				transparency: number(n.transparency, 0.8),
				blur: number(n.blur, 0, 10),
				lowPower: n.lowPower !== false,
				savedAt: number(n.savedAt, 0, Number.MAX_SAFE_INTEGER),
				tool: isTool(n.tool) ? n.tool : 'notes',
			} as Session,
		]
	})
	out.widgets = Array.isArray(r.widgets) ? widgets(r.widgets) : out.widgets
	out.compact = r.compact === true
	out.layouts = list(r.layouts, 8).flatMap(v =>
		localId(v?.id)
			? [
					{
						id: v.id,
						name: text(v.name, 60),
						widgets: widgets(v.widgets),
						compact: v.compact === true,
					},
				]
			: [],
	)
	out.wheel = unique(list(r.wheel, 6).filter(isTool))
	if (!out.wheel.length) out.wheel = emptyAccount().wheel
	out.atmosphere = ['off', 'music', 'server', 'voice'].includes(r.atmosphere)
		? r.atmosphere
		: 'off'
	out.intensity = number(r.intensity, 0.55, 0.85)
	return out
}
export function normalizeWorkspace(v: unknown): WorkspaceSettings {
	const r = object(v),
		accounts: Record<string, WorkspaceAccount> = {}
	for (const [id, a] of Object.entries(object(r.accounts)).slice(0, 8))
		if (isId(id)) accounts[id] = normalizeAccount(a)
	return { enabled: r.enabled !== false, accounts }
}
export function accountFor(settings: WorkspaceSettings, id?: string) {
	return id && isId(id)
		? (settings.accounts[id] ?? emptyAccount())
		: emptyAccount()
}
export function updateAccount(
	settings: WorkspaceSettings,
	id: string,
	update: (a: WorkspaceAccount) => WorkspaceAccount,
): WorkspaceSettings {
	if (!isId(id))
		throw new Error('Sign in to Discord before saving your workspace.')
	if (!settings.accounts[id] && Object.keys(settings.accounts).length >= 8)
		throw new Error(
			'This device already has eight saved workspaces. Existing account data has been kept.',
		)
	const next = update(accountFor(settings, id))
	if (Object.keys(next.notes).length > 100)
		throw new Error(
			'You have 100 notebooks. Delete an unused notebook before adding another.',
		)
	// Keep the active account first so the bounded normalizer cannot discard its edit.
	return normalizeWorkspace({
		...settings,
		accounts: {
			[id]: next,
			...Object.fromEntries(
				Object.entries(settings.accounts).filter(([key]) => key !== id),
			),
		},
	})
}
export interface Attachment {
	id: string
	name: string
	url: string
	kind: 'image' | 'video' | 'audio'
	duration: number
	waveform: string
	spoiler: boolean
}
export interface WorkspaceMessage {
	id: string
	channelId: string
	author: string
	content: string
	time: string
	replyId: string
	attachments: Attachment[]
	links: string[]
}
export function mediaUri(v: unknown): string {
	if (typeof v !== 'string' || v.length > 4096 || /[\s<>"\\]/.test(v)) return ''
	return /^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/(?:attachments|ephemeral-attachments)\//i.test(
		v,
	)
		? v
		: ''
}
export function messageRecords(
	value: unknown,
	channelId: string,
): WorkspaceMessage[] {
	if (!Array.isArray(value) || !isId(channelId)) return []
	const result: WorkspaceMessage[] = []
	for (const raw of value.slice(-200)) {
		const m = object(raw)
		if (
			!isId(m.id) ||
			(m.channel_id && m.channel_id !== channelId) ||
			(m.channelId && m.channelId !== channelId)
		)
			continue
		const content = text(m.content, 12000)
		const attachments: Attachment[] = list(m.attachments, 10).flatMap(v => {
			const a = object(v),
				name = text(a.filename, 200),
				url = mediaUri(a.url),
				mime = text(a.content_type ?? a.contentType, 100)
			const kind =
				mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif)$/i.test(name)
					? 'image'
					: mime.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(name)
						? 'video'
						: mime.startsWith('audio/') ||
								/\.(ogg|mp3|m4a|wav|opus)$/i.test(name)
							? 'audio'
							: null
			return isId(a.id) && url && kind
				? [
						{
							id: a.id,
							name,
							url,
							kind,
							duration: number(a.duration_secs ?? a.duration, 0, 86400),
							waveform: text(a.waveform, 4096),
							spoiler: name.startsWith('SPOILER_') || a.spoiler === true,
						},
					]
				: []
		})
		const links = unique(
			(content.match(/https?:\/\/[^\s<>]+/g) ?? []).map(s =>
				s.replace(/[),.!?]+$/, ''),
			),
		).slice(0, 10)
		let time = ''
		try {
			const date = new Date(m.timestamp?.toISOString?.() ?? m.timestamp)
			if (Number.isFinite(date.getTime())) time = date.toLocaleString()
		} catch {}
		result.push({
			id: m.id,
			channelId,
			author:
				text(
					m.author?.globalName ?? m.author?.global_name ?? m.author?.username,
					80,
				) || 'Discord user',
			content,
			time,
			replyId: isId(
				m.messageReference?.message_id ?? m.message_reference?.message_id,
			)
				? (m.messageReference?.message_id ?? m.message_reference?.message_id)
				: '',
			attachments,
			links,
		})
	}
	return result.sort(
		(a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id),
	)
}
export function filterMessages(
	messages: WorkspaceMessage[],
	lens: Lens,
	query = '',
) {
	const q = query.trim().toLowerCase()
	return messages.filter(
		m =>
			(!q ||
				`${m.author} ${m.content} ${m.attachments.map(a => a.name).join(' ')}`
					.toLowerCase()
					.includes(q)) &&
			(lens === 'Media'
				? m.attachments.length > 0
				: lens === 'Links'
					? m.links.length > 0
					: lens === 'Questions'
						? /[?？]/.test(m.content)
						: lens === 'Reply map'
							? !!m.replyId || messages.some(other => other.replyId === m.id)
							: true),
	)
}
export function activeRule(
	account: WorkspaceAccount,
	context: { channelId?: string; guildId?: string; voiceId?: string },
) {
	return account.rules.find(
		r =>
			r.enabled &&
			(r.trigger === 'channel'
				? r.target === context.channelId
				: r.trigger === 'guild'
					? r.target === context.guildId
					: !!context.voiceId),
	)
}
export function wheelIndex(x: number, y: number, count: number) {
	if (
		count < 1 ||
		!Number.isFinite(x) ||
		!Number.isFinite(y) ||
		Math.hypot(x, y) < 28
	)
		return -1
	return (
		Math.round(
			(((Math.atan2(y, x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) /
				(Math.PI * 2)) *
				count,
		) % count
	)
}
export function moveWidget(items: Widget[], index: number, delta: number) {
	const next = [...items],
		target = index + delta
	if (index < 0 || target < 0 || index >= next.length || target >= next.length)
		return next
	;[next[index], next[target]] = [next[target], next[index]]
	return next
}
export function transcriptLines(value: string) {
	return value
		.split('\n')
		.slice(0, 200)
		.flatMap(line => {
			const match = line.match(/^\s*(\d{1,3}):(\d{2})\s+(.+)$/)
			return match && Number(match[2]) < 60
				? [
						{
							seconds: Number(match[1]) * 60 + Number(match[2]),
							text: match[3],
						},
					]
				: []
		})
}
export const secondsLabel = (seconds: number) =>
	`${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
export const markKey = (m: Bookmark) =>
	`${m.channelId}:${m.messageId}:${m.attachmentId}:${m.seconds}`
export function paletteFor(key: string) {
	const colors = ['#B8A1FF', '#93CCED', '#E8ABCC', '#9ACFBF', '#D8BF91']
	let hash = 0
	for (const c of key) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
	return colors[hash % colors.length]
}
