import {
	createController,
	DEFAULT_SETTINGS,
	mediaKind,
	normalizeSettings,
	OriginalMediaError,
} from './core'
import { runtime } from './runtime'
import {
	AttachmentChoice,
	askCompression,
	insertAttachmentChoice,
	SettingsPage,
} from './ui'
import type { Any, Settings } from './core'

const PREFIX = 'com.cuddled.nocompression'
export default plugin<{ jsonStorage: Settings }>({
	jsonStorage: { load: true, default: DEFAULT_SETTINGS },
	init(api) {
		let active = true
		let targets: Any | undefined,
			kestrel: Any | undefined,
			users: Any | undefined
		const native = (method: string, args: unknown[]) =>
			revenge.modules.native.callNativeMethod(
				`${PREFIX}.${method}` as never,
				args as never,
			) as Promise<any>
		const fire = (method: string, value: string) => {
			void native(method, [value]).catch(() => {})
		}
		runtime.settings = normalizeSettings(api.jsonStorage.cache)
		const controller = createController({
			settings: () => runtime.settings,
			account: () => users?.getCurrentUser?.()?.id,
			limit: upload => {
				try {
					const base = targets
						?.getUploadTarget(upload.item.target)
						?.getMaxFileSize(upload.channelId)
					if (!kestrel?.getEffectiveKestrelLimit || !kestrel.getKestrelConfig)
						return base
					return kestrel.getEffectiveKestrelLimit(
						kestrel.getKestrelConfig({
							location: 'CloudUpload.upload.postCompressionCheck',
						}),
						base,
					)
				} catch {
					return undefined
				}
			},
			prepare: (id, uri, limit) => native('prepare', [id, uri, limit]),
			cancel: id => fire('cancel', id),
			release: uri => fire('release', uri),
			ask: askCompression,
			changed: runtime.changed,
		})
		runtime.controller = controller
		function stop() {
			if (!active) return
			active = false
			controller.stop()
			if (runtime.controller === controller) runtime.controller = undefined
			runtime.status = 'Original Media Mode is stopped.'
			runtime.changed()
		}
		api.cleanup(stop)
		function watch(path: string, install: (module: Any) => void) {
			let installed = false
			api.cleanup(
				revenge.discord.utils.modules.finders.getModuleWithImportedPath<any>(
					path,
					module => {
						if (!active || installed) return
						installed = true
						try {
							install(module)
						} catch (error) {
							api.plugin.reportError(error)
						}
					},
				),
			)
		}
		watch('lib/uploader/UploadTargets.tsx', module => {
			targets = module
		})
		watch('modules/media_uploads/experiments/KestrelExperiment.tsx', module => {
			kestrel = module
		})
		watch('stores/UserStore.tsx', module => {
			users = module.default ?? module
			if (users?.addChangeListener) {
				users.addChangeListener(controller.sync)
				api.cleanup(() => users?.removeChangeListener?.(controller.sync))
			}
		})
		watch('lib/uploader/CloudUpload.tsx', module => {
			const prototype = module.CloudUpload?.prototype
			if (typeof prototype?.reactNativeCompressAndExtractData !== 'function')
				return
			api.cleanup(
				revenge.patcher.instead(
					prototype,
					'reactNativeCompressAndExtractData',
					function (this: Any, args, original) {
						return controller.prepare(this, () => original.apply(this, args))
					},
				),
			)
			// Native staging observes upload events, not the upload() promise. Settle
			// canceled/failed original preparation through that same error event.
			if (typeof prototype.upload === 'function')
				api.cleanup(
					revenge.patcher.instead(
						prototype,
						'upload',
						function (this: Any, args, original) {
							return Promise.resolve(original.apply(this, args)).catch(
								(error: unknown) => {
									if (!(error instanceof OriginalMediaError)) throw error
									this.handleError(error.message)
								},
							)
						},
					),
				)
			for (const method of ['cancel', 'removeFromMsgDraft']) {
				if (typeof prototype[method] !== 'function') continue
				api.cleanup(
					revenge.patcher.instead(
						prototype,
						method,
						function (this: Any, args, original) {
							controller.cancel(this)
							try {
								return original.apply(this, args)
							} finally {
								controller.release(this)
							}
						},
					),
				)
			}
			runtime.status =
				'Upload controls ready. Original files are checked against the current conversation limit.'
			runtime.changed()
		})
		watch(
			'modules/media_uploads/native/UploadPreviewActionSheet.tsx',
			module => {
				if (typeof module.default !== 'function') return
				api.cleanup(
					revenge.patcher.instead(
						module as Record<'default', (...args: any[]) => any>,
						'default',
						function (this: any, args, original) {
							const result = original.apply(this, args)
							const upload = args[0]?.upload
							if (!active || !mediaKind(upload)) return result
							return insertAttachmentChoice(
								revenge.react.React,
								result,
								<AttachmentChoice
									key="original-media-choice"
									upload={upload}
								/>,
							)
						},
					),
				)
			},
		)
		api.cleanup(
			api.jsonStorage.subscribe(() => {
				if (!active) return
				runtime.settings = normalizeSettings(api.jsonStorage.cache)
				controller.sync()
			}),
		)
		api.cleanup(stop)
	},
	SettingsComponent: SettingsPage,
})
