import { applyNativeChatColors } from '../../com.cuddled.liquidglass/js/chatAppearance'
import {
	applyProfileGlassToColors,
	applyProfileGlassToGradient,
} from '../../com.cuddled.liquidglass/js/core'
import { deferLateRuntime } from '../../com.cuddled.liquidglass/js/runtime'
import { WALLPAPER_SOURCE } from '../../com.cuddled.liquidglass/js/wallpaper'
import { setAtmosphereActive, setAtmosphereGradient } from './Atmosphere'
import { createChatWallpaper } from './chatWallpaper'
import {
	asGlass,
	DEFAULT_SETTINGS,
	navigationTheme,
	normalize,
	palette,
	runtime,
	surfaceColor,
} from './core'
import {
	createExperienceSurfaces,
	voiceButtonStyles,
} from './experienceSurfaces'
import { createNativeThemeSync } from './nativeTheme'
import { createPolish } from './polish'
import { profileControlColor, profileSemanticContext } from './profileAccents'
import { readableReplies } from './replies'
import SettingsPage from './Settings'
import { StudioLauncher } from './Studio'
import { createSettingsWriter, setSettingsWriter } from './settingsWriter'
import { createStudioData, setStudioData } from './studioData'
import { createStudioSurfaces, LINE_ICONS, mediaTheme } from './studioSurfaces'
import { createSurfaces } from './surfaces'
import type { Settings } from './core'
import type { ExperienceKind } from './experienceSurfaces'
import type { StudioKind } from './studioSurfaces'

type RecordAny = Record<string, any>
let generation = 0
let activeGeneration = 0

export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: { load: true, default: DEFAULT_SETTINGS },
	init(api) {
		if (deferLateRuntime(api.plugin)) return
		const currentGeneration = ++generation
		activeGeneration = currentGeneration
		let alive = true
		let colors: Record<string, string> = {}
		let themeStore: RecordAny | undefined
		const nativeTheme = createNativeThemeSync({
			isEnabled: () =>
				alive && runtime.getSettings().enabled && runtime.getSettings().chats,
			getTheme: () => themeStore?.theme,
			onError: error =>
				console.warn('[FullAppGlass] Native theme refresh skipped:', error),
		})
		const refresh = () => {
			colors = palette(runtime.getSettings())
			nativeTheme.refresh()
			try {
				themeStore?.emitChange?.()
			} catch (error) {
				console.warn('[FullAppGlass] Theme refresh skipped:', error)
			}
		}
		const shutdown = () => {
			if (!alive) return
			alive = false
			nativeTheme.stop()
			if (activeGeneration === currentGeneration) {
				setAtmosphereActive(false)
				activeGeneration = 0
			}
			runtime.update({ ...runtime.getSettings(), enabled: false })
			colors = {}
			refresh()
		}
		api.cleanup(shutdown)
		runtime.update(api.jsonStorage.cache)
		const writer = createSettingsWriter(api.jsonStorage)
		setSettingsWriter(writer)
		api.cleanup(() => {
			writer.stop()
			setSettingsWriter(undefined)
		})
		refresh()
		api.cleanup(runtime.subscribe(refresh))
		api.cleanup(
			api.jsonStorage.subscribe(() => {
				if (alive && !writer.isPending()) runtime.update(api.jsonStorage.cache)
			}),
		)
		const React = revenge.react.React
		setAtmosphereActive(true)
		const data = createStudioData()
		data.start()
		setStudioData(data)
		api.cleanup(() => {
			data.dispose()
			setStudioData(undefined)
		})
		const access = {
			...runtime,
			subscribe: data.subscribeAppearance,
			getSnapshot: data.getAppearanceSnapshot,
			getSettings: data.effectiveSettings,
			getWallpaper: (channelId?: string, scope?: 'app') =>
				scope === 'app'
					? runtime.getSettings().studio.wallpaper || WALLPAPER_SOURCE.uri
					: data.scene(channelId).wallpaper,
			isActive: () => alive,
		}
		const surfaces = createSurfaces(React, revenge.react.ReactNative, access)
		const polish = createPolish(React, revenge.react.ReactNative.View, access)
		const chat = createChatWallpaper(React, revenge.react.ReactNative, access)
		const studio = createStudioSurfaces(
			React,
			revenge.react.ReactNative,
			access,
			StudioLauncher,
		)
		const experience = createExperienceSurfaces(
			React,
			revenge.react.ReactNative,
			access,
		)
		api.cleanup(
			data.subscribeAppearance(() => {
				colors = palette(data.effectiveSettings())
				try {
					themeStore?.emitChange?.()
				} catch {
					/* Optional themed surface. */
				}
			}),
		)
		api.cleanup(() => {
			surfaces.dispose()
			polish.dispose()
			chat.dispose()
			studio.dispose()
			experience.dispose()
		})
		const watch = (path: string, install: (exports: RecordAny) => void) => {
			let installed = false
			api.cleanup(
				revenge.discord.utils.modules.finders.getModuleWithImportedPath<RecordAny>(
					path,
					exports => {
						if (installed || !alive) return
						installed = true
						try {
							install(exports)
						} catch (error) {
							console.warn(
								`[FullAppGlass] Optional patch skipped: ${path}`,
								error,
							)
						}
					},
				),
			)
		}
		const after = (
			target: RecordAny,
			key: string,
			callback: (original: any) => any,
		) => {
			if (typeof target?.[key] === 'function')
				api.cleanup(revenge.patcher.after(target as any, key, callback))
		}
		for (const [key, path, exportKey] of [
			['guilds', 'stores/GuildStore.tsx', 'default'],
			['channels', 'stores/ChannelStore.tsx', 'default'],
			['users', 'stores/UserStore.tsx', 'default'],
			['relationships', 'stores/RelationshipStore.tsx', 'default'],
			['presence', 'stores/PresenceStore.tsx', 'default'],
			['selfPresence', 'stores/SelfPresenceStore.tsx', 'default'],
			['selectedChannel', 'stores/SelectedChannelStore.tsx', 'default'],
			['selectedGuild', 'stores/SelectedGuildStore.tsx', 'default'],
			['guild', 'modules/routing/transitionToGuild.native.tsx', ''],
			['channel', 'modules/routing/transitionToChannel.tsx', ''],
			['openDM', 'actions/ChannelActionCreators.tsx', 'default'],
			['picker', 'modules/image/native/ImagePicker.tsx', 'default'],
			[
				'font',
				'../discord_common/js/packages/rtn-codegen/js/NativeFontModule.tsx',
				'default',
			],
			[
				'fontState',
				'modules/user_settings/appearance/native/FontScaleStore.tsx',
				'',
			],
		])
			watch(path, exports =>
				data.attach(key, exportKey ? exports[exportKey] : exports),
			)
		const detail = (
			path: string,
			key: string,
			inner: string | null,
			kind: StudioKind,
		) =>
			watch(path, exports => {
				const target = inner ? exports[key] : exports
				const method = inner ?? key
				if (typeof target?.[method] !== 'function') return
				api.cleanup(
					revenge.patcher.instead(
						target as any,
						method,
						function (this: any, args, original) {
							return studio.wrap(
								kind,
								Reflect.apply(original, this, args),
								args[0],
							)
						},
					),
				)
			})
		for (const [path, keys, kind] of [
			[
				'modules/voice_panel/native/card/VoicePanelCard.tsx',
				['default', 'type'],
				'call-card',
			],
			[
				'modules/calls/native/VideoBackground.tsx',
				['default', 'type'],
				'call-legacy',
			],
			[
				'modules/video_calls/native/components/CallBarAction.tsx',
				['ToggledActionButton'],
				'call-button',
			],
			[
				'modules/search/native/components/layout/SearchBar.tsx',
				['default', 'type', 'render'],
				'search-bar',
			],
			[
				'modules/search/native/components/list/SearchListRow.tsx',
				['SearchListRow', 'type'],
				'search-row',
			],
			[
				'modules/search/native/components/list/SearchListCard.tsx',
				['SearchListCardContainer'],
				'search-card',
			],
			[
				'modules/search/native/components/list/SearchListSection.tsx',
				['default', 'type'],
				'search-section',
			],
			[
				'modules/search/native/components/navigator/SearchNavigatorScreen.tsx',
				['default'],
				'search-screen',
			],
		] as Array<[string, string[], ExperienceKind]>) {
			watch(path, exports => {
				let target = exports
				for (const key of keys.slice(0, -1)) target = target?.[key]
				const method = keys[keys.length - 1]
				if (typeof target?.[method] !== 'function') return
				api.cleanup(
					revenge.patcher.instead(
						target as any,
						method,
						function (this: any, args, original) {
							return experience.wrap(
								kind,
								Reflect.apply(original, this, args),
								args[0],
							)
						},
					),
				)
			})
		}
		watch(
			'modules/voice_panel/native/controls/buttons/VoicePanelStyles.tsx',
			exports =>
				after(exports, 'useVoicePanelButtonStyles', original =>
					voiceButtonStyles(data.effectiveSettings(), original),
				),
		)
		detail(
			'modules/main_tabs_v2/native/tabs/messages/MessagesHeader.tsx',
			'default',
			'type',
			'home',
		)
		detail('modules/guilds_bar/native/GuildsBar.tsx', 'default', 'type', 'rail')
		detail(
			'modules/guilds_bar/native/GuildsBarAnimatedItemWrapper.tsx',
			'default',
			null,
			'rail-item',
		)
		detail(
			'modules/in_app_notifications/native/Notification.tsx',
			'NotificationPressable',
			null,
			'notification',
		)
		detail(
			'modules/in_app_notifications/native/NotificationContent.tsx',
			'default',
			null,
			'notification-content',
		)
		detail(
			'components_native/common/ViewEmptyState.tsx',
			'default',
			null,
			'empty-common',
		)
		detail(
			'design/void/EmptyState/native/EmptyState.tsx',
			'default',
			null,
			'empty-modern',
		)
		detail(
			'modules/main_tabs_v2/native/tabs/messages/MessagesEmptyState.tsx',
			'default',
			null,
			'empty-messages',
		)
		detail(
			'modules/main_tabs_v2/native/tabs/guilds/empty_states/ChannelsEmpty.tsx',
			'default',
			'type',
			'empty-channels',
		)
		detail('design/components/Text/native/Text.tsx', 'Text', 'render', 'text')
		detail(
			'modules/chat_input/native/action_buttons/ChatInputActionButtonGift.tsx',
			'default',
			'type',
			'gift',
		)
		detail(
			'modules/chat_input/native/action_buttons/ChatInputActionButtonApps.tsx',
			'default',
			'type',
			'apps',
		)
		for (const name of LINE_ICONS)
			watch(
				`design/components/Icon/native/redesign/generated/${name}.tsx`,
				exports =>
					after(exports, name, original => studio.wrap(name, original)),
			)
		detail(
			'modules/search/native/components/list/rows/MediaGridItem.tsx',
			'default',
			'type',
			'media-gallery',
		)
		detail(
			'modules/media_channel/native/MediaPostGridThumbnail.tsx',
			'default',
			null,
			'media-post',
		)
		watch(
			'modules/messages/native/renderer/row_data/embeds/getEmbedThemeColors.tsx',
			exports => {
				const processColor = revenge.react.ReactNative.processColor
				if (typeof processColor !== 'function') return
				for (const key of ['default', 'useEmbedThemeColors'])
					after(exports, key, original =>
						mediaTheme(data.effectiveSettings(), original, processColor),
					)
			},
		)
		watch('modules/channel_list_v2/native/items/TextChannel.tsx', exports =>
			after(exports.default, 'type', original =>
				polish.wrap('text-channel', original),
			),
		)
		watch('modules/guild_sidebar/native/BaseChannelItem.tsx', exports =>
			after(exports, 'default', original =>
				polish.wrap('base-channel', original),
			),
		)
		watch('design/components/Sheet/native/ActionSheet.native.tsx', exports =>
			after(exports.ActionSheet, 'render', original =>
				polish.wrap('sheet', original),
			),
		)
		watch('design/components/Sheet/native/ActionSheetRow.native.tsx', exports =>
			after(exports, 'ActionSheetRow', original =>
				polish.wrap('row', original),
			),
		)
		watch(
			'design/components/Sheet/native/ActionSheetHeaderBar.native.tsx',
			exports =>
				after(exports, 'ActionSheetHeaderBar', original =>
					polish.wrap('handle', original),
				),
		)
		watch('modules/user_settings/ThemeStore.tsx', exports => {
			themeStore = exports.default
			nativeTheme.refresh()
		})
		watch('modules/themes/native/updateTheme.tsx', exports => {
			if (typeof exports.updateTheme !== 'function') return
			const original = exports.updateTheme
			api.cleanup(
				revenge.patcher.instead(
					exports as any,
					'updateTheme',
					function (this: any, args, next) {
						return nativeTheme.request(args, (...values) =>
							Reflect.apply(next, this, values),
						)
					},
				),
			)
			nativeTheme.attach(theme => Reflect.apply(original, exports, [theme]))
		})
		watch('modules/themes/RootThemeContextProvider.native.tsx', exports =>
			after(exports, 'RootThemeContextProvider', surfaces.wrapRoot),
		)
		watch(
			'design/components/Navigator/native/useNavigationTheme.native.tsx',
			exports =>
				after(exports, 'useNavigationTheme', original =>
					navigationTheme(runtime.getSettings(), original),
				),
		)
		let nativeChat: unknown
		watch(
			'../discord_common/js/packages/rtn-codegen/js/ChatNativeComponent.tsx',
			exports => {
				nativeChat = exports.default
			},
		)
		watch('modules/chat/native/Chat.android.tsx', exports =>
			after(exports.default, 'render', original =>
				chat.wrapChat(original, nativeChat),
			),
		)
		watch(
			'modules/main_tabs_v2/native/channel/StandaloneChannelScreen.tsx',
			exports => after(exports.default, 'type', surfaces.wrapScreen),
		)
		watch('modules/chat_input/native/ChatInputScrimGradient.tsx', exports =>
			after(exports, 'ChatInputScrimGradient', surfaces.wrapScrim),
		)
		watch('modules/chat_input/native/FloatingChatInputContainer.tsx', exports =>
			after(exports, 'default', surfaces.wrapFloatingInput),
		)
		watch('modules/main_tabs_v2/native/you_bar/YouBarBackground.tsx', exports =>
			after(exports.default, 'type', surfaces.wrapAccountBackground),
		)
		watch(
			'modules/main_tabs_v2/native/you_bar/YouBarFloatingShade.tsx',
			exports => after(exports.default, 'type', surfaces.wrapAccountShade),
		)
		watch(
			'modules/channel_list_v2/native/components/ChannelListStickyHeader.tsx',
			exports => after(exports, 'default', surfaces.wrapListHeader),
		)
		watch(
			'modules/user_profile/native/UserProfileFixedBackground.tsx',
			exports => after(exports.default, 'type', surfaces.wrapProfileBackdrop),
		)
		watch(
			'modules/main_tabs_v2/native/tabs/you/YouBannerDecorations.tsx',
			exports => after(exports.default, 'type', surfaces.wrapProfileToolbar),
		)
		watch(
			'modules/user_profile/native/UserProfileTextButtonGroup.tsx',
			exports => after(exports, 'default', surfaces.wrapProfileButtons),
		)
		watch(
			'modules/user_profile/native/UserProfileContactButtons.tsx',
			exports => after(exports, 'default', surfaces.wrapProfileButtons),
		)
		watch('design/tokens/native/SemanticColorContext.native.tsx', exports => {
			if (typeof exports.getSemanticColorContextFromThemeContext !== 'function')
				return
			api.cleanup(
				revenge.patcher.instead(
					exports as any,
					'getSemanticColorContextFromThemeContext',
					function (this: any, args, original) {
						const result = Reflect.apply(original, this, args)
						return alive ? profileSemanticContext(args[0], result) : result
					},
				),
			)
		})
		watch(
			'modules/main_tabs_v2/native/channel/useChannelSafeAreaBottomStyles.tsx',
			exports =>
				after(exports, 'default', original => {
					const settings = runtime.getSettings()
					return settings.enabled &&
						settings.chats &&
						original &&
						typeof original === 'object' &&
						!Array.isArray(original) &&
						Object.hasOwn(original, 'backgroundColor')
						? { ...original, backgroundColor: surfaceColor(settings) }
						: original
				}),
		)
		watch(
			'modules/messages/native/renderer/resolveMessageContentColors.tsx',
			exports => {
				const processColor = revenge.react.ReactNative.processColor
				if (typeof processColor === 'function')
					after(exports, 'default', original =>
						applyNativeChatColors(
							asGlass(runtime.getSettings()),
							original,
							processColor,
						),
					)
			},
		)
		watch(
			'modules/messages/native/renderer/createMessageContent.tsx',
			exports => {
				const processColor = revenge.react.ReactNative.processColor
				if (typeof processColor === 'function')
					after(exports, 'default', original =>
						readableReplies(runtime.getSettings(), original, processColor),
					)
			},
		)
		watch(
			'modules/user_profile/hooks/native/useUserProfileColors.tsx',
			exports =>
				after(exports, 'useUserProfileColors', original =>
					applyProfileGlassToColors(asGlass(runtime.getSettings()), original),
				),
		)
		watch(
			'modules/user_profile/hooks/native/useUserProfileGradientColors.tsx',
			exports =>
				after(exports, 'useUserProfileGradientColors', original =>
					applyProfileGlassToGradient(asGlass(runtime.getSettings()), original),
				),
		)

		watch('modules/client_themes/native/ThemedGradient.tsx', exports => {
			if (typeof exports.CustomThemedGradient === 'function') {
				setAtmosphereGradient(exports.CustomThemedGradient)
				api.cleanup(() => setAtmosphereGradient(undefined))
			}
			if (typeof exports.default !== 'function') return
			function Gradient({ original, props }: { original: any; props: any }) {
				const appVisible = surfaces.useVisible()
				const chatVisible = chat.useVisible()
				React.useSyncExternalStore(
					runtime.subscribe,
					runtime.getSnapshot,
					runtime.getSnapshot,
				)
				const settings = runtime.getSettings()
				return alive &&
					settings.enabled &&
					((settings.mainScreens && appVisible) ||
						(settings.chats && chatVisible))
					? null
					: React.createElement(original, props)
			}
			api.cleanup(
				revenge.patcher.instead(exports as any, 'default', (args, original) =>
					React.createElement(Gradient, { original, props: args[0] ?? {} }),
				),
			)
		})

		// Use the same audited token resolver; never return rgba strings to Discord.
		const common = revenge.discord.common as RecordAny
		const tokens = common.tokens?.Tokens ?? common.Tokens
		const internal = tokens?.default?.internal ?? tokens?.internal
		if (
			typeof internal?.resolveSemanticColor === 'function' &&
			typeof internal?.getSemanticColorName === 'function'
		) {
			api.cleanup(
				revenge.patcher.instead(
					internal,
					'resolveSemanticColor',
					function (this: any, args, original) {
						if (alive && runtime.getSettings().enabled) {
							try {
								const name = internal.getSemanticColorName(args[1])
								const profileColor = profileControlColor(
									runtime.getSettings(),
									name,
									args[2],
								)
								if (profileColor !== undefined) return profileColor
								if (Object.hasOwn(colors, name)) return colors[name]
							} catch {
								/* Unknown tokens keep Discord's original value. */
							}
						}
						return Reflect.apply(original, this, args)
					},
				),
			)
		}

		// Re-key semantic caches without remounting navigation or changing hook order.
		let context: RecordAny | undefined
		const pending: Array<[RecordAny, string]> = []
		const patched = new WeakMap<object, Set<string>>()
		function Revision({ children }: { children?: any }) {
			const key = React.useSyncExternalStore(
				access.subscribe,
				access.getSnapshot,
				access.getSnapshot,
			)
			const parent = React.useContext(context as any) as RecordAny
			const value = React.useMemo(
				() =>
					alive && runtime.getSettings().enabled && parent
						? { ...parent, key: `${parent.key ?? ''}|fullappglass:${key}` }
						: parent,
				[parent, key],
			)
			return React.createElement(context!.Provider, { value }, children)
		}
		const patchContext = (exports: RecordAny, key: string) => {
			if (!context?.Provider || typeof exports[key] !== 'function') return
			const keys = patched.get(exports) ?? new Set<string>()
			if (keys.has(key)) return
			keys.add(key)
			patched.set(exports, keys)
			after(exports, key, original =>
				React.isValidElement<Record<string, any>>(original) &&
				original.type === context?.Provider
					? React.cloneElement(
							original,
							{},
							React.createElement(Revision, {}, original.props.children),
						)
					: original,
			)
		}
		watch(
			'../discord_common/js/packages/design/components/ThemeContextProvider/ThemeContext.tsx',
			exports => {
				context = exports.ThemeContext
				if (context?.Provider) surfaces.setThemeContext(context as any)
				for (const [target, key] of pending) patchContext(target, key)
			},
		)
		for (const [path, key] of [
			[
				'design/components/ThemeContextProvider/native/RootThemeContextProvider.native.tsx',
				'RootThemeContextProvider',
			],
			[
				'../discord_common/js/packages/design/components/ThemeContextProvider/ThemeContextProvider.tsx',
				'ThemeContextProvider',
			],
			[
				'../discord_common/js/packages/design/native.tsx',
				'ThemeContextProvider',
			],
			['design/native.tsx', 'ThemeContextProvider'],
		])
			watch(path, exports => {
				pending.push([exports, key])
				patchContext(exports, key)
			})
		api.cleanup(shutdown)
	},
	async start(api) {
		if (api.plugin.startedLate) return
		const startedGeneration = activeGeneration
		const initialSnapshot = runtime.getSnapshot()
		try {
			const saved = normalize(await api.jsonStorage.get())
			if (
				startedGeneration &&
				activeGeneration === startedGeneration &&
				runtime.getSnapshot() === initialSnapshot
			)
				runtime.update(saved)
		} catch (error) {
			console.warn('[FullAppGlass] Could not load saved appearance:', error)
		}
	},
	SettingsComponent: SettingsPage,
})
