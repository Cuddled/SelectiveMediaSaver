import { instead } from '@revenge-mod/patcher'

type TypingModule = {
	startTyping: (...args: unknown[]) => unknown
	stopTyping: (...args: unknown[]) => unknown
}

export default plugin({
	start({ cleanup }) {
		cleanup(
			revenge.discord.utils.modules.finders.getModuleWithImportedPath<{
				default: TypingModule
			}>('actions/TypingActionCreators.tsx', exports => {
				const typing = exports.default
				if (!typing) return

				cleanup(
					instead(typing, 'startTyping', () => undefined),
					instead(typing, 'stopTyping', () => undefined),
				)
			}),
		)
	},
})
