/** Discord 347 updates its native theme separately from the React theme provider.
 * Keep its native theme aligned with our dark backdrop without saving user settings.
 * The original updater is retained so restoration also works after unpatching.
 */
export function createNativeThemeSync(access: {
	isEnabled(): boolean
	getTheme(): unknown
	onError(error: unknown): void
}) {
	let dispatch: ((theme: string) => unknown) | undefined
	let requested: string | undefined
	let applied: string | undefined
	let stopped = false
	const valid = (value: unknown): value is string =>
		typeof value === 'string' && value.length > 0
	const enabled = () => !stopped && access.isEnabled()
	function track(value: unknown, theme: string) {
		applied = theme
		// Native bridge implementations may return a promise or void.
		void Promise.resolve(value).catch(error => {
			if (applied === theme) applied = undefined
			access.onError(error)
		})
		return value
	}
	function refresh() {
		const saved = requested ?? access.getTheme()
		// Do not override until there is a known theme to restore.
		if (!dispatch || !valid(saved)) return
		const next = enabled() ? 'dark' : saved
		if (applied === next) return
		try {
			track(dispatch(next), next)
		} catch (error) {
			applied = undefined
			access.onError(error)
		}
	}
	return {
		attach(original: (theme: string) => unknown) {
			dispatch = original
			refresh()
		},
		request(args: any[], original: (...args: any[]) => unknown) {
			if (!valid(args[0])) return original(...args)
			requested = args[0]
			const next = enabled() ? 'dark' : requested
			return track(original(next, ...args.slice(1)), next)
		},
		refresh,
		stop() {
			if (stopped) return
			stopped = true
			refresh()
			dispatch = undefined
		},
	}
}
