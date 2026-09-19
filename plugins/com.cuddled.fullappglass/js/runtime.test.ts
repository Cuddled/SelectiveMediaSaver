import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { DEFAULT_SETTINGS, normalize, runtime } from './core'

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
			let storageListener: (() => void) | undefined
			let resolveRead!: (value: unknown) => void
			const read = new Promise(resolve => {
				resolveRead = resolve
			})
			const originalResolve = (_theme: unknown, _token: unknown) => '#112233'
			const internal = {
				getSemanticColorName: (token: string) => token,
				resolveSemanticColor: originalResolve,
			}
			const modules: Record<string, any> = {
				'modules/user_settings/ThemeStore.tsx': {
					default: { emitChange() {} },
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
				target[key] = function (this: any, ...args: any[]) {
					return instead
						? hook.call(this, args, (...next: any[]) =>
								original.apply(this, next),
							)
						: hook(original.apply(this, args))
				}
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
			assert.ok(
				h.paths.includes('modules/themes/RootThemeContextProvider.native.tsx'),
			)
			assert.ok(h.paths.includes('modules/chat/native/Chat.android.tsx'))
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
				h.internal.resolveSemanticColor('dark', 'TEXT_STRONG'),
				'#112233',
			)
			runtime.update({ enabled: true })
			const pending = definition.start(h.api)
			h.stop()
			h.resolveRead({ enabled: true })
			await pending
			assert.equal(runtime.getSettings().enabled, false)
			assert.equal(h.internal.resolveSemanticColor, h.originalResolve)
			assert.ok(h.unpatched() >= 2)
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
