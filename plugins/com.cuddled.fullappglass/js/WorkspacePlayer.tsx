import { mediaUri, secondsLabel, transcriptLines } from './workspaceModel'
import type { WorkspaceData } from './workspaceData'
import type { Attachment, MediaMark } from './workspaceModel'

/** A local media document; no external scripts, cookies, uploads or third-party transcription. */
export function playerDocument(uri: string, audio: boolean) {
	const safe = mediaUri(uri)
	if (!safe) throw new Error('This media link is not a Discord attachment.')
	return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src https://cdn.discordapp.com https://media.discordapp.net; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'"><style>html,body{margin:0;height:100%;background:#101524;color:#eef0ff;font:15px sans-serif}body{display:grid;place-items:center}video,audio{width:100%;height:100%;object-fit:contain}audio{height:64px}</style></head><body><${audio ? 'audio' : 'video'} id="player" controls playsinline preload="metadata"></${audio ? 'audio' : 'video'}><script>const p=window.player=document.getElementById('player');const send=(type,value)=>window.ReactNativeWebView.postMessage(JSON.stringify({type,value}));p.src=${JSON.stringify(safe).replace(/</g, '\\u003c')};['loadedmetadata','timeupdate','play','pause','ended','error'].forEach(e=>p.addEventListener(e,()=>send(e,e==='loadedmetadata'?p.duration:p.currentTime)));window.setRange=(a,b)=>{window.rangeEnd=b;p.currentTime=a};p.addEventListener('timeupdate',()=>{if(window.rangeEnd>0&&p.currentTime>=window.rangeEnd)p.pause()});</script></body></html>`
}
export function WorkspacePlayer({
	data,
	attachment,
	saved,
	onSave,
}: {
	data: WorkspaceData
	attachment: Attachment
	saved?: MediaMark
	onSave(seconds: number): void
}) {
	const React = revenge.react.React,
		{ View, Text, Pressable, TextInput, AppState } = revenge.react.ReactNative
	const Web = data.webPlayer(),
		states = data.playerStates(),
		ref = React.useRef<any>(null)
	const [time, setTime] = React.useState(0),
		[duration, setDuration] = React.useState(attachment.duration),
		[rate, setRate] = React.useState(1),
		[state, setState] = React.useState(states.PAUSED),
		[error, setError] = React.useState(''),
		[query, setQuery] = React.useState('')
	const source = React.useMemo(
		() => ({
			html: playerDocument(attachment.url, attachment.kind === 'audio'),
			baseUrl: 'https://cdn.discordapp.com/',
		}),
		[attachment.url, attachment.kind],
	)
	const inject = (script: string) =>
		ref.current?.injectJavaScript?.(`${script};true;`)
	const seek = (seconds: number) =>
		inject(
			`window.player.currentTime=${Math.max(0, Math.min(duration || 86400, seconds))}`,
		)
	React.useEffect(() => {
		const subscription = AppState?.addEventListener?.('change', status => {
			if (status !== 'active')
				ref.current?.injectJavaScript?.('window.player.pause();true;')
		})
		return () => {
			subscription?.remove()
			ref.current?.injectJavaScript?.('window.player.pause();true;')
		}
	}, [AppState])
	const control = (label: string, action: () => void) => (
		<Pressable
			key={label}
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={action}
			style={{
				minHeight: 44,
				padding: 12,
				borderRadius: 12,
				backgroundColor: '#2B304A',
				justifyContent: 'center',
			}}
		>
			<Text style={{ color: '#F7F8FF' }}>{label}</Text>
		</Pressable>
	)
	if (!Web)
		return (
			<Text style={{ color: '#B6BCD1', lineHeight: 22 }}>
				Open a video once in Discord to load its media player, then return here.
				Your saved moments remain available.
			</Text>
		)
	return (
		<View style={{ gap: 12 }}>
			<Web
				ref={ref}
				style={{
					height: attachment.kind === 'audio' ? 90 : 220,
					borderRadius: 16,
					overflow: 'hidden',
				}}
				source={source}
				baseURL="https://cdn.discordapp.com/"
				playerState={state}
				injectedJavaScript="true;"
				sharedCookiesEnabled={false}
				thirdPartyCookiesEnabled={false}
				javaScriptCanOpenWindowsAutomatically={false}
				setSupportMultipleWindows={false}
				allowFileAccess={false}
				allowsInlineMediaPlayback
				mediaPlaybackRequiresUserAction
				onDataReceived={(raw: string) => {
					try {
						const event = JSON.parse(raw)
						if (event.type === 'loadedmetadata' && Number.isFinite(event.value))
							setDuration(event.value)
						if (event.type === 'timeupdate' && Number.isFinite(event.value))
							setTime(event.value)
						if (event.type === 'play') setState(states.PLAYING)
						if (event.type === 'pause' || event.type === 'ended')
							setState(states.PAUSED)
						if (event.type === 'error')
							setError(
								'The clip could not load. Reopen its message to refresh the media link.',
							)
					} catch {
						/* Ignore unrelated WebView events. */
					}
				}}
				onError={() => setError('The media player could not load.')}
			/>
			<Text style={{ color: '#B6BCD1' }}>
				{secondsLabel(time)} / {secondsLabel(duration)}
			</Text>
			<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
				{control('−10 sec', () => seek(time - 10))}
				{control(`${rate}×`, () => {
					const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1
					setRate(next)
					inject(`window.player.playbackRate=${next}`)
				})}
				{control('+10 sec', () => seek(time + 10))}
				{control('Save moment', () => onSave(time))}
			</View>
			{saved?.end
				? control(
						`Play saved range ${secondsLabel(saved.start)}–${secondsLabel(saved.end)}`,
						() =>
							inject(
								`window.setRange(${saved.start},${saved.end});window.player.play().catch(()=>{})`,
							),
					)
				: null}
			{error ? (
				<Text accessibilityRole="alert" style={{ color: '#FFC4D0' }}>
					{error}
				</Text>
			) : null}
			{saved?.transcript ? (
				<>
					<TextInput
						accessibilityLabel="Search transcript"
						placeholder="Search transcript"
						placeholderTextColor="#A6AEC6"
						value={query}
						onChangeText={setQuery}
						style={{
							color: '#F7F8FF',
							backgroundColor: '#151B2D',
							padding: 12,
							borderRadius: 12,
						}}
					/>
					{transcriptLines(saved.transcript)
						.filter(line =>
							line.text.toLowerCase().includes(query.toLowerCase()),
						)
						.map(line => (
							<Pressable
								key={`${line.seconds}:${line.text}`}
								accessibilityRole="button"
								onPress={() => seek(line.seconds)}
								style={{ paddingVertical: 12 }}
							>
								<Text style={{ color: '#D6CBFF' }}>
									{secondsLabel(line.seconds)}{' '}
									<Text style={{ color: '#E7EAF7' }}>{line.text}</Text>
								</Text>
							</Pressable>
						))}
				</>
			) : null}
		</View>
	)
}
