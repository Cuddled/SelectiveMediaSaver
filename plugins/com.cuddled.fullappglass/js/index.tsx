import { applyNativeChatColors } from '../../com.cuddled.liquidglass/js/chatAppearance'
import {
	applyProfileGlassToColors,
	applyProfileGlassToGradient,
} from '../../com.cuddled.liquidglass/js/core'
import { deferLateRuntime } from '../../com.cuddled.liquidglass/js/runtime'
import { createMainTabsWallpaper } from '../../com.cuddled.liquidglass/js/wallpaper'
import {
	asGlass,
	DEFAULT_SETTINGS,
	navigationTheme,
	normalize,
	palette,
	runtime,
	surfaceColor,
} from './core'
import { createNativeThemeSync } from './nativeTheme'
import { createPolish } from './polish'
import { profileControlColor, profileSemanticContext } from './profileAccents'
import { readableReplies } from './replies'
import SettingsPage from './Settings'
import { createSurfaces } from './surfaces'
import type { Settings } from './core'

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
			if (activeGeneration === currentGeneration) activeGeneration = 0
			runtime.update({ ...runtime.getSettings(), enabled: false })
			colors = {}
			refresh()
		}
		api.cleanup(shutdown)
		runtime.update(api.jsonStorage.cache)
		refresh()
		api.cleanup(runtime.subscribe(refresh))
		api.cleanup(
			api.jsonStorage.subscribe(() => {
				if (alive) runtime.update(api.jsonStorage.cache)
			}),
		)
		const React = revenge.react.React
		const access = { ...runtime, isActive: () => alive }
		const surfaces = createSurfaces(React, revenge.react.ReactNative, access)
		const polish = createPolish(React, revenge.react.ReactNative.View, access)
		const chat = createMainTabsWallpaper(React, revenge.react.ReactNative, {
			...access,
			getSettings: () => asGlass(runtime.getSettings()),
		})
		api.cleanup(() => {
			surfaces.dispose()
			polish.dispose()
			chat.dispose()
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
				runtime.subscribe,
				runtime.getSnapshot,
				runtime.getSnapshot,
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
