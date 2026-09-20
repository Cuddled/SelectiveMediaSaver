import { hexWithAlpha } from '../../com.cuddled.liquidglass/js/core'
import {
	ABSOLUTE_FILL,
	WALLPAPER_SOURCE,
} from '../../com.cuddled.liquidglass/js/wallpaper'
import { Atmosphere } from './Atmosphere'
import { runtime } from './core'
import { MOODS } from './experience'
import { saveSettings } from './settingsWriter'
import { getStudioData } from './studioData'
import { WorkspacePlayer } from './WorkspacePlayer'
import { getWorkspaceData } from './workspaceData'
import {
	emptyAccount,
	filterMessages,
	MOOD_IDS,
	markKey,
	moveWidget,
	secondsLabel,
	TOOL_NAMES,
	WIDGETS,
	wheelIndex,
} from './workspaceModel'
import type { ReactNode } from 'react'
import type { WorkspaceData } from './workspaceData'
import type {
	Attachment,
	Bookmark,
	Lens,
	MediaMark,
	Rule,
	SceneMood,
	Session,
	Tool,
	WorkspaceAccount,
	WorkspaceMessage,
} from './workspaceModel'

const ink = '#F7F8FF',
	muted = '#B6BCD1'
const uid = () =>
	`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
function Text({
	children,
	large = false,
	subtle = false,
}: {
	children: ReactNode
	large?: boolean
	subtle?: boolean
}) {
	const T = revenge.react.ReactNative.Text
	return (
		<T
			style={{
				color: subtle ? muted : ink,
				fontSize: large ? 21 : 14,
				lineHeight: large ? 28 : 22,
				fontWeight: large ? '700' : '400',
			}}
		>
			{children}
		</T>
	)
}
function Box({ children }: { children: ReactNode }) {
	const V = revenge.react.ReactNative.View
	const settings = getStudioData()?.effectiveSettings() ?? runtime.getSettings()
	return (
		<V
			style={{
				padding: 16,
				gap: 12,
				borderRadius: 23,
				borderWidth: 1,
				borderColor: hexWithAlpha(settings.accentColor, 0.25),
				backgroundColor: hexWithAlpha(settings.panelColor, 0.94),
			}}
		>
			{children}
		</V>
	)
}
function Row({ children }: { children: ReactNode }) {
	const V = revenge.react.ReactNative.View
	return (
		<V
			style={{
				flexDirection: 'row',
				flexWrap: 'wrap',
				alignItems: 'center',
				gap: 8,
			}}
		>
			{children}
		</V>
	)
}
function Button({
	children,
	onPress,
	selected = false,
	disabled = false,
	onLongPress,
}: {
	children: ReactNode
	onPress(): void
	selected?: boolean
	disabled?: boolean
	onLongPress?(): void
}) {
	const { Pressable, Text } = revenge.react.ReactNative
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected, disabled }}
			onPress={onPress}
			onLongPress={onLongPress}
			disabled={disabled}
			style={{
				minHeight: 44,
				paddingHorizontal: 13,
				paddingVertical: 10,
				borderRadius: 13,
				borderWidth: 1,
				borderColor: selected ? '#C9B8FF' : '#FFFFFF20',
				backgroundColor: selected ? '#51456F' : '#242B40',
				opacity: disabled ? 0.4 : 1,
				justifyContent: 'center',
			}}
		>
			<Text style={{ fontSize: 13, fontWeight: '600', color: ink }}>
				{children}
			</Text>
		</Pressable>
	)
}
function Input({
	label,
	value,
	onChange,
	multiline = false,
	max = 200,
}: {
	label: string
	value: string
	onChange(v: string): void
	multiline?: boolean
	max?: number
}) {
	const { TextInput, View } = revenge.react.ReactNative
	return (
		<View style={{ gap: 6 }}>
			<Text subtle>{label}</Text>
			<TextInput
				accessibilityLabel={label}
				placeholder={label}
				placeholderTextColor="#9FA8C2"
				value={value}
				onChangeText={onChange}
				multiline={multiline}
				maxLength={max}
				autoCapitalize="sentences"
				style={{
					color: ink,
					fontSize: 16,
					lineHeight: 24,
					padding: 12,
					borderRadius: 13,
					borderWidth: 1,
					borderColor: '#FFFFFF25',
					backgroundColor: '#111728',
					minHeight: multiline ? 112 : 46,
					textAlignVertical: 'top',
				}}
			/>
		</View>
	)
}
function Choices<T extends string>({
	values,
	value,
	select,
}: {
	values: readonly T[]
	value: T
	select(v: T): void
}) {
	return (
		<Row>
			{values.map(item => (
				<Button
					key={item}
					selected={item === value}
					onPress={() => select(item)}
				>
					{item}
				</Button>
			))}
		</Row>
	)
}
const emptyNote = () => ({ text: '', followUp: '', done: false })
type Run = (job: () => Promise<unknown>, success?: string) => void
interface Props {
	data: WorkspaceData
	channelId: string
	account: WorkspaceAccount
	run: Run
	setTool(t: Tool): void
	selectChannel(id: string): void
	close(): void
	setPeek(id: string): void
}

function MessageCard({
	message,
	data,
	run,
	close,
	reply = false,
	onMedia,
	onSession,
}: {
	message: WorkspaceMessage
	data: WorkspaceData
	run: Run
	close(): void
	reply?: boolean
	onMedia?(a: Attachment): void
	onSession?(m: WorkspaceMessage): void
}) {
	const { View, Image } = revenge.react.ReactNative,
		[revealed, setRevealed] = revenge.react.React.useState(false)
	const mark: Bookmark = {
		channelId: message.channelId,
		messageId: message.id,
		attachmentId: '',
		seconds: 0,
		label: `${message.author} · ${message.time}`,
	}
	const saved = data.account().bookmarks.some(b => markKey(b) === markKey(mark))
	return (
		<Box>
			<Text>
				{message.author} · {message.time}
			</Text>
			{reply && message.replyId ? (
				<Text subtle>
					↳ Reply to{' '}
					{data.message(message.channelId, message.replyId)?.author ??
						'an earlier message'}
				</Text>
			) : null}
			<Text>{message.content || 'Attachment'}</Text>
			{message.attachments.map(a => (
				<View key={a.id} style={{ gap: 8 }}>
					{a.spoiler && !revealed ? (
						<Button onPress={() => setRevealed(true)}>
							Reveal spoiler attachment
						</Button>
					) : (
						<>
							{a.kind === 'image' ? (
								<Image
									source={{ uri: a.url }}
									resizeMode="contain"
									style={{ height: 170, width: '100%', borderRadius: 16 }}
								/>
							) : null}
							<Button
								onPress={() =>
									onMedia
										? onMedia(a)
										: run(async () => {
												await data.openMessage(message.channelId, message.id)
												close()
											})
								}
							>
								{a.kind === 'audio' ? 'Voice note' : a.name}
							</Button>
						</>
					)}
				</View>
			))}
			<Row>
				<Button
					onPress={() =>
						run(async () => {
							await data.openMessage(message.channelId, message.id)
							close()
						})
					}
				>
					Open message
				</Button>
				<Button
					selected={saved}
					onPress={() =>
						run(
							() =>
								data.save(a => ({
									...a,
									bookmarks: saved
										? a.bookmarks.filter(b => markKey(b) !== markKey(mark))
										: [mark, ...a.bookmarks].slice(0, 200),
								})),
							saved ? 'Bookmark removed' : 'Message bookmarked',
						)
					}
				>
					{saved ? 'Bookmarked' : 'Bookmark'}
				</Button>
				{onSession ? (
					<Button onPress={() => onSession(message)}>Save session here</Button>
				) : null}
			</Row>
		</Box>
	)
}
function Lenses(p: Props) {
	const React = revenge.react.React
	const [lens, setLens] = React.useState<Lens>('Questions'),
		[query, setQuery] = React.useState(''),
		[limit, setLimit] = React.useState(30)
	const all = p.data.messages(p.channelId),
		messages = filterMessages(all, lens, query)
	return (
		<>
			<Choices
				values={
					['Messages', 'Media', 'Links', 'Questions', 'Reply map'] as const
				}
				value={lens}
				select={value => {
					setLens(value)
					setLimit(30)
				}}
			/>
			<Input label="Search loaded messages" value={query} onChange={setQuery} />
			<Text subtle>
				{messages.length} matches · {all.length} messages loaded in Discord
				{lens === 'Questions' ? ' · Question marks identify questions' : ''}
			</Text>
			{messages
				.slice(-limit)
				.reverse()
				.map(message => (
					<MessageCard
						key={message.id}
						message={message}
						data={p.data}
						run={p.run}
						close={p.close}
						reply={lens === 'Reply map'}
						onSession={m =>
							p.run(
								() =>
									saveSession(
										p.data,
										p.channelId,
										`${m.author} · ${m.time}`,
										m.id,
										'notes',
									),
								'Session saved at this message',
							)
						}
					/>
				))}
			{messages.length > limit ? (
				<Button onPress={() => setLimit(limit + 30)}>Show 30 more</Button>
			) : null}
			{!messages.length ? (
				<Text subtle>
					Open this conversation in Discord and scroll to load messages. Lenses
					only use messages the client has loaded.
				</Text>
			) : null}
		</>
	)
}

function Peek(p: Props) {
	return (
		<>
			<Text subtle>
				Choose a loaded conversation to keep in a floating panel. Open it fully
				in Discord to reply.
			</Text>
			{p.data.conversations().map(c => (
				<Box key={c.id}>
					<Text>{c.name}</Text>
					<Text subtle>{p.data.messages(c.id).length} loaded messages</Text>
					<Button
						disabled={!p.data.canRead(c.id)}
						onPress={() => p.setPeek(c.id)}
					>
						Float this conversation
					</Button>
				</Box>
			))}
		</>
	)
}

function Media(p: Props & { voice?: boolean }) {
	const React = revenge.react.React,
		{ Image, AppState } = revenge.react.ReactNative
	const [selected, setSelected] = React.useState<{
			message: WorkspaceMessage
			attachment: Attachment
		} | null>(null),
		[query, setQuery] = React.useState(''),
		[collection, setCollection] = React.useState('All'),
		[tags, setTags] = React.useState(''),
		[album, setAlbum] = React.useState('Favorites'),
		[transcript, setTranscript] = React.useState(''),
		[start, setStart] = React.useState('0'),
		[end, setEnd] = React.useState(''),
		[reveal, setReveal] = React.useState(false),
		[page, setPage] = React.useState(0)
	const history = p.data.mediaHistory,
		search = history.snapshot(),
		ready = p.data.mediaSearchReady(),
		allowed = p.data.canRead(p.channelId)
	React.useEffect(() => {
		if (p.voice || !ready || !allowed) return
		if (!AppState.currentState || AppState.currentState === 'active')
			history.start(p.channelId)
		let resume = !!AppState.currentState && AppState.currentState !== 'active'
		const subscription = AppState.addEventListener('change', state => {
			if (state === 'active') {
				if (resume) history.start(p.channelId)
				resume = false
			} else {
				resume =
					resume || ['loading', 'waiting'].includes(history.snapshot().status)
				history.pause()
			}
		})
		return () => {
			subscription.remove()
			history.pause()
		}
	}, [history, p.channelId, p.voice, ready, allowed])
	React.useEffect(() => {
		setPage(0)
	}, [query, collection])
	const channels = [
		p.channelId,
		...p.account.media.map(m => m.channelId),
	].filter((v, i, a) => v && a.indexOf(v) === i)
	const clips = channels
		.flatMap(id =>
			(p.voice ? p.data.messages(id) : p.data.mediaMessages(id)).flatMap(
				message =>
					message.attachments
						.filter(a => (p.voice ? a.kind === 'audio' : a.kind !== 'audio'))
						.map(attachment => ({ message, attachment })),
			),
		)
		.sort(
			(a, b) =>
				b.message.id.length - a.message.id.length ||
				b.message.id.localeCompare(a.message.id),
		)
	const marks = p.account.media
	const saved = selected
		? marks.find(
				m =>
					m.channelId === selected.message.channelId &&
					m.messageId === selected.message.id &&
					m.attachmentId === selected.attachment.id,
			)
		: undefined
	const open = (item: NonNullable<typeof selected>) => {
		setSelected(item)
		setReveal(!item.attachment.spoiler)
		const m = marks.find(
			m =>
				m.attachmentId === item.attachment.id &&
				m.messageId === item.message.id,
		)
		setTags(m?.tags ?? '')
		setAlbum(m?.collection || 'Favorites')
		setTranscript(m?.transcript ?? '')
		setStart(String(m?.start ?? 0))
		setEnd(m?.end ? String(m.end) : '')
	}
	const save = (seconds = 0, bookmark = false) => {
		if (!selected) return
		const a = Number(start),
			b = end.trim() ? Number(end) : 0
		if (
			!Number.isFinite(a) ||
			a < 0 ||
			!Number.isFinite(b) ||
			b < 0 ||
			(b > 0 && b <= a)
		)
			throw new Error(
				'Use seconds for the range, with the end after the start.',
			)
		const m: MediaMark = {
			channelId: selected.message.channelId,
			messageId: selected.message.id,
			attachmentId: selected.attachment.id,
			label: selected.attachment.name,
			seconds,
			collection: album.trim(),
			tags,
			transcript,
			start: a,
			end: b,
		}
		return p.data.save(account => ({
			...account,
			media: [
				m,
				...account.media.filter(
					v => v.attachmentId !== m.attachmentId || v.messageId !== m.messageId,
				),
			].slice(0, 150),
			bookmarks: bookmark
				? [
						m,
						...account.bookmarks.filter(v => markKey(v) !== markKey(m)),
					].slice(0, 200)
				: account.bookmarks,
		}))
	}
	if (selected && p.data.canRead(selected.message.channelId))
		return (
			<>
				<Button onPress={() => setSelected(null)}>← Back to library</Button>
				<Box>
					<Text large>{selected.attachment.name}</Text>
					<Text subtle>{selected.message.author}</Text>
					{!reveal ? (
						<Button onPress={() => setReveal(true)}>
							Reveal spoiler attachment
						</Button>
					) : selected.attachment.kind === 'image' ? (
						<Image
							source={{ uri: selected.attachment.url }}
							resizeMode="contain"
							style={{ width: '100%', height: 260 }}
						/>
					) : (
						<WorkspacePlayer
							key={selected.attachment.id}
							data={p.data}
							attachment={selected.attachment}
							saved={saved}
							onSave={seconds =>
								p.run(async () => {
									await save(seconds, true)
								}, 'Moment saved')
							}
						/>
					)}
				</Box>
				<Box>
					<Input
						label="Collection"
						value={album}
						onChange={setAlbum}
						max={60}
					/>
					<Input
						label="Tags (comma separated)"
						value={tags}
						onChange={setTags}
						max={160}
					/>
					{selected.attachment.kind !== 'image' ? (
						<>
							<Input
								label="Range start (seconds)"
								value={start}
								onChange={setStart}
								max={10}
							/>
							<Input
								label="Range end (seconds, optional)"
								value={end}
								onChange={setEnd}
								max={10}
							/>
							<Text subtle>
								Save a playback range. This leaves the original file intact.
							</Text>
						</>
					) : null}
					{p.voice ? (
						<>
							<Input
								label="Your transcript · one m:ss line at a time"
								value={transcript}
								onChange={setTranscript}
								multiline
								max={12000}
							/>
							<Text subtle>
								Paste or type a transcript with timestamps to search it and jump
								to moments.
							</Text>
						</>
					) : null}
					<Button
						onPress={() =>
							p.run(async () => {
								await save(saved?.seconds ?? 0)
							}, 'Media details saved')
						}
					>
						Save details
					</Button>
					{saved ? (
						<Button
							onPress={() =>
								p.run(
									() =>
										p.data.save(a => ({
											...a,
											media: a.media.filter(
												m =>
													m.attachmentId !== saved.attachmentId ||
													m.messageId !== saved.messageId,
											),
										})),
									'Removed from collection',
								)
							}
						>
							Remove from collection
						</Button>
					) : null}
				</Box>
				<Button
					onPress={() =>
						p.run(async () => {
							await p.data.openMessage(
								selected.message.channelId,
								selected.message.id,
							)
							p.close()
						})
					}
				>
					Open original message
				</Button>
			</>
		)
	const visible = clips.filter(({ attachment, message }) => {
		const mark = marks.find(
			m =>
				m.attachmentId === attachment.id &&
				m.messageId === message.id &&
				m.channelId === message.channelId,
		)
		return (
			(collection === 'All' || mark?.collection === collection) &&
			`${attachment.name} ${message.author} ${mark?.tags ?? ''}`
				.toLowerCase()
				.includes(query.toLowerCase())
		)
	})
	const pageIndex = Math.min(
		page,
		Math.max(0, Math.ceil(visible.length / 24) - 1),
	)
	const loading =
		search.channelId === p.channelId &&
		['loading', 'waiting'].includes(search.status)
	return (
		<>
			{!p.voice ? (
				<Box>
					<Text large>
						{loading ? 'Finding your media…' : 'Conversation media'}
					</Text>
					<Text subtle>{clips.length} items available · newest first</Text>
					<Text subtle>
						{!allowed
							? 'This conversation is unavailable.'
							: !ready
								? 'Waiting for Discord’s media search to initialize…'
								: search.channelId === p.channelId
									? search.detail || 'Starting media search…'
									: 'Starting media search…'}
					</Text>
					{search.channelId === p.channelId && search.pages > 0 ? (
						<Text subtle>
							{search.pages} batches checked
							{search.total !== null
								? ` · ${search.total} matching messages reported by Discord`
								: ''}
						</Text>
					) : null}
					<Row>
						{loading ? (
							<Button onPress={() => history.pause()}>Pause loading</Button>
						) : search.channelId === p.channelId &&
							['paused', 'error'].includes(search.status) ? (
							<Button
								disabled={!ready || !allowed}
								onPress={() => history.start(p.channelId)}
							>
								Resume loading
							</Button>
						) : null}
						{search.channelId === p.channelId && search.status === 'limited' ? (
							<Button
								onPress={() => {
									setPage(0)
									history.older()
								}}
							>
								Browse older batch
							</Button>
						) : null}
						<Button
							disabled={!ready || !allowed || loading}
							onPress={() => {
								setPage(0)
								history.refresh(p.channelId)
							}}
						>
							Refresh media
						</Button>
					</Row>
				</Box>
			) : null}
			<Input
				label="Search clips, people, or tags"
				value={query}
				onChange={setQuery}
			/>
			<Choices
				values={[
					'All',
					...new Set(marks.map(m => m.collection).filter(Boolean)),
				]}
				value={collection}
				select={setCollection}
			/>
			<Text subtle>
				{p.voice
					? 'From loaded messages and your saved collections.'
					: 'Images and videos from this conversation, plus your available saved collections.'}
			</Text>
			{visible.length ? (
				<Row>
					<Button
						disabled={pageIndex === 0}
						onPress={() => setPage(pageIndex - 1)}
					>
						Previous images
					</Button>
					<Text subtle>
						{pageIndex * 24 + 1}–
						{Math.min(visible.length, (pageIndex + 1) * 24)} of {visible.length}
					</Text>
					<Button
						disabled={(pageIndex + 1) * 24 >= visible.length}
						onPress={() => setPage(pageIndex + 1)}
					>
						Next images
					</Button>
				</Row>
			) : null}
			{visible.slice(pageIndex * 24, (pageIndex + 1) * 24).map(item => (
				<Box key={`${item.message.id}:${item.attachment.id}`}>
					<Text>{item.attachment.name}</Text>
					<Text subtle>
						{item.message.author} · {item.attachment.kind}
						{item.attachment.duration
							? ` · ${secondsLabel(item.attachment.duration)}`
							: ''}
					</Text>
					{item.attachment.kind === 'image' && !item.attachment.spoiler ? (
						<Image
							source={{ uri: item.attachment.thumbnail || item.attachment.url }}
							resizeMode="cover"
							style={{ height: 130, borderRadius: 16 }}
						/>
					) : null}
					<Button onPress={() => open(item)}>
						Open {p.voice ? 'voice note' : 'media'}
					</Button>
				</Box>
			))}
			{!visible.length ? (
				<Text subtle>
					{loading
						? 'Looking for images and videos. You can stay here while older results arrive.'
						: p.voice
							? 'No voice notes loaded yet. Open a conversation containing some, then return.'
							: 'No media matches these filters yet.'}
				</Text>
			) : null}
			{marks
				.filter(
					m =>
						!clips.some(
							c =>
								c.attachment.id === m.attachmentId &&
								c.message.id === m.messageId &&
								c.message.channelId === m.channelId,
						),
				)
				.slice(0, 15)
				.map(m => (
					<Box key={`${m.messageId}:${m.attachmentId}`}>
						<Text>{m.label}</Text>
						<Text subtle>
							Saved in {m.collection || 'your library'} · Reload its message to
							refresh the media link.
						</Text>
						<Button
							onPress={() =>
								p.run(async () => {
									await p.data.openMessage(m.channelId, m.messageId)
									p.close()
								})
							}
						>
							Reload original message
						</Button>
					</Box>
				))}
		</>
	)
}

function Wheel({
	account,
	setTool,
}: {
	account: WorkspaceAccount
	setTool(t: Tool): void
}) {
	const React = revenge.react.React,
		{ View, Pressable } = revenge.react.ReactNative
	const [size, setSize] = React.useState(290),
		[hover, setHover] = React.useState(-1),
		stage = React.useRef<any>(null),
		origin = React.useRef({ x: 0, y: 0 })
	const items = account.wheel,
		hit = (event: any) =>
			wheelIndex(
				event.nativeEvent.pageX - origin.current.x - size / 2,
				event.nativeEvent.pageY - origin.current.y - size / 2,
				items.length,
			)
	return (
		<>
			<Text subtle>
				Tap a shortcut, or drag from the center and release. Hold the chat’s
				Tools button to open this wheel.
			</Text>
			<View
				ref={stage}
				onLayout={e => {
					setSize(Math.min(320, e.nativeEvent.layout.width))
					stage.current?.measureInWindow?.((x: number, y: number) => {
						origin.current = { x, y }
					})
				}}
				style={{
					height: size,
					maxWidth: 320,
					width: '100%',
					alignSelf: 'center',
					borderRadius: 160,
					borderWidth: 1,
					borderColor: '#C8B9FF66',
					backgroundColor: '#25283DEB',
				}}
				onStartShouldSetResponder={() => false}
				onMoveShouldSetResponder={() => true}
				onResponderGrant={() =>
					stage.current?.measureInWindow?.((x: number, y: number) => {
						origin.current = { x, y }
					})
				}
				onResponderMove={e => setHover(hit(e))}
				onResponderRelease={e => {
					const n = hit(e)
					setHover(-1)
					if (n >= 0) setTool(items[n])
				}}
				onResponderTerminate={() => setHover(-1)}
			>
				{items.map((tool, i) => {
					const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2,
						radius = size * 0.33
					return (
						<Pressable
							key={tool}
							accessibilityRole="button"
							accessibilityLabel={TOOL_NAMES[tool]}
							onPress={() => setTool(tool)}
							style={{
								position: 'absolute',
								left: size / 2 + Math.cos(angle) * radius - 43,
								top: size / 2 + Math.sin(angle) * radius - 28,
								width: 86,
								minHeight: 56,
								padding: 7,
								borderRadius: 15,
								backgroundColor: hover === i ? '#6B5892' : '#30354DAA',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							<Text>
								{
									{
										lenses: 'Lenses',
										peek: 'Peek',
										media: 'Media',
										wheel: 'Wheel',
										rules: 'Rules',
										notes: 'Notes',
										voice: 'Voice',
										home: 'Home',
										atmosphere: 'Scenes',
										sessions: 'Sessions',
									}[tool]
								}
							</Text>
						</Pressable>
					)
				})}
				<View
					pointerEvents="none"
					style={{
						position: 'absolute',
						left: size / 2 - 40,
						top: size / 2 - 27,
						width: 80,
						alignItems: 'center',
					}}
				>
					<Text large>✧</Text>
					<Text subtle>
						{hover < 0 ? 'Slide' : TOOL_NAMES[items[hover]].split(' ')[0]}
					</Text>
				</View>
			</View>
		</>
	)
}
function WheelSettings(p: Props) {
	const [slot, setSlot] = revenge.react.React.useState(0)
	return (
		<>
			<Wheel account={p.account} setTool={p.setTool} />
			<Box>
				<Text large>Customize shortcuts</Text>
				<Row>
					{p.account.wheel.map((tool, i) => (
						<Button key={tool} selected={slot === i} onPress={() => setSlot(i)}>
							{i + 1} · {TOOL_NAMES[tool]}
						</Button>
					))}
				</Row>
				<Text subtle>Choose a replacement for slot {slot + 1}.</Text>
				<Row>
					{(Object.keys(TOOL_NAMES) as Tool[])
						.filter(t => t !== 'wheel')
						.map(tool => (
							<Button
								key={tool}
								onPress={() =>
									p.run(
										() =>
											p.data.save(a => {
												const wheel = [...a.wheel],
													existing = wheel.indexOf(tool)
												if (existing >= 0)
													[wheel[existing], wheel[slot]] = [
														wheel[slot],
														wheel[existing],
													]
												else wheel[slot] = tool
												return { ...a, wheel }
											}),
										'Shortcut saved',
									)
								}
							>
								{TOOL_NAMES[tool]}
							</Button>
						))}
				</Row>
			</Box>
		</>
	)
}

function Rules(p: Props) {
	const React = revenge.react.React,
		[trigger, setTrigger] = React.useState<Rule['trigger']>('channel'),
		[mood, setMood] = React.useState<SceneMood>('frosted'),
		[tool, setTool] = React.useState<Tool>('media'),
		[tested, setTested] = React.useState(false)
	const context = p.data.context()
	return (
		<>
			<Box>
				<Text large>Set the mood</Text>
				<Text subtle>When I open this…</Text>
				<Choices<Rule['trigger']>
					values={['channel', 'guild', 'voice'] as const}
					value={trigger}
					select={setTrigger}
				/>
				<Text>
					{trigger === 'voice'
						? 'Any connected voice room'
						: trigger === 'guild'
							? getStudioData()
									?.guilds()
									.find(g => g.id === context.guildId)?.name ||
								'Open a server first'
							: p.data.channel(p.channelId)?.name ||
								'Open a conversation first'}
				</Text>
				<Text subtle>Apply this scene while the rule matches</Text>
				<Choices<SceneMood> values={MOOD_IDS} value={mood} select={setMood} />
				<Text subtle>Show this shortcut</Text>
				<Choices<Tool>
					values={['media', 'notes', 'lenses', 'sessions'] as const}
					value={
						(['media', 'notes', 'lenses', 'sessions'].includes(tool)
							? tool
							: 'media') as 'media' | 'notes' | 'lenses' | 'sessions'
					}
					select={setTool}
				/>
				<Row>
					<Button onPress={() => setTested(true)}>Preview rule</Button>
					<Button
						disabled={
							trigger === 'guild'
								? !context.guildId
								: trigger === 'channel'
									? !p.channelId
									: false
						}
						onPress={() =>
							p.run(
								() =>
									p.data.save(a => ({
										...a,
										rules: [
											...a.rules,
											{
												id: uid(),
												name: `${trigger === 'voice' ? 'In voice' : p.data.channel(p.channelId)?.name || 'Server'} · ${MOODS[mood].name}`,
												trigger,
												target:
													trigger === 'channel'
														? p.channelId
														: trigger === 'guild'
															? context.guildId
															: '',
												mood,
												tool,
												enabled: true,
											},
										].slice(-24),
									})),
								'Rule enabled',
							)
						}
					>
						Save rule
					</Button>
				</Row>
				{tested ? (
					<Text>
						{MOODS[mood].name} + {TOOL_NAMES[tool]} when this {trigger} matches.
						Your saved theme returns when it stops matching.
					</Text>
				) : null}
			</Box>
			{p.account.rules.map(rule => (
				<Box key={rule.id}>
					<Text>{rule.name}</Text>
					<Text subtle>
						{rule.trigger} · {MOODS[rule.mood].name} · {TOOL_NAMES[rule.tool]}
					</Text>
					<Row>
						<Button
							selected={rule.enabled}
							onPress={() =>
								p.run(() =>
									p.data.save(a => ({
										...a,
										rules: a.rules.map(r =>
											r.id === rule.id ? { ...r, enabled: !r.enabled } : r,
										),
									})),
								)
							}
						>
							{rule.enabled ? 'Enabled' : 'Paused'}
						</Button>
						<Button
							onPress={() =>
								p.run(() =>
									p.data.save(a => ({
										...a,
										rules: a.rules.filter(r => r.id !== rule.id),
									})),
								)
							}
						>
							Delete rule
						</Button>
					</Row>
				</Box>
			))}
			<Text subtle>
				First matching rule wins. Rules change local appearance and shortcuts.
			</Text>
		</>
	)
}

function Notes(p: Props) {
	const React = revenge.react.React,
		saved = p.account.notes[p.channelId] ?? emptyNote()
	const [text, setText] = React.useState(saved.text),
		[followUp, setFollowUp] = React.useState(saved.followUp),
		[tab, setTab] = React.useState('Notes')
	return (
		<>
			<Choices
				values={['Notes', 'Bookmarks', 'Follow-ups']}
				value={tab}
				select={setTab}
			/>
			{tab === 'Notes' ? (
				<Box>
					<Text large>
						{p.data.channel(p.channelId)?.name || 'Conversation'}’s notebook
					</Text>
					<Input
						label="Private notes"
						value={text}
						onChange={setText}
						multiline
						max={6000}
					/>
					<Button
						disabled={!p.channelId}
						onPress={() =>
							p.run(
								() =>
									p.data.save(a => ({
										...a,
										notes: {
											...a.notes,
											[p.channelId]: {
												...(a.notes[p.channelId] ?? emptyNote()),
												text,
											},
										},
									})),
								'Note saved',
							)
						}
					>
						Save note
					</Button>
					{p.account.notes[p.channelId] ? (
						<Button
							onPress={() =>
								revenge.react.ReactNative.Alert.alert(
									'Delete this notebook?',
									'This removes its private note and follow-up.',
									[
										{ text: 'Cancel', style: 'cancel' },
										{
											text: 'Delete',
											style: 'destructive',
											onPress: () =>
												p.run(
													() =>
														p.data.save(a => ({
															...a,
															notes: Object.fromEntries(
																Object.entries(a.notes).filter(
																	([id]) => id !== p.channelId,
																),
															),
														})),
													'Notebook deleted',
												),
										},
									],
								)
							}
						>
							Delete notebook
						</Button>
					) : null}
				</Box>
			) : tab === 'Follow-ups' ? (
				<Box>
					<Input
						label="For next time"
						value={followUp}
						onChange={setFollowUp}
						max={300}
					/>
					<Row>
						<Button
							disabled={!p.channelId}
							onPress={() =>
								p.run(
									() =>
										p.data.save(a => ({
											...a,
											notes: {
												...a.notes,
												[p.channelId]: {
													...(a.notes[p.channelId] ?? emptyNote()),
													followUp,
													done: false,
												},
											},
										})),
									'Follow-up saved',
								)
							}
						>
							Save follow-up
						</Button>
						{saved.followUp ? (
							<Button
								selected={saved.done}
								onPress={() =>
									p.run(() =>
										p.data.save(a => ({
											...a,
											notes: {
												...a.notes,
												[p.channelId]: {
													...(a.notes[p.channelId] ?? emptyNote()),
													done: !saved.done,
												},
											},
										})),
									)
								}
							>
								{saved.done ? 'Completed' : 'Mark complete'}
							</Button>
						) : null}
					</Row>
					<Text subtle>Shown when you open Tools in this conversation.</Text>
				</Box>
			) : (
				<>
					{p.account.bookmarks
						.filter(m => m.channelId === p.channelId)
						.map(m => (
							<Box key={markKey(m)}>
								<Text>
									{m.label || 'Saved message'}
									{m.seconds ? ` · ${secondsLabel(m.seconds)}` : ''}
								</Text>
								<Text subtle>
									{p.data.message(m.channelId, m.messageId)?.content ||
										'Open the original message to load its content.'}
								</Text>
								<Row>
									<Button
										onPress={() =>
											p.run(async () => {
												await p.data.openMessage(m.channelId, m.messageId)
												p.close()
											})
										}
									>
										Open message
									</Button>
									<Button
										onPress={() =>
											p.run(() =>
												p.data.save(a => ({
													...a,
													bookmarks: a.bookmarks.filter(
														v => markKey(v) !== markKey(m),
													),
												})),
											)
										}
									>
										Remove
									</Button>
								</Row>
							</Box>
						))}
					{!p.account.bookmarks.some(m => m.channelId === p.channelId) ? (
						<Text subtle>
							Bookmark messages from Conversation lenses or save a moment in
							Media Studio.
						</Text>
					) : null}
				</>
			)}
			<Text subtle>Private to this Discord account on this device.</Text>
		</>
	)
}

function HomeBuilder(p: Props) {
	const React = revenge.react.React,
		[editing, setEditing] = React.useState(false),
		[name, setName] = React.useState('My layout')
	const home = getStudioData()
	return (
		<>
			<Row>
				<Button selected={editing} onPress={() => setEditing(!editing)}>
					{editing ? 'Done editing' : 'Edit layout'}
				</Button>
				<Button
					selected={p.account.compact}
					onPress={() =>
						p.run(() => p.data.save(a => ({ ...a, compact: !a.compact })))
					}
				>
					{p.account.compact ? 'Compact cards' : 'Roomy cards'}
				</Button>
			</Row>
			{p.account.widgets.map((widget, index) => (
				<Box key={widget}>
					{editing ? (
						<Row>
							<Text>{widget}</Text>
							<Button
								disabled={index === 0}
								onPress={() =>
									p.run(() =>
										p.data.save(a => ({
											...a,
											widgets: moveWidget(a.widgets, index, -1),
										})),
									)
								}
							>
								↑
							</Button>
							<Button
								disabled={index === p.account.widgets.length - 1}
								onPress={() =>
									p.run(() =>
										p.data.save(a => ({
											...a,
											widgets: moveWidget(a.widgets, index, 1),
										})),
									)
								}
							>
								↓
							</Button>
							<Button
								onPress={() =>
									p.run(() =>
										p.data.save(a => ({
											...a,
											widgets: a.widgets.filter(v => v !== widget),
										})),
									)
								}
							>
								Remove
							</Button>
						</Row>
					) : null}
					{widget === 'friends' ? (
						<>
							<Text large>Your people</Text>
							<Row>
								{home
									?.friends()
									.slice(0, p.account.compact ? 3 : 6)
									.map(friend => (
										<Button
											key={friend.id}
											onPress={() =>
												p.run(async () => {
													await home.open('friend', friend.id)
													p.close()
												})
											}
										>
											{friend.name}
										</Button>
									))}
							</Row>
							{!home?.friends().length ? (
								<Text subtle>
									Friends appear here once Discord has loaded them.
								</Text>
							) : null}
						</>
					) : widget === 'music' ? (
						<>
							<Text large>{home?.music()?.title || 'Now playing'}</Text>
							<Text subtle>
								{home?.music()?.artist ||
									'Your Spotify activity will appear here.'}
							</Text>
							{home?.music()?.url ? (
								<Button
									onPress={() =>
										p.run(() =>
											revenge.react.ReactNative.Linking.openURL(
												home.music()!.url!,
											),
										)
									}
								>
									Open track
								</Button>
							) : null}
						</>
					) : widget === 'notes' ? (
						<>
							<Text large>Conversation notebook</Text>
							<Text>
								{(
									p.account.notes[p.channelId]?.text ||
									'Keep plans and personal context beside your chat.'
								).slice(0, p.account.compact ? 90 : 240)}
							</Text>
							<Button onPress={() => p.setTool('notes')}>Open notebook</Button>
						</>
					) : widget === 'sessions' ? (
						<>
							<Text large>Pick up where you left off</Text>
							<Text subtle>{p.account.sessions.length} saved sessions</Text>
							<Button onPress={() => p.setTool('sessions')}>
								Saved sessions
							</Button>
						</>
					) : widget === 'media' ? (
						<>
							<Text large>Your media</Text>
							<Text subtle>
								{p.account.media.length} clips and notes in collections
							</Text>
							<Button onPress={() => p.setTool('media')}>Media Studio</Button>
						</>
					) : (
						<>
							<Text large>Quick access</Text>
							<Row>
								{p.account.wheel
									.slice(0, p.account.compact ? 3 : 6)
									.map(tool => (
										<Button key={tool} onPress={() => p.setTool(tool)}>
											{TOOL_NAMES[tool]}
										</Button>
									))}
							</Row>
						</>
					)}
				</Box>
			))}
			{editing ? (
				<Box>
					<Text large>Add a widget</Text>
					<Row>
						{WIDGETS.filter(w => !p.account.widgets.includes(w)).map(widget => (
							<Button
								key={widget}
								onPress={() =>
									p.run(() =>
										p.data.save(a => ({
											...a,
											widgets: [...a.widgets, widget],
										})),
									)
								}
							>
								{widget}
							</Button>
						))}
					</Row>
					<Input label="Layout name" value={name} onChange={setName} max={60} />
					<Button
						onPress={() =>
							p.run(
								() =>
									p.data.save(a => ({
										...a,
										layouts: [
											{
												id: uid(),
												name: name.trim() || 'My layout',
												widgets: [...a.widgets],
												compact: a.compact,
											},
											...a.layouts,
										].slice(0, 8),
									})),
								'Layout saved',
							)
						}
					>
						Save this layout
					</Button>
					{p.account.layouts.map(layout => (
						<Row key={layout.id}>
							<Button
								onPress={() =>
									p.run(
										() =>
											p.data.save(a => ({
												...a,
												widgets: layout.widgets,
												compact: layout.compact,
											})),
										'Layout applied',
									)
								}
							>
								{layout.name}
							</Button>
							<Button
								onPress={() =>
									p.run(() =>
										p.data.save(a => ({
											...a,
											layouts: a.layouts.filter(l => l.id !== layout.id),
										})),
									)
								}
							>
								Delete
							</Button>
						</Row>
					))}
				</Box>
			) : null}
		</>
	)
}

function Reactive(p: Props) {
	const { View, Image } = revenge.react.ReactNative,
		home = getStudioData(),
		appearance = home?.effectiveSettings() ?? runtime.getSettings(),
		music = home?.music()
	return (
		<>
			<Choices
				values={['off', 'music', 'server', 'voice'] as const}
				value={p.account.atmosphere}
				select={atmosphere =>
					p.run(() => p.data.save(a => ({ ...a, atmosphere })))
				}
			/>
			<Box>
				<View
					style={{
						height: 180,
						borderRadius: 22,
						overflow: 'hidden',
						backgroundColor: appearance.accentColor,
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					{music?.art && p.account.atmosphere === 'music' ? (
						<Image
							source={{ uri: music.art }}
							resizeMode="cover"
							style={ABSOLUTE_FILL}
						/>
					) : (
						<Text large>✧</Text>
					)}
				</View>
				<Text large>
					{p.account.atmosphere === 'music'
						? music?.title || 'Waiting for Spotify'
						: p.account.atmosphere === 'server'
							? home?.guilds().find(g => g.id === p.data.context().guildId)
									?.name || 'Current conversation'
							: p.account.atmosphere === 'voice'
								? p.data.context().voiceId
									? 'Following voice activity'
									: 'Join a voice room to react'
								: 'Your saved theme'}
				</Text>
				<Text subtle>
					{p.account.atmosphere === 'music'
						? 'Each track gets a consistent accent inspired by its title and artist.'
						: p.account.atmosphere === 'server'
							? 'Each server gets a consistent accent blended into your Waves theme.'
							: p.account.atmosphere === 'voice'
								? 'The accent changes when someone speaks. No audio is recorded.'
								: 'Reactive color is paused.'}
				</Text>
			</Box>
			<Box>
				<Text>Blend intensity · {Math.round(p.account.intensity * 100)}%</Text>
				<Row>
					{[0.25, 0.55, 0.85].map(intensity => (
						<Button
							key={intensity}
							selected={p.account.intensity === intensity}
							onPress={() =>
								p.run(() => p.data.save(a => ({ ...a, intensity })))
							}
						>
							{Math.round(intensity * 100)}%
						</Button>
					))}
				</Row>
			</Box>
			<Text subtle>
				Focus and OLED keep their quiet appearance. Low-power mode and
				reduced-motion preferences still control animation.
			</Text>
		</>
	)
}

async function saveSession(
	data: WorkspaceData,
	channelId: string,
	name: string,
	messageId: string,
	tool: Tool,
) {
	if (!data.canRead(channelId))
		throw new Error('Open an available conversation before saving a session.')
	const settings = getStudioData()?.effectiveSettings() ?? runtime.getSettings()
	const session: Session = {
		id: uid(),
		name: name.trim() || data.channel(channelId)?.name || 'Session',
		channelId,
		messageId,
		mood: settings.studio.mood,
		wallpaper: settings.studio.wallpaper || WALLPAPER_SOURCE.uri,
		accent: settings.accentColor,
		panel: settings.panelColor,
		menu: settings.menuColor,
		darkness: settings.darkness,
		transparency: settings.transparency,
		blur: settings.blur,
		lowPower: settings.lowPower,
		savedAt: Date.now(),
		tool,
	}
	await data.save(a => ({
		...a,
		sessions: [session, ...a.sessions].slice(0, 24),
	}))
}
function Sessions(p: Props) {
	const [name, setName] = revenge.react.React.useState(''),
		messages = p.data.messages(p.channelId),
		anchor = p.data.position(p.channelId) || messages.at(-1)?.id || ''
	return (
		<>
			<Box>
				<Input label="Session name" value={name} onChange={setName} max={60} />
				<Text subtle>
					{p.data.position(p.channelId)
						? 'Save your visible message as the reading position.'
						: 'Saves the latest loaded message. Use “Save session here” in Lenses to pick another position.'}
				</Text>
				<Button
					disabled={!p.channelId}
					onPress={() =>
						p.run(
							() => saveSession(p.data, p.channelId, name, anchor, 'notes'),
							'Session saved',
						)
					}
				>
					Save current space
				</Button>
			</Box>
			{p.account.sessions.map(session => (
				<Box key={session.id}>
					<Text large>{session.name}</Text>
					<Text subtle>
						{p.data.channel(session.channelId)?.name ||
							'Unavailable conversation'}{' '}
						· {new Date(session.savedAt).toLocaleDateString()} · {session.mood}
					</Text>
					<Row>
						<Button
							disabled={!p.data.canRead(session.channelId)}
							onPress={() =>
								p.run(async () => {
									await p.data.restore(session)
									p.selectChannel(session.channelId)
									p.setTool(session.tool)
								}, 'Session restored. Close Tools to return to its message.')
							}
						>
							Resume session
						</Button>
						<Button
							onPress={() =>
								p.run(() =>
									p.data.save(a => ({
										...a,
										sessions: a.sessions.filter(s => s.id !== session.id),
									})),
								)
							}
						>
							Delete
						</Button>
					</Row>
				</Box>
			))}
			{!p.account.sessions.length ? (
				<Text subtle>
					Saved sessions restore the conversation, a message anchor, its
					notebook, and your theme.
				</Text>
			) : null}
		</>
	)
}

export function WorkspaceContent({
	data,
	channelId: initialChannelId = '',
	initialTool = 'home',
	close,
	setPeek,
}: {
	data: WorkspaceData
	channelId?: string
	initialTool?: Tool
	close(): void
	setPeek(id: string): void
}) {
	const React = revenge.react.React,
		{ View, ScrollView, Image, StatusBar } = revenge.react.ReactNative
	React.useSyncExternalStore(data.subscribe, data.getSnapshot, data.getSnapshot)
	const [tool, setTool] = React.useState<Tool>(initialTool),
		[channelId, setChannelId] = React.useState(
			initialChannelId || data.context().channelId,
		),
		[notice, setNotice] = React.useState(''),
		[error, setError] = React.useState(''),
		[busy, setBusy] = React.useState(false),
		mounted = React.useRef(true),
		pending = React.useRef(false)
	React.useEffect(
		() => () => {
			mounted.current = false
		},
		[],
	)
	const account = data.account(),
		appearance = getStudioData()?.effectiveSettings() ?? runtime.getSettings()
	const run: Run = async (job, success) => {
		if (pending.current) return
		pending.current = true
		setBusy(true)
		setError('')
		setNotice('')
		try {
			await job()
			if (mounted.current && success) setNotice(success)
		} catch (cause) {
			if (mounted.current)
				setError(
					cause instanceof Error
						? cause.message
						: 'That action could not be completed.',
				)
		} finally {
			pending.current = false
			if (mounted.current) setBusy(false)
		}
	}
	const props: Props = {
		data,
		channelId,
		account,
		run,
		setTool,
		selectChannel: setChannelId,
		close,
		setPeek,
	}
	const contextRule = data.rule(),
		follow = account.notes[channelId]
	return (
		<View
			style={{
				flex: 1,
				backgroundColor: '#0B0D17',
				paddingTop: Math.max(StatusBar?.currentHeight ?? 24, 24),
			}}
		>
			<Image
				source={{
					uri:
						appearance.studio.homeWallpaper ||
						appearance.studio.wallpaper ||
						WALLPAPER_SOURCE.uri,
				}}
				style={ABSOLUTE_FILL}
				resizeMode="cover"
				blurRadius={appearance.lowPower ? 0 : appearance.blur}
			/>
			<View
				pointerEvents="none"
				style={[ABSOLUTE_FILL, { backgroundColor: '#080C188C' }]}
			/>
			<Atmosphere settings={appearance} />
			<View style={{ padding: 16, gap: 10 }}>
				<Row>
					<View style={{ flex: 1 }}>
						<Text large>{TOOL_NAMES[tool]}</Text>
						<Text subtle>
							{data.channel(channelId)?.name || 'Your workspace'}
						</Text>
					</View>
					<Button onPress={close}>Close</Button>
				</Row>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ gap: 8 }}
				>
					{(Object.keys(TOOL_NAMES) as Tool[]).map(key => (
						<Button
							key={key}
							selected={tool === key}
							onPress={() => setTool(key)}
						>
							{TOOL_NAMES[key]}
						</Button>
					))}
				</ScrollView>
			</View>
			<ScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ padding: 16, paddingBottom: 64, gap: 16 }}
			>
				{error ? (
					<Box>
						<Text>{error}</Text>
					</Box>
				) : null}
				{notice ? <Text>{notice}</Text> : null}
				{busy ? <Text subtle>Saving…</Text> : null}
				{['lenses', 'media', 'voice', 'notes', 'sessions'].includes(tool) ? (
					<Box>
						<Text subtle>Conversation</Text>
						<Row>
							{data
								.conversations()
								.slice(0, 12)
								.map(c => (
									<Button
										key={c.id}
										selected={c.id === channelId}
										onPress={() => {
											setChannelId(c.id)
											setNotice('')
										}}
									>
										{c.name}
									</Button>
								))}
						</Row>
						{!data.canRead(channelId) ? (
							<Text subtle>
								Open this conversation in Discord first. Unavailable or
								age-gated content stays in Discord.
							</Text>
						) : null}
					</Box>
				) : null}
				{contextRule && tool === 'home' ? (
					<Button onPress={() => setTool(contextRule.tool)}>
						{contextRule.name} → {TOOL_NAMES[contextRule.tool]}
					</Button>
				) : null}
				{follow?.followUp && !follow.done && tool !== 'notes' ? (
					<Button onPress={() => setTool('notes')}>
						Follow-up: {follow.followUp}
					</Button>
				) : null}
				{tool === 'lenses' ? (
					<Lenses key={channelId} {...props} />
				) : tool === 'peek' ? (
					<Peek {...props} />
				) : tool === 'media' || tool === 'voice' ? (
					<Media
						key={`${tool}:${channelId}`}
						{...props}
						voice={tool === 'voice'}
					/>
				) : tool === 'wheel' ? (
					<WheelSettings {...props} />
				) : tool === 'rules' ? (
					<Rules {...props} />
				) : tool === 'notes' ? (
					<Notes key={channelId} {...props} />
				) : tool === 'home' ? (
					<HomeBuilder {...props} />
				) : tool === 'atmosphere' ? (
					<Reactive {...props} />
				) : (
					<Sessions {...props} />
				)}
				{tool === 'home' ? (
					<Box>
						<Text subtle>Workspace controls</Text>
						<Button
							onPress={() =>
								run(
									() =>
										saveSettings(s => ({
											workspace: { ...s.workspace, enabled: false },
										})),
									'Workspace paused',
								)
							}
						>
							Pause workspace tools
						</Button>
						<Button
							onPress={() =>
								revenge.react.ReactNative.Alert.alert(
									'Reset personal workspace?',
									'This removes this account’s local notes, bookmarks, collections, rules, and saved layouts.',
									[
										{ text: 'Cancel', style: 'cancel' },
										{
											text: 'Reset',
											style: 'destructive',
											onPress: () =>
												run(
													() => data.save(() => emptyAccount()),
													'This account’s workspace reset',
												),
										},
									],
								)
							}
						>
							Reset personal workspace
						</Button>
					</Box>
				) : null}
			</ScrollView>
		</View>
	)
}

function FloatingPeek({
	data,
	id,
	close,
}: {
	data: WorkspaceData
	id: string
	close(): void
}) {
	const { View, ScrollView } = revenge.react.ReactNative,
		[top, setTop] = revenge.react.React.useState(false),
		[error, setError] = revenge.react.React.useState('')
	const channel = data.channel(id),
		messages = data.messages(id).slice(-12).reverse()
	return (
		<View
			style={{
				position: 'absolute',
				left: 10,
				right: 10,
				...(top ? { top: 16 } : { bottom: 66 }),
				maxHeight: 350,
				borderRadius: 23,
				borderWidth: 1,
				borderColor: '#C6B4FF88',
				backgroundColor: '#161C2DF5',
				padding: 13,
				gap: 8,
				elevation: 12,
				zIndex: 20,
			}}
		>
			<Row>
				<View style={{ flex: 1 }}>
					<Text>{channel?.name || 'Conversation'}</Text>
				</View>
				<Button onPress={() => setTop(!top)}>{top ? '↓' : '↑'}</Button>
				<Button onPress={close}>Hide</Button>
			</Row>
			<ScrollView
				style={{ maxHeight: 210 }}
				contentContainerStyle={{ gap: 12 }}
			>
				{messages.map(m => (
					<View key={m.id}>
						<Text>{m.author}</Text>
						<Text subtle>
							{m.content || `${m.attachments.length} attachment(s)`}
						</Text>
					</View>
				))}
				{!messages.length ? (
					<Text subtle>
						No loaded messages. Open this conversation once to load them.
					</Text>
				) : null}
			</ScrollView>
			{error ? <Text>{error}</Text> : null}
			<Button
				onPress={() =>
					getStudioData()
						?.open('channel', id)
						.then(close)
						.catch(() => setError('This conversation could not be opened.'))
				}
			>
				Open conversation to reply
			</Button>
		</View>
	)
}

export function WorkspaceLauncher({
	channelId = '',
	dock = false,
	onNavigate,
}: {
	channelId?: string
	dock?: boolean
	onNavigate?(): void
}) {
	const React = revenge.react.React,
		{ View, Modal } = revenge.react.ReactNative,
		data = getWorkspaceData()
	React.useSyncExternalStore(
		data?.subscribe ?? runtime.subscribe,
		data?.getSnapshot ?? runtime.getSnapshot,
		data?.getSnapshot ?? runtime.getSnapshot,
	)
	const [open, setOpen] = React.useState(false),
		[initial, setInitial] = React.useState<Tool>('home')
	const peek = data?.peek() ?? ''
	const accountId = data?.accountId() ?? '',
		enabled =
			runtime.getSettings().enabled && runtime.getSettings().workspace.enabled
	React.useEffect(() => {
		setOpen(false)
	}, [accountId, enabled])
	if (
		!data ||
		!accountId ||
		(dock && (!enabled || data.context().channelId !== channelId))
	)
		return null
	const launch = (tool: Tool) => {
		setInitial(tool)
		setOpen(true)
	}
	return (
		<View
			pointerEvents={dock ? 'box-none' : undefined}
			style={dock ? ABSOLUTE_FILL : undefined}
		>
			<View
				style={
					dock ? { position: 'absolute', right: 12, bottom: 12 } : undefined
				}
			>
				<Button
					onPress={() => launch('home')}
					onLongPress={() => launch('wheel')}
				>
					{dock ? '✧ Tools' : 'Open Workspace · 10 tools'}
				</Button>
			</View>
			{!enabled && !dock ? (
				<Button
					onPress={() =>
						saveSettings(s => ({
							workspace: { ...s.workspace, enabled: true },
						})).catch(() => {})
					}
				>
					Enable workspace tools
				</Button>
			) : null}
			<Modal
				visible={open}
				animationType="none"
				presentationStyle="fullScreen"
				onRequestClose={() => setOpen(false)}
			>
				{open ? (
					<WorkspaceBoundary onClose={() => setOpen(false)}>
						<WorkspaceContent
							key={accountId}
							data={data}
							channelId={channelId}
							initialTool={initial}
							close={() => {
								setOpen(false)
								onNavigate?.()
							}}
							setPeek={id => {
								data.setPeek(id)
								setOpen(false)
								onNavigate?.()
							}}
						/>
					</WorkspaceBoundary>
				) : null}
			</Modal>
			{peek && dock ? (
				<FloatingPeek
					key={`${accountId}:${peek}`}
					data={data}
					id={peek}
					close={() => data.setPeek('')}
				/>
			) : null}
		</View>
	)
}

export const WorkspaceDock = ({ channelId }: { channelId: string }) => (
	<WorkspaceLauncher channelId={channelId} dock />
)

function WorkspaceBoundary({
	children,
	onClose,
}: {
	children: ReactNode
	onClose(): void
}) {
	const React = revenge.react.React
	const Guard = React.useMemo(
		() =>
			class extends React.Component<
				{ children: ReactNode; onClose(): void },
				{ failed: boolean }
			> {
				state = { failed: false }
				static getDerivedStateFromError() {
					return { failed: true }
				}
				componentDidCatch() {
					console.warn(
						'[FullAppGlass] A Workspace screen is unavailable on this client.',
					)
				}
				render() {
					if (!this.state.failed) return this.props.children
					const View = revenge.react.ReactNative.View
					return (
						<View
							style={{
								flex: 1,
								padding: 24,
								paddingTop: 60,
								gap: 16,
								backgroundColor: '#101524',
							}}
						>
							<Text large>This tool could not open</Text>
							<Text>
								Your personal data is saved. Close this screen and try another
								tool, or reload Discord.
							</Text>
							<Button onPress={this.props.onClose}>Close</Button>
						</View>
					)
				}
			},
		[React],
	)
	return <Guard onClose={onClose}>{children}</Guard>
}
