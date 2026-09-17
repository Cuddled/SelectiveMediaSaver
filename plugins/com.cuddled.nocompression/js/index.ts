import { getModules } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'

type AnyModule = Record<string, any>

let dialogs: AnyModule | undefined

function showTooBigDialog(): void {
	const title = 'File is too big to upload'
	const body =
		'The size of the file you are trying to upload exceeds the maximum allowed size.'
	if (dialogs?.show) {
		dialogs.show({
			title,
			body,
			confirmText: 'Accept',
			confirmColor: 'brand',
		})
		return
	}

	const React = revenge.react.React
	const { AlertActionButton, AlertModal } = revenge.discord.design.Design
	revenge.discord.actions.AlertActionCreators.openAlert(
		'no-compression-file-too-big',
		React.createElement(AlertModal, {
			title,
			content: body,
			actions: React.createElement(AlertActionButton, { text: 'Accept' }),
		}),
	)
}

/**
 * Direct Revenge Next compatibility port of MSMA's linked Vendetta snapshot.
 * Its original upload mutations (including filename handling) are intentionally
 * preserved exactly rather than modernized.
 */
export default plugin({
	start({ cleanup }) {
		cleanup(
			getModules(withProps('show', 'confirm', 'close'), module => {
				dialogs = module as AnyModule
			}),
		)

		cleanup(
			getModules(withProps('UploadTargets'), module => {
				const uploadTargets = module as AnyModule
				if (typeof uploadTargets.getUploadTarget !== 'function') return

				cleanup(
					revenge.patcher.after(
						uploadTargets as Record<'getUploadTarget', (...args: any[]) => any>,
						'getUploadTarget',
						result => {
							if (
								result &&
								(typeof result === 'object' || typeof result === 'function')
							) {
								Object.defineProperty(
									result,
									'shouldReactNativeCompressUploads',
									{
										get: () => false,
									},
								)
							}
							return result
						},
					),
				)
			}),
		)

		cleanup(
			getModules(withProps('CloudUpload'), module => {
				const CloudUpload = (module as AnyModule).CloudUpload
				const prototype = CloudUpload?.prototype as AnyModule | undefined
				if (!prototype) return

				if (typeof prototype.reactNativeCompressAndExtractData === 'function') {
					cleanup(
						(revenge.patcher.instead as any)(
							prototype,
							'reactNativeCompressAndExtractData',
							function (this: AnyModule, args: any[], original: any) {
								this.reactNativeFilePrepped = true
								this.currentSize = this.preCompressionSize

								if (
									this.mimeType === 'image/png' &&
									!this.filename.endsWith('.png')
								) {
									this.filename += '.png'
								}
								if (
									this.mimeType === 'image/jpg' &&
									(!this.filename.endsWith('.jpg') ||
										!this.filename.endsWith('.jpeg'))
								) {
									this.filename += '.jpg'
								}

								return Reflect.apply(original, this, args)
							},
						),
					)
				}

				if (typeof prototype.handleError === 'function') {
					cleanup(
						(revenge.patcher.before as any)(
							prototype,
							'handleError',
							(args: any[]) => {
								// biome-ignore lint/suspicious/noDoubleEquals: preserve the Classic snapshot's coercing error-code check
								if (args[0] == 40005) {
									showTooBigDialog()
								}
								return args
							},
						),
					)
				}
			}),
		)
	},
})
