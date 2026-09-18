import {
	backgroundFingerprintFor,
	buildSemanticOverrides,
	DEFAULT_SETTINGS,
	normalizeSettings,
	safeSemanticOverride,
	semanticFingerprintFor,
} from './core'
import { deferLateRuntime, registerRuntimePreview } from './runtime'
import Settings from './Settings'
import type { PluginApi } from '@revenge-mod/plugins/types'
import type { LiquidGlassSettings } from './types'

type GlassApi = PluginApi<{ jsonStorage: LiquidGlassSettings }>
type AnyRecord = Record<string, any>

const PATHS = {
	backgroundHook: 'modules/client_themes/native/useColorThemeBackground.tsx',
	backgroundStore: 'modules/client_themes/ClientThemesBackgroundStore.tsx',
	themeStore: 'modules/user_settings/ThemeStore.tsx',
	themedGradient: 'modules/client_themes/native/ThemedGradient.tsx',
	rootThemeProvider:
		'design/components/ThemeContextProvider/native/RootThemeContextProvider.native.tsx',
	themeContext:
		'../discord_common/js/packages/design/components/ThemeContextProvider/ThemeContext.tsx',
	themeContextProvider:
		'../discord_common/js/packages/design/components/ThemeContextProvider/ThemeContextProvider.tsx',
	commonDesignNative: '../discord_common/js/packages/design/native.tsx',
	outerDesignNative: 'design/native.tsx',
} as const

let liveSettings: LiquidGlassSettings = DEFAULT_SETTINGS
let semanticOverrides = buildSemanticOverrides(DEFAULT_SETTINGS)
let backgroundStore: AnyRecord | undefined
let themeStore: AnyRecord | undefined
let runtimeRevision = 0
let runtimeActive = false
let runtimeGeneration = 0
let cachedGradientPayload: AnyRecord | undefined
let semanticFingerprint = 'off'
const semanticFingerprintListeners = new Set<() => void>()
let backgroundFingerprint = 'off'
const backgroundFingerprintListeners = new Set<() => void>()

function subscribeSemanticFingerprint(listener: () => void): () => void {
	semanticFingerprintListeners.add(listener)
	return () => semanticFingerprintListeners.delete(listener)
}

function getSemanticFingerprint(): string {
	return semanticFingerprint
}

function subscribeBackgroundFingerprint(listener: () => void): () => void {
	backgroundFingerprintListeners.add(listener)
	return () => backgroundFingerprintListeners.delete(listener)
}

function getBackgroundFingerprint(): string {
	return backgroundFingerprint
}

function buildGradientPayload(settings: LiquidGlassSettings): AnyRecord {
	const softness = settings.lowPowerMode
		? 100
		: Math.round(settings.backgroundSoftness * 100)
	return {
		type: 'customBackgroundGradient',
		getName: () =>
			settings.selectedPreset === 'custom'
				? 'Custom Liquid Glass'
				: `${settings.selectedPreset} Liquid Glass`,
		theme: 'midnight',
		liquidGlassRevision: runtimeRevision,
		customThemeSettings: {
			colors: [...settings.gradientColors],
			gradientColorStops: [0, 50, 100],
			gradientAngle: settings.angle,
			baseMix: softness,
		},
	}
}

function notifyThemeConsumers(): void {
	try {
		backgroundStore?.emitChange?.()
	} catch (error) {
		console.warn('[LiquidGlass] background refresh skipped:', error)
	}
	try {
		themeStore?.emitChange?.()
	} catch (error) {
		console.warn('[LiquidGlass] theme refresh skipped:', error)
	}
}

function publishSemanticFingerprint(): void {
	const next = semanticFingerprintFor(liveSettings, semanticOverrides)
	if (next === semanticFingerprint) return
	semanticFingerprint = next
	for (const listener of semanticFingerprintListeners) listener()
}

function publishBackgroundFingerprint(): void {
	const next = backgroundFingerprintFor(liveSettings)
	if (next === backgroundFingerprint) return
	backgroundFingerprint = next
	for (const listener of backgroundFingerprintListeners) listener()
}

function applySnapshot(settings: LiquidGlassSettings): void {
	liveSettings = settings
	semanticOverrides = buildSemanticOverrides(liveSettings)
	runtimeRevision += 1
	cachedGradientPayload = buildGradientPayload(liveSettings)
	publishSemanticFingerprint()
	publishBackgroundFingerprint()
	notifyThemeConsumers()
}

function updateSnapshot(value: unknown): void {
	applySnapshot(normalizeSettings(value))
}

function gradientPayload(): AnyRecord {
	return (cachedGradientPayload ??= buildGradientPayload(liveSettings))
}

function settingsChanged(before: unknown, after: LiquidGlassSettings): boolean {
	try {
		return JSON.stringify(before) !== JSON.stringify(after)
	} catch {
		return true
	}
}

function watchModule(
	api: { cleanup: (...cleanups: Array<() => any>) => void },
	path: string,
	install: (exports: AnyRecord) => void,
): void {
	let installed = false
	const unsubscribe =
		revenge.discord.utils.modules.finders.getModuleWithImportedPath<AnyRecord>(
			path,
			exports => {
				if (installed) return
				installed = true
				try {
					install(exports)
				} catch (error) {
					console.warn(
						`[LiquidGlass] optional patch failed for ${path}:`,
						error,
					)
				}
			},
		)
	api.cleanup(unsubscribe)
}

function installSemanticRevisionBoundary(api: any): void {
	let themeContextModule: AnyRecord | undefined
	let SemanticRevisionBoundary: any
	const pendingTargets: Array<{ exports: AnyRecord; key: string }> = []
	const patchedTargets = new WeakMap<AnyRecord, Set<string>>()

	const patchTarget = (exports: AnyRecord, key: string) => {
		const ThemeContext = themeContextModule?.ThemeContext
		if (
			!ThemeContext?.Provider ||
			!SemanticRevisionBoundary ||
			typeof exports?.[key] !== 'function'
		) {
			return
		}
		let keys = patchedTargets.get(exports)
		if (!keys) {
			keys = new Set()
			patchedTargets.set(exports, keys)
		}
		if (keys.has(key)) return
		keys.add(key)

		const React = revenge.react.React
		api.cleanup(
			revenge.patcher.after(exports as any, key, (result: any) => {
				if (
					!React.isValidElement(result) ||
					(result as any).type !== ThemeContext.Provider
				) {
					return result
				}
				const children = (result as any).props?.children
				if (
					React.isValidElement(children) &&
					(children as any).type === SemanticRevisionBoundary
				) {
					return result
				}
				return React.cloneElement(
					result as any,
					undefined,
					React.createElement(SemanticRevisionBoundary, null, children),
				)
			}),
		)
	}

	const patchPendingTargets = () => {
		for (const target of pendingTargets) {
			patchTarget(target.exports, target.key)
		}
	}

	const registerTarget = (exports: AnyRecord, key: string) => {
		pendingTargets.push({ exports, key })
		patchTarget(exports, key)
	}

	watchModule(api, PATHS.rootThemeProvider, exports => {
		registerTarget(exports, 'RootThemeContextProvider')
	})
	watchModule(api, PATHS.themeContext, exports => {
		themeContextModule = exports
		const ThemeContext = exports?.ThemeContext
		if (!ThemeContext?.Provider || SemanticRevisionBoundary) return

		const React = revenge.react.React
		SemanticRevisionBoundary = function SemanticRevisionBoundary({
			children,
		}: {
			children?: any
		}) {
			const fingerprint = React.useSyncExternalStore(
				subscribeSemanticFingerprint,
				getSemanticFingerprint,
				getSemanticFingerprint,
			)
			const parent = React.useContext(ThemeContext) as AnyRecord | undefined
			const value = React.useMemo(() => {
				if (fingerprint === 'off' || !parent) return parent
				return {
					...parent,
					key: `${String(parent.key ?? '')}|liquidglass:${fingerprint}`,
				}
			}, [fingerprint, parent])

			if (!value) return children
			return React.createElement(ThemeContext.Provider, { value }, children)
		}
		patchPendingTargets()
	})
	watchModule(api, PATHS.themeContextProvider, exports => {
		registerTarget(exports, 'ThemeContextProvider')
	})
	watchModule(api, PATHS.commonDesignNative, exports => {
		registerTarget(exports, 'ThemeContextProvider')
	})
	watchModule(api, PATHS.outerDesignNative, exports => {
		registerTarget(exports, 'ThemeContextProvider')
	})
}

function installBackgroundPatches(api: any): void {
	watchModule(api, PATHS.backgroundStore, exports => {
		const store = exports?.default as AnyRecord | undefined
		if (!store) return
		backgroundStore = store

		const ownDescriptor = Object.getOwnPropertyDescriptor(
			store,
			'gradientPreset',
		)
		let inheritedDescriptor: PropertyDescriptor | undefined
		let prototype = Object.getPrototypeOf(store)
		while (!ownDescriptor && prototype && !inheritedDescriptor) {
			inheritedDescriptor = Object.getOwnPropertyDescriptor(
				prototype,
				'gradientPreset',
			)
			prototype = Object.getPrototypeOf(prototype)
		}
		const nativeDescriptor = ownDescriptor ?? inheritedDescriptor
		let nativeValue: any
		let cachedNativePreset: any
		let cachedCustomPayload: AnyRecord | undefined
		let cachedRevisionPreset: AnyRecord | undefined
		try {
			nativeValue = Reflect.get(store, 'gradientPreset')
		} catch (error) {
			console.warn('[LiquidGlass] native gradient read skipped:', error)
		}

		const shadowDescriptor: PropertyDescriptor = {
			configurable: true,
			enumerable: nativeDescriptor?.enumerable ?? true,
			get() {
				const nativePreset = nativeDescriptor?.get
					? nativeDescriptor.get.call(store)
					: nativeValue
				if (!liveSettings.enabled || !liveSettings.backgroundEnabled) {
					return nativePreset
				}

				const customPayload = gradientPayload()
				if (
					cachedRevisionPreset &&
					cachedNativePreset === nativePreset &&
					cachedCustomPayload === customPayload
				) {
					return cachedRevisionPreset
				}

				const nativeColors = Array.isArray(nativePreset?.colors)
					? nativePreset.colors
					: undefined
				const hasValidNativeShape =
					nativePreset &&
					typeof nativePreset === 'object' &&
					nativeColors &&
					nativeColors.length >= 2 &&
					nativeColors.every(
						(item: any) =>
							typeof item?.token === 'string' && typeof item?.stop === 'number',
					)

				cachedNativePreset = nativePreset
				cachedCustomPayload = customPayload
				cachedRevisionPreset = hasValidNativeShape
					? { ...nativePreset }
					: {
							type: 'backgroundGradientPreset',
							id: nativePreset?.id,
							theme: 'midnight',
							colors: [
								{ token: 'BLACK', stop: 0 },
								{ token: 'BLACK', stop: 50 },
								{ token: 'BLACK', stop: 100 },
							],
							angle: liveSettings.angle,
							getName: () => 'Liquid Glass',
							midpointPercentage: 50,
						}
				return cachedRevisionPreset
			},
		}
		if (nativeDescriptor?.set) {
			shadowDescriptor.set = value => nativeDescriptor.set?.call(store, value)
		} else if (
			!nativeDescriptor ||
			('writable' in nativeDescriptor && nativeDescriptor.writable)
		) {
			shadowDescriptor.set = value => {
				nativeValue = value
			}
		}

		try {
			Object.defineProperty(store, 'gradientPreset', shadowDescriptor)
		} catch (error) {
			console.warn('[LiquidGlass] background store shadow skipped:', error)
		}
		api.cleanup(() => {
			try {
				if (ownDescriptor) {
					Object.defineProperty(store, 'gradientPreset', ownDescriptor)
				} else {
					Reflect.deleteProperty(store, 'gradientPreset')
				}
			} catch (error) {
				console.warn('[LiquidGlass] background store restore skipped:', error)
			}
			try {
				store.emitChange?.()
			} catch (error) {
				console.warn('[LiquidGlass] background restore refresh skipped:', error)
			}
			if (backgroundStore === store) backgroundStore = undefined
		})
	})
	watchModule(api, PATHS.themeStore, exports => {
		themeStore = exports?.default
		api.cleanup(() => {
			themeStore = undefined
		})
	})

	watchModule(api, PATHS.backgroundHook, exports => {
		if (typeof exports?.default !== 'function') return
		api.cleanup(
			revenge.patcher.after(exports as any, 'default', original => {
				if (!liveSettings.enabled || !liveSettings.backgroundEnabled) {
					return original
				}
				return gradientPayload()
			}),
		)
	})

	watchModule(api, PATHS.themedGradient, exports => {
		if (
			typeof exports?.default !== 'function' ||
			typeof exports?.CustomThemedGradient !== 'function'
		) {
			return
		}
		const React = revenge.react.React
		const CustomThemedGradient = exports.CustomThemedGradient
		function GradientBoundary({
			original,
			props,
		}: {
			original: (...args: any[]) => any
			props: AnyRecord
		}) {
			const fingerprint = React.useSyncExternalStore(
				subscribeBackgroundFingerprint,
				getBackgroundFingerprint,
				getBackgroundFingerprint,
			)
			if (fingerprint === 'off') return React.createElement(original, props)
			return React.createElement(CustomThemedGradient, {
				...props,
				customTheme: gradientPayload(),
			})
		}

		api.cleanup(
			revenge.patcher.instead(
				exports as any,
				'default',
				(_args: any[], original: (...args: any[]) => any) => {
					return React.createElement(GradientBoundary, {
						original,
						props: _args[0] ?? {},
					})
				},
			),
		)
	})
}

function installSemanticPatch(api: any): void {
	try {
		const common = revenge.discord.common as AnyRecord
		const tokens = common.tokens?.Tokens ?? common.Tokens
		const internal = tokens?.default?.internal ?? tokens?.internal
		if (
			typeof internal?.resolveSemanticColor !== 'function' ||
			typeof internal?.getSemanticColorName !== 'function'
		) {
			console.warn('[LiquidGlass] semantic token resolver is unavailable')
			return
		}

		api.cleanup(
			revenge.patcher.instead(
				internal,
				'resolveSemanticColor',
				function (this: any, args: any[], original: (...args: any[]) => any) {
					if (!liveSettings.enabled || !liveSettings.semanticEnabled) {
						return Reflect.apply(original, this, args)
					}
					let name: string | undefined
					try {
						name = internal.getSemanticColorName(args[1])
					} catch {
						return Reflect.apply(original, this, args)
					}
					return (
						safeSemanticOverride(name, semanticOverrides) ??
						Reflect.apply(original, this, args)
					)
				},
			),
		)
	} catch (error) {
		console.warn('[LiquidGlass] semantic patch skipped:', error)
	}
}

export default plugin<{ jsonStorage: LiquidGlassSettings }>({
	jsonStorage: {
		load: true,
		default: DEFAULT_SETTINGS,
	},

	init(api) {
		if (deferLateRuntime(api.plugin)) return
		runtimeActive = true
		const generation = ++runtimeGeneration
		const shutdown = () => {
			if (!runtimeActive || runtimeGeneration !== generation) return
			runtimeActive = false
			runtimeGeneration += 1
			liveSettings = { ...normalizeSettings(DEFAULT_SETTINGS), enabled: false }
			semanticOverrides = {}
			runtimeRevision += 1
			cachedGradientPayload = undefined
			publishSemanticFingerprint()
			publishBackgroundFingerprint()
			notifyThemeConsumers()
		}

		updateSnapshot(api.jsonStorage.cache)
		// Registered at both ends so shutdown precedes store disposal whether the
		// loader executes cleanup callbacks in insertion or reverse order.
		api.cleanup(shutdown)
		api.cleanup(
			registerRuntimePreview(value => {
				if (runtimeActive && runtimeGeneration === generation) {
					applySnapshot(value)
				}
			}),
		)
		installBackgroundPatches(api)
		installSemanticPatch(api)
		installSemanticRevisionBoundary(api)
		api.cleanup(
			api.jsonStorage.subscribe(() => {
				if (!runtimeActive || runtimeGeneration !== generation) return
				updateSnapshot(api.jsonStorage.cache)
			}),
		)
		api.cleanup(shutdown)
	},

	start(api: GlassApi) {
		if (api.plugin.startedLate) return
		const generation = runtimeGeneration
		void (async () => {
			try {
				const rawSettings = await api.jsonStorage.get()
				if (!runtimeActive || runtimeGeneration !== generation) return
				const normalized = normalizeSettings(rawSettings)
				updateSnapshot(normalized)
				if (settingsChanged(rawSettings, normalized)) {
					await api.jsonStorage.set(normalized, true)
					if (!runtimeActive || runtimeGeneration !== generation) return
				}
			} catch (error) {
				console.warn('[LiquidGlass] settings startup skipped:', error)
			}
		})()
	},

	SettingsComponent: Settings,
})
