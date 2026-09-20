import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import * as React from 'react'
import { DEFAULT_SETTINGS } from './core'
import { runtime } from './runtime'
import { askCompression, insertAttachmentChoice } from './ui'
import type { Any } from './core'

function tree() {
	const onLayout = () => {}
	const native = [
		React.createElement('preview', { key: 'preview' }),
		null,
		React.createElement('rows', { key: 'rows' }),
		React.createElement('remove', { key: 'remove', onPress() {} }),
	]
	return React.createElement(
		'sheet',
		{ scrollable: true },
		React.createElement(
			'scroll',
			{ contentContainerStyle: { padding: 16 } },
			React.createElement('stack', { onLayout }, native),
		),
	)
}
test('attachment controls are measured inside native sheet and preserve native actions', () => {
	const before: any = tree(),
		choice = React.createElement('choice', { key: 'original-media-choice' })
	const after = insertAttachmentChoice(React, before, choice)
	const beforeStack = before.props.children.props.children
	const afterStack = after.props.children.props.children
	assert.equal(afterStack.props.onLayout, beforeStack.props.onLayout)
	assert.equal(after.props.scrollable, true)
	assert.deepEqual(afterStack.props.children, [
		...beforeStack.props.children.slice(0, 3),
		choice,
		beforeStack.props.children[3],
	])
	assert.equal(beforeStack.props.children.length, 4)
	for (const value of [
		null,
		React.createElement('unknown', { key: 'unknown' }),
		React.createElement('sheet', { key: 'sheet' }, 'text'),
	])
		assert.equal(insertAttachmentChoice(React, value, choice), value)
})

test('oversize dialogs support approve, dismiss, and abort without duplicate resolutions', async () => {
	let shown: Any | undefined,
		dismissed = 0
	;(globalThis as Any).revenge = {
		discord: {
			design: { Design: { AlertModal: 'alert', AlertActionButton: 'button' } },
			actions: {
				AlertActionCreators: {
					openAlert(key: string, element: Any, onDismiss: () => void) {
						shown = { key, element, onDismiss }
					},
					dismissAlert() {
						dismissed++
						shown?.onDismiss()
					},
				},
			},
		},
	}
	let abort = new AbortController()
	const prompt = {
		name: 'video.mp4',
		reason: 'oversize' as const,
		limit: 104857600,
	}
	let result = askCompression(prompt, abort.signal)
	assert.match(shown!.element.props.content, /100\.0 MiB/)
	shown!.element.props.actions.props.children[0].props.onPress()
	assert.equal(await result, 'compress')
	assert.equal(dismissed, 1)
	result = askCompression(prompt, abort.signal)
	shown!.onDismiss()
	assert.equal(await result, 'cancel')
	abort = new AbortController()
	result = askCompression(prompt, abort.signal)
	abort.abort()
	assert.equal(await result, 'cancel')
})

test('actual plugin hooks preserve native receivers, limits and teardown, and emit cancellation errors for staging', async () => {
	;(globalThis as Any).plugin = (value: unknown) => value
	const config = (await import('./index')).default as any
	for (const reverseCleanup of [false, true]) {
		let compressed = 0,
			copied = 0,
			transmitted = 0,
			errors = 0
		let result: Any = { ok: true, uri: 'file:///cache/original', size: 80 }
		let dialog: Any | undefined
		const cleanup: Array<() => void> = []
		const moduleWaiters = new Map<string, (module: Any) => void>()
		const subscriber = new Set<() => void>()
		class Upload extends EventEmitter {
			item: Any = {
				platform: 0,
				target: 0,
				originalUri: 'content://gallery/42',
				uri: 'content://gallery/42',
				mimeType: 'image/png',
				filename: 'photo.png',
			}
			filename = 'photo.png'
			channelId = 'a-server-channel'
			reactNativeFilePrepped = false
			_aborted = false
			currentSize = 0
			async reactNativeCompressAndExtractData(marker: string) {
				assert.ok(this instanceof Upload)
				assert.equal(marker, 'marker')
				compressed++
				this.reactNativeFilePrepped = true
				return this
			}
			async upload() {
				await this.reactNativeCompressAndExtractData('marker')
				transmitted++
			}
			cancel() {
				this._aborted = true
			}
			removeFromMsgDraft() {
				this.cancel()
			}
			handleError(message: string) {
				errors++
				this.emit('error', message)
			}
		}
		const prepareBefore = Upload.prototype.reactNativeCompressAndExtractData
		const uploadBefore = Upload.prototype.upload
		const target = {
			getMaxFileSize(channel: string) {
				assert.equal(channel, 'a-server-channel')
				return 100
			},
			get shouldReactNativeCompressUploads() {
				return true
			},
		}
		const modules: Any = {
			'lib/uploader/UploadTargets.tsx': { getUploadTarget: () => target },
			'modules/media_uploads/experiments/KestrelExperiment.tsx': {
				getKestrelConfig: () => ({ enabled: true }),
				getEffectiveKestrelLimit: (_config: Any, base: number) => base + 20,
			},
			'stores/UserStore.tsx': {
				default: {
					getCurrentUser: () => ({ id: 'account' }),
					addChangeListener() {},
					removeChangeListener() {},
				},
			},
			'lib/uploader/CloudUpload.tsx': { CloudUpload: Upload },
			'modules/media_uploads/native/UploadPreviewActionSheet.tsx': {
				default: () => tree(),
			},
		}
		;(globalThis as Any).revenge = {
			react: { React },
			modules: {
				native: {
					async callNativeMethod(name: string, args: any[]) {
						if (name.endsWith('.prepare')) {
							copied++
							assert.equal(args[2], 120)
							return result
						}
						return true
					},
				},
			},
			discord: {
				utils: {
					modules: {
						finders: {
							getModuleWithImportedPath(
								path: string,
								callback: (module: Any) => void,
							) {
								if (modules[path]) callback(modules[path])
								else moduleWaiters.set(path, callback)
								return () => {
									moduleWaiters.delete(path)
								}
							},
						},
					},
				},
				design: {
					Design: { AlertModal: 'alert', AlertActionButton: 'button' },
				},
				actions: {
					AlertActionCreators: {
						openAlert(_key: string, element: Any) {
							dialog = element
						},
						dismissAlert() {},
					},
				},
			},
			patcher: {
				instead(object: Any, key: string, callback: any) {
					const original = object[key]
					object[key] = function (this: any, ...args: any[]) {
						return callback.call(this, args, original)
					}
					return () => {
						object[key] = original
					}
				},
			},
		}
		const api = {
			cleanup: (fn: () => void) => cleanup.push(fn),
			plugin: {
				reportError(error: Error) {
					throw error
				},
			},
			jsonStorage: {
				cache: { ...DEFAULT_SETTINGS },
				subscribe: (fn: () => void) => {
					subscriber.add(fn)
					return () => {
						subscriber.delete(fn)
					}
				},
			},
		}
		config.init(api)
		const original = new Upload()
		await original.upload()
		assert.equal(copied, 1)
		assert.equal(compressed, 0)
		assert.equal(transmitted, 1)
		assert.equal(original.currentSize, 80)
		assert.equal(target.shouldReactNativeCompressUploads, true)
		const ordinary = new Upload()
		runtime.controller!.choose(ordinary, 'discord')
		await ordinary.upload()
		assert.equal(compressed, 1)
		result = { ok: false, code: 'TOO_LARGE', size: 121 }
		const tooBig = new Upload()
		tooBig.on('error', () => {})
		const canceledUpload = tooBig.upload()
		await new Promise(resolve => setImmediate(resolve))
		assert.ok(dialog)
		dialog.props.actions.props.children[1].props.onPress()
		await canceledUpload
		assert.equal(errors, 1)
		assert.equal(transmitted, 2)
		assert.equal(compressed, 1)
		for (const fn of reverseCleanup ? cleanup.reverse() : cleanup) fn()
		assert.equal(
			Upload.prototype.reactNativeCompressAndExtractData,
			prepareBefore,
		)
		assert.equal(Upload.prototype.upload, uploadBefore)
		assert.equal(subscriber.size, 0)
		await new Upload().upload()
		assert.equal(compressed, 2)
	}
})
