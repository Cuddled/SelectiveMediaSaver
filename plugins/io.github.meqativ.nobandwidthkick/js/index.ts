import { suppressDisconnectCallback } from './core'

const TIMERS_PATH = '../discord_common/js/packages/timers/Timers.tsx'

export default plugin({
	preInit(api) {
		const unsubscribe =
			revenge.discord.utils.modules.finders.getModuleWithImportedPath<any>(
				TIMERS_PATH,
				exports => {
					const prototype = exports?.Timeout?.prototype
					if (typeof prototype?.start !== 'function') return

					api.cleanup(
						revenge.patcher.before(prototype, 'start', args =>
							suppressDisconnectCallback(args as any),
						),
					)
				},
			)
		api.cleanup(unsubscribe)
	},
})
