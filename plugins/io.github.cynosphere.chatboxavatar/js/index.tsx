import { prependChatboxAvatar } from './core'

const PATHS = {
	avatar: 'design/void/Avatar/native/Avatar.tsx',
	chatInputActions:
		'modules/chat_input/native/action_buttons/ChatInputActions.tsx',
	showProfile: 'modules/user_profile/native/showUserProfileActionSheet.tsx',
	showStatus:
		'modules/main_tabs_v2/native/tabs/you/utils/showYouAccountActionSheet.tsx',
} as const

let Avatar: any
let showUserProfileActionSheet: ((options: any) => void) | undefined
let showStatusPicker: ((statusOnly?: boolean) => void) | undefined

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

function AvatarAction() {
	const { React } = revenge.react
	const { Pressable } = revenge.react.ReactNative
	const [, rerender] = React.useReducer((value: number) => value + 1, 0)
	const stores = revenge.discord.flux.Stores as any

	React.useEffect(() => {
		const watched = [
			stores.UserStore,
			stores.SelfPresenceStore,
			stores.SelectedChannelStore,
			stores.ChannelStore,
		].filter(Boolean)
		for (const store of watched) store.addChangeListener?.(rerender)
		return () => {
			for (const store of watched) store.removeChangeListener?.(rerender)
		}
	}, [rerender, stores])

	const user = stores.UserStore?.getCurrentUser?.()
	const status = stores.SelfPresenceStore?.getStatus?.()
	const channelId =
		stores.SelectedChannelStore?.getCurrentlySelectedChannelId?.()
	const channel = stores.ChannelStore?.getChannel?.(channelId)
	if (!user || !Avatar) return null

	const openProfile = () =>
		showUserProfileActionSheet?.({
			userId: user.id,
			channelId: channel?.id ?? channelId,
		})

	const openStatus = () => {
		revenge.discord.actions.ActionSheetActionCreators.hideActionSheet()
		showStatusPicker?.(true)
	}

	return (
		<Pressable
			style={{
				height: 40,
				width: 40,
				marginHorizontal: 4,
				flexShrink: 0,
				flexDirection: 'row',
				alignItems: 'center',
				justifyContent: 'center',
			}}
			onLongPress={openStatus}
			onPress={openProfile}
		>
			<Avatar
				user={user}
				guildId={channel?.guild_id}
				status={status}
				avatarDecoration={user.avatarDecoration}
				autoStatusCutout={true}
				animate={true}
			/>
		</Pressable>
	)
}

function patchChatInput(api: any, exports: any): void {
	const component = exports?.default
	const forwardRef = component?.type
	const owner =
		forwardRef && typeof forwardRef.render === 'function'
			? forwardRef
			: component && typeof component.render === 'function'
				? component
				: undefined
	if (!owner) return

	api.cleanup(
		revenge.patcher.after(owner, 'render', result =>
			prependChatboxAvatar(
				result,
				revenge.react.React.createElement(AvatarAction, {
					key: 'classic-chatbox-avatar',
				}),
			),
		),
	)
}

export default plugin({
	preInit(api) {
		watchModule(api, PATHS.avatar, exports => {
			Avatar = exports?.default
		})
		watchModule(api, PATHS.showProfile, exports => {
			showUserProfileActionSheet = exports?.default
		})
		watchModule(api, PATHS.showStatus, exports => {
			showStatusPicker = exports?.showYouAccountActionSheet
		})
		watchModule(api, PATHS.chatInputActions, exports =>
			patchChatInput(api, exports),
		)

		api.cleanup(() => {
			Avatar = undefined
			showUserProfileActionSheet = undefined
			showStatusPicker = undefined
		})
	},
})
