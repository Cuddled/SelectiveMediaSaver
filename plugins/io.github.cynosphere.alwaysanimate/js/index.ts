import {
	activateAnimatedProfileBanner,
	animateMessageRow,
	forceAnimateProps,
	forceAvatarDecorationAnimation,
	forceGuildMemberAvatarAnimation,
	forceUserAvatarAnimation,
} from './core'

const PATHS = {
	avatar: 'design/void/Avatar/native/Avatar.tsx',
	avatarUtils: 'utils/AvatarUtils.tsx',
	guildIcon: 'modules/guild/native/GuildIcon.tsx',
	profileBanner: 'modules/user_profile/native/UserProfileBanner.tsx',
	rowGenerator: 'modules/messages/native/renderer/RowGenerator.tsx',
} as const

function watchModule(
	api: any,
	path: string,
	install: (exports: any) => void,
): void {
	let installed = false
	const unsubscribe =
		revenge.discord.utils.modules.finders.getModuleWithImportedPath<any>(
			path,
			exports => {
				if (installed) return
				installed = true
				try {
					install(exports)
				} catch (error) {
					api.plugin.reportError(error)
				}
			},
		)
	api.cleanup(unsubscribe)
}

function patchAnimateProp(api: any, exports: any): void {
	const component = exports?.default
	if (!component) return
	api.cleanup(
		revenge.react.jsxRuntime.beforeJSX(component as any, args => {
			forceAnimateProps(args[1])
			return args
		}),
	)
}

export default plugin({
	preInit(api) {
		watchModule(api, PATHS.guildIcon, exports => patchAnimateProp(api, exports))
		watchModule(api, PATHS.avatar, exports => patchAnimateProp(api, exports))

		watchModule(api, PATHS.avatarUtils, exports => {
			if (typeof exports?.getAvatarDecorationURL === 'function') {
				api.cleanup(
					revenge.patcher.before(
						exports,
						'getAvatarDecorationURL',
						forceAvatarDecorationAnimation,
					),
				)
			}
			if (typeof exports?.getUserAvatarURL === 'function') {
				api.cleanup(
					revenge.patcher.before(
						exports,
						'getUserAvatarURL',
						forceUserAvatarAnimation,
					),
				)
			}
			if (typeof exports?.getGuildMemberAvatarURLSimple === 'function') {
				api.cleanup(
					revenge.patcher.before(
						exports,
						'getGuildMemberAvatarURLSimple',
						forceGuildMemberAvatarAnimation,
					),
				)
			}
		})

		watchModule(api, PATHS.profileBanner, exports => {
			if (typeof exports?.default !== 'function') return
			api.cleanup(
				revenge.patcher.after(exports, 'default', result =>
					activateAnimatedProfileBanner(result),
				),
			)
		})

		watchModule(api, PATHS.rowGenerator, exports => {
			const prototype = exports?.default?.prototype
			if (typeof prototype?.generate !== 'function') return
			api.cleanup(
				revenge.patcher.instead(
					prototype,
					'generate',
					function (this: any, args, original) {
						return animateMessageRow(args[0], original.apply(this, args))
					},
				),
			)
		})
	},
})
