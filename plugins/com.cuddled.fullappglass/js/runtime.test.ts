import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import {
	DEFAULT_SETTINGS,
	normalize,
	profileButtonTheme,
	runtime,
} from './core'
import { PROFILE_ACCENT } from './profileAccents'

test('standalone lifecycle installs/restores patches, honors late activation and rejects stale startup reads', async () => {
	const globals = globalThis as any
	const oldPlugin = globals.plugin
	const oldRevenge = globals.revenge
	globals.plugin = (definition: unknown) => definition
	try {
		const definition = (await import('./index')).default as any
		function setup(reverse = true) {
			const cleanups: Array<() => void> = []
			const paths: string[] = []
			const nativeThemes: string[] = []
			let storageListener: (() => void) | undefined
			let resolveRead!: (value: unknown) => void
			const read = new Promise(resolve => {
				resolveRead = resolve
			})
			const originalResolve = (
				_theme: unknown,
				_token: unknown,
				_context?: unknown,
			) => '#112233'
			const internal = {
				getSemanticColorName: (token: string) => token,
				resolveSemanticColor: originalResolve,
			}
			const header = React.createElement(
				'View',
				{ style: { paddingTop: 16 } },
				[React.createElement('Button', { key: 'search' })],
			)
			const backdrop = React.createElement('View', {
				style: { position: 'absolute' },
				pointerEvents: 'none',
			})
			const buttons = React.createElement('Buttons', {
				onPress: () => {},
				disabled: true,
			})
			const reply = {
				id: 'parent',
				referencedMessage: {
					state: 0,
					message: { id: 'reply', textColor: -16777216 },
				},
			}
			const pathsForBeta2 = {
				header:
					'modules/channel_list_v2/native/components/ChannelListStickyHeader.tsx',
				backdrop: 'modules/user_profile/native/UserProfileFixedBackground.tsx',
				toolbar:
					'modules/main_tabs_v2/native/tabs/you/YouBannerDecorations.tsx',
				buttons: 'modules/user_profile/native/UserProfileTextButtonGroup.tsx',
				replies: 'modules/messages/native/renderer/createMessageContent.tsx',
			}
			const pathsForBeta4 = {
				input: 'modules/chat_input/native/FloatingChatInputContainer.tsx',
				account: 'modules/main_tabs_v2/native/you_bar/YouBarBackground.tsx',
				contact: 'modules/user_profile/native/UserProfileContactButtons.tsx',
				semantic: 'design/tokens/native/SemanticColorContext.native.tsx',
			}
			const pathsForBeta5 = {
				shade: 'modules/main_tabs_v2/native/you_bar/YouBarFloatingShade.tsx',
				text: 'modules/channel_list_v2/native/items/TextChannel.tsx',
				base: 'modules/guild_sidebar/native/BaseChannelItem.tsx',
				sheet: 'design/components/Sheet/native/ActionSheet.native.tsx',
				row: 'design/components/Sheet/native/ActionSheetRow.native.tsx',
				handle:
					'design/components/Sheet/native/ActionSheetHeaderBar.native.tsx',
			}
			const actionRow = Object.assign(() => header, {
				Icon: () => null,
				Group: () => null,
			})
			const account = React.createElement(() => backdrop, {
				barWidth: 330,
				backgroundColor: '#12345633',
				avatarSize: 60,
			})
			const semanticContext = {
				saturation: 1,
				contrast: 1,
				enabledExperiments: [],
				gradient: null,
			}
			const modules: Record<string, any> = {
				'modules/main_tabs_v2/native/tabs/you/YouScreen.tsx': {
					default: () => header,
				},
				'design/void/Avatar/native/Avatar.tsx': {
					default: { type: () => header },
				},
				'design/void/CutoutableAvatarImage/native/CutoutableAvatarImage.tsx': {
					default: { type: () => header },
					AVATAR_SIZE_MAP: { normal: 40 },
				},
				'modules/user_profile/native/UserProfileAvatar.tsx': {
					default: { render: () => header },
				},
				'modules/user_profile/native/UserProfileBanner.tsx': {
					default: () => header,
				},
				'modules/user_profile/native/UserProfileCard.tsx': {
					default: () => header,
				},
				'modules/user_profile/native/UserProfileSection.tsx': {
					default: () => header,
				},
				'modules/user_profile/native/UserProfileConnections.tsx': {
					UserProfileAccountConnectionsCard: () => header,
					UserProfileApplicationRoleConnectionsCard: () => header,
				},
				'design/components/TableRow/native/TableRow.native.tsx': {
					TableRowInner: () => header,
				},
				'modules/voice_panel/native/card/VoicePanelCard.tsx': {
					default: { type: () => header },
				},
				'modules/search/native/components/layout/SearchBar.tsx': {
					default: { type: { render: () => header } },
				},
				'modules/search/native/components/list/SearchListRow.tsx': {
					SearchListRow: { type: () => header },
				},
				'modules/main_tabs_v2/native/tabs/messages/MessagesHeader.tsx': {
					default: { type: () => header },
				},
				'modules/in_app_notifications/native/Notification.tsx': {
					NotificationPressable: () => header,
				},
				'design/components/Text/native/Text.tsx': {
					Text: { render: () => header },
				},
				'modules/chat_input/native/action_buttons/ChatInputActionButtonApps.tsx':
					{ default: { type: () => header } },
				'design/components/Icon/native/redesign/generated/ChatIcon.tsx': {
					ChatIcon: () => header,
				},
				[pathsForBeta5.shade]: { default: { type: () => header } },
				[pathsForBeta5.text]: { default: { type: () => header } },
				[pathsForBeta5.base]: { default: () => header },
				[pathsForBeta5.sheet]: { ActionSheet: { render: () => header } },
				[pathsForBeta5.row]: { ActionSheetRow: actionRow },
				[pathsForBeta5.handle]: { ActionSheetHeaderBar: () => header },
				[pathsForBeta4.input]: { default: () => header },
				[pathsForBeta4.account]: { default: { type: () => account } },
				[pathsForBeta4.contact]: { default: () => buttons },
				[pathsForBeta4.semantic]: {
					getSemanticColorContextFromThemeContext: () => semanticContext,
				},
				[pathsForBeta2.header]: { default: () => header },
				[pathsForBeta2.backdrop]: { default: { type: () => backdrop } },
				[pathsForBeta2.toolbar]: { default: { type: () => header } },
				[pathsForBeta2.buttons]: { default: () => buttons },
				[pathsForBeta2.replies]: { default: () => reply },
				'../discord_common/js/packages/design/components/ThemeContextProvider/ThemeContext.tsx':
					{
						ThemeContext: React.createContext({ theme: 'dark', key: 'native' }),
					},
				'modules/user_settings/ThemeStore.tsx': {
					default: { theme: 'light', emitChange() {} },
				},
				'modules/themes/native/updateTheme.tsx': {
					updateTheme(theme: string) {
						nativeThemes.push(theme)
					},
				},
				'design/components/Navigator/native/useNavigationTheme.native.tsx': {
					useNavigationTheme: () => ({
						colors: { background: '#222', card: '#333' },
						fonts: 'untouched',
					}),
				},
			}
			let unpatched = 0
			const install = (
				target: any,
				key: string,
				hook: any,
				instead: boolean,
			) => {
				const original = target[key]
				// Revenge's real patcher proxies the target and retains component statics.
				target[key] = new Proxy(original, {
					apply(fn, receiver, args) {
						return instead
							? hook.call(receiver, args, (...next: any[]) =>
									Reflect.apply(fn, receiver, next),
								)
							: hook(Reflect.apply(fn, receiver, args))
					},
				})
				return () => {
					target[key] = original
					unpatched++
				}
			}
			globals.revenge = {
				react: {
					React,
					ReactNative: { View: 'View', Image: 'Image', processColor: () => -1 },
				},
				patcher: {
					after: (a: any, b: string, c: any) => install(a, b, c, false),
					instead: (a: any, b: string, c: any) => install(a, b, c, true),
				},
				discord: {
					common: { tokens: { Tokens: { internal } } },
					utils: {
						modules: {
							finders: {
								getModuleWithImportedPath(path: string, callback: any) {
									paths.push(path)
									callback(modules[path] ?? {})
									return () => {}
								},
							},
						},
					},
				},
			}
			const api = {
				plugin: { startedLate: false, requireReload() {} },
				cleanup: (...callbacks: Array<() => void>) =>
					cleanups.push(...callbacks),
				jsonStorage: {
					cache: normalize({ enabled: true }),
					subscribe(callback: () => void) {
						storageListener = callback
						return () => {
							storageListener = undefined
						}
					},
					get: () => read,
				},
			}
			definition.init(api)
			return {
				api,
				paths,
				nativeThemes,
				modules,
				pathsForBeta2,
				pathsForBeta4,
				pathsForBeta5,
				actionRow,
				account,
				semanticContext,
				header,
				backdrop,
				buttons,
				reply,
				internal,
				originalResolve,
				resolveRead,
				storageChanged: () => storageListener?.(),
				unpatched: () => unpatched,
				stop() {
					for (const cleanup of reverse ? [...cleanups].reverse() : cleanups)
						cleanup()
				},
			}
		}
		for (const reverse of [true, false]) {
			const h = setup(reverse)
			const nativeUpdater = h.modules['modules/themes/native/updateTheme.tsx']
			assert.deepEqual(h.nativeThemes, ['dark'])
			nativeUpdater.updateTheme('midnight')
			assert.deepEqual(h.nativeThemes, ['dark', 'dark'])
			assert.equal(
				h.modules['modules/user_settings/ThemeStore.tsx'].default.theme,
				'light',
			)
			runtime.update({ enabled: true, chats: false })
			assert.equal(h.nativeThemes.at(-1), 'midnight')
			runtime.update({ enabled: true, chats: true })
			assert.equal(h.nativeThemes.at(-1), 'dark')
			assert.ok(
				h.paths.includes('modules/themes/RootThemeContextProvider.native.tsx'),
			)
			assert.ok(h.paths.includes('modules/chat/native/Chat.android.tsx'))
			for (const [path, keys] of [
				['modules/main_tabs_v2/native/tabs/you/YouScreen.tsx', ['default']],
				['design/void/Avatar/native/Avatar.tsx', ['default', 'type']],
				[
					'design/void/CutoutableAvatarImage/native/CutoutableAvatarImage.tsx',
					['default', 'type'],
				],
				[
					'modules/user_profile/native/UserProfileAvatar.tsx',
					['default', 'render'],
				],
				['modules/user_profile/native/UserProfileBanner.tsx', ['default']],
				['modules/user_profile/native/UserProfileCard.tsx', ['default']],
				['modules/user_profile/native/UserProfileSection.tsx', ['default']],
				[
					'modules/user_profile/native/UserProfileConnections.tsx',
					['UserProfileAccountConnectionsCard'],
				],
				[
					'modules/user_profile/native/UserProfileConnections.tsx',
					['UserProfileApplicationRoleConnectionsCard'],
				],
				[
					'design/components/TableRow/native/TableRow.native.tsx',
					['TableRowInner'],
				],
				[
					'modules/voice_panel/native/card/VoicePanelCard.tsx',
					['default', 'type'],
				],
				[
					'modules/search/native/components/layout/SearchBar.tsx',
					['default', 'type', 'render'],
				],
				[
					'modules/search/native/components/list/SearchListRow.tsx',
					['SearchListRow', 'type'],
				],
			] as Array<[string, string[]]>) {
				let target = h.modules[path]
				for (const key of keys.slice(0, -1)) target = target[key]
				const props = { searchContext: {}, item: {}, ref: React.createRef() }
				const result = target[keys.at(-1)!](props)
				assert.equal(result.props.original, h.header)
				assert.equal(result.props.children.props.props, props)
			}
			for (const path of Object.values(h.pathsForBeta2))
				assert.ok(h.paths.includes(path))
			for (const path of Object.values(h.pathsForBeta4))
				assert.ok(h.paths.includes(path))
			for (const path of Object.values(h.pathsForBeta5))
				assert.ok(h.paths.includes(path))
			for (const [path, key, inner] of [
				[
					'modules/main_tabs_v2/native/tabs/messages/MessagesHeader.tsx',
					'default',
					'type',
				],
				[
					'modules/in_app_notifications/native/Notification.tsx',
					'NotificationPressable',
					'',
				],
				['design/components/Text/native/Text.tsx', 'Text', 'render'],
				[
					'modules/chat_input/native/action_buttons/ChatInputActionButtonApps.tsx',
					'default',
					'type',
				],
				[
					'design/components/Icon/native/redesign/generated/ChatIcon.tsx',
					'ChatIcon',
					'',
				],
			]) {
				const props = { active: true, variant: 'code' }
				const result = inner
					? h.modules[path][key][inner](props)
					: h.modules[path][key](props)
				assert.equal(result.props.original, h.header)
				if (inner) assert.equal(result.props.children.props.props, props)
			}
			for (const [path, exportName, key] of [
				[h.pathsForBeta5.shade, 'default', 'type'],
				[h.pathsForBeta5.text, 'default', 'type'],
				[h.pathsForBeta5.sheet, 'ActionSheet', 'render'],
			] as const)
				assert.equal(
					h.modules[path][exportName][key]().props.original,
					h.header,
				)
			for (const [path, key] of [
				[h.pathsForBeta5.base, 'default'],
				[h.pathsForBeta5.row, 'ActionSheetRow'],
				[h.pathsForBeta5.handle, 'ActionSheetHeaderBar'],
			] as const)
				assert.equal(h.modules[path][key]().props.original, h.header)
			assert.equal(
				h.modules[h.pathsForBeta5.row].ActionSheetRow.Icon,
				h.actionRow.Icon,
			)
			assert.equal(
				h.modules[h.pathsForBeta5.row].ActionSheetRow.Group,
				h.actionRow.Group,
			)
			assert.equal(
				h.modules[h.pathsForBeta4.input].default().props.original,
				h.header,
			)
			const account = h.modules[h.pathsForBeta4.account].default.type()
			assert.notEqual(account.type, h.account.type)
			assert.deepEqual(account.props, h.account.props)
			assert.equal(
				h.modules[h.pathsForBeta4.contact].default().props.original,
				h.buttons,
			)
			const profile = profileButtonTheme(normalize({ enabled: true }), {
				primaryColor: 0x6030ab,
				key: 'member',
			})
			const semantic = h.modules[h.pathsForBeta4.semantic]
			const tagged = semantic.getSemanticColorContextFromThemeContext(profile)
			assert.equal(tagged[PROFILE_ACCENT], '#6030AB')
			assert.equal(
				tagged.enabledExperiments,
				h.semanticContext.enabledExperiments,
			)
			assert.equal(
				h.internal.resolveSemanticColor(
					'dark',
					'CONTROL_PRIMARY_BORDER_DEFAULT',
					tagged,
				),
				'#6030AB7F',
			)
			assert.equal(
				h.internal.resolveSemanticColor(
					'dark',
					'CONTROL_CRITICAL_PRIMARY_BACKGROUND_DEFAULT',
					tagged,
				),
				'#112233',
			)
			assert.equal(
				semantic.getSemanticColorContextFromThemeContext({ theme: 'dark' }),
				h.semanticContext,
			)
			assert.equal(
				h.internal.resolveSemanticColor(
					'dark',
					'CONTROL_PRIMARY_BORDER_DEFAULT',
					h.semanticContext,
				),
				'#112233',
			)
			assert.equal(
				h.modules[h.pathsForBeta2.header].default().props.original,
				h.header,
			)
			assert.equal(
				h.modules[h.pathsForBeta2.backdrop].default.type().props.original,
				h.backdrop,
			)
			assert.equal(
				h.modules[h.pathsForBeta2.toolbar].default.type().props.original,
				h.header,
			)
			assert.equal(
				h.modules[h.pathsForBeta2.buttons].default().props.original,
				h.buttons,
			)
			assert.equal(
				h.modules[h.pathsForBeta2.replies].default().referencedMessage.message
					.textColor,
				-1,
			)
			assert.equal(h.reply.referencedMessage.message.textColor, -16777216)
			assert.equal(
				h.internal.resolveSemanticColor('dark', 'TEXT_STRONG'),
				'#F7F8FFFF',
			)
			assert.equal(
				h.internal.resolveSemanticColor('dark', 'UNRECOGNIZED_TOKEN'),
				'#112233',
			)
			h.api.jsonStorage.cache = normalize({ enabled: false })
			h.storageChanged()
			assert.equal(
				h.internal.resolveSemanticColor(
					'dark',
					'CONTROL_PRIMARY_BORDER_DEFAULT',
					tagged,
				),
				'#112233',
			)
			assert.equal(h.nativeThemes.at(-1), 'midnight')
			assert.equal(h.modules[h.pathsForBeta2.replies].default(), h.reply)
			assert.equal(
				h.internal.resolveSemanticColor('dark', 'TEXT_STRONG'),
				'#112233',
			)
			runtime.update({ enabled: true })
			const pending = definition.start(h.api)
			h.stop()
			assert.equal(
				h.modules[
					'modules/main_tabs_v2/native/tabs/you/YouScreen.tsx'
				].default(),
				h.header,
			)
			for (const [path, exportName, inner] of [
				['design/void/Avatar/native/Avatar.tsx', 'default', 'type'],
				[
					'design/void/CutoutableAvatarImage/native/CutoutableAvatarImage.tsx',
					'default',
					'type',
				],
				[
					'modules/user_profile/native/UserProfileAvatar.tsx',
					'default',
					'render',
				],
				['modules/user_profile/native/UserProfileBanner.tsx', 'default', ''],
				['modules/user_profile/native/UserProfileCard.tsx', 'default', ''],
				['modules/user_profile/native/UserProfileSection.tsx', 'default', ''],
				[
					'modules/user_profile/native/UserProfileConnections.tsx',
					'UserProfileAccountConnectionsCard',
					'',
				],
				[
					'modules/user_profile/native/UserProfileConnections.tsx',
					'UserProfileApplicationRoleConnectionsCard',
					'',
				],
				[
					'design/components/TableRow/native/TableRow.native.tsx',
					'TableRowInner',
					'',
				],
			])
				assert.equal(
					inner
						? h.modules[path][exportName][inner]()
						: h.modules[path][exportName](),
					h.header,
				)
			assert.equal(
				h.modules[
					'modules/voice_panel/native/card/VoicePanelCard.tsx'
				].default.type(),
				h.header,
			)
			assert.equal(
				h.modules[
					'modules/search/native/components/layout/SearchBar.tsx'
				].default.type.render(),
				h.header,
			)
			assert.equal(
				h.modules[
					'modules/search/native/components/list/SearchListRow.tsx'
				].SearchListRow.type(),
				h.header,
			)
			assert.equal(
				h.modules[
					'modules/main_tabs_v2/native/tabs/messages/MessagesHeader.tsx'
				].default.type(),
				h.header,
			)
			assert.equal(
				h.modules[
					'modules/in_app_notifications/native/Notification.tsx'
				].NotificationPressable(),
				h.header,
			)
			assert.equal(
				h.modules['design/components/Text/native/Text.tsx'].Text.render(),
				h.header,
			)
			assert.equal(
				h.modules[
					'modules/chat_input/native/action_buttons/ChatInputActionButtonApps.tsx'
				].default.type(),
				h.header,
			)
			assert.equal(
				h.modules[
					'design/components/Icon/native/redesign/generated/ChatIcon.tsx'
				].ChatIcon(),
				h.header,
			)
			assert.equal(h.nativeThemes.at(-1), 'midnight')
			nativeUpdater.updateTheme('light')
			assert.equal(h.nativeThemes.at(-1), 'light')
			h.resolveRead({ enabled: true })
			await pending
			assert.equal(runtime.getSettings().enabled, false)
			assert.equal(h.internal.resolveSemanticColor, h.originalResolve)
			assert.equal(h.modules[h.pathsForBeta2.header].default(), h.header)
			assert.equal(
				h.modules[h.pathsForBeta2.backdrop].default.type(),
				h.backdrop,
			)
			assert.equal(h.modules[h.pathsForBeta2.toolbar].default.type(), h.header)
			assert.equal(h.modules[h.pathsForBeta2.buttons].default(), h.buttons)
			assert.equal(h.modules[h.pathsForBeta2.replies].default(), h.reply)
			assert.ok(h.unpatched() >= 7)
			assert.equal(h.modules[h.pathsForBeta4.input].default(), h.header)
			assert.equal(h.modules[h.pathsForBeta4.account].default.type(), h.account)
			assert.equal(h.modules[h.pathsForBeta5.text].default.type(), h.header)
			assert.equal(h.modules[h.pathsForBeta5.shade].default.type(), h.header)
			assert.equal(h.modules[h.pathsForBeta5.base].default(), h.header)
			assert.equal(
				h.modules[h.pathsForBeta5.sheet].ActionSheet.render(),
				h.header,
			)
			assert.equal(h.modules[h.pathsForBeta5.row].ActionSheetRow, h.actionRow)
			assert.equal(
				h.modules[h.pathsForBeta5.handle].ActionSheetHeaderBar(),
				h.header,
			)
			assert.equal(h.modules[h.pathsForBeta4.contact].default(), h.buttons)
			assert.equal(
				semantic.getSemanticColorContextFromThemeContext(profile),
				h.semanticContext,
			)
		}
		const h = setup()
		const pending = definition.start(h.api)
		runtime.update({ enabled: true, transparency: 0.4 })
		h.resolveRead({ enabled: true, transparency: 0.9 })
		await pending
		assert.equal(runtime.getSettings().transparency, 0.4)
		h.stop()
		let reloads = 0
		definition.init({
			plugin: { startedLate: true, requireReload: () => reloads++ },
		})
		assert.equal(reloads, 1)
	} finally {
		runtime.update(DEFAULT_SETTINGS)
		globals.plugin = oldPlugin
		globals.revenge = oldRevenge
	}
})
