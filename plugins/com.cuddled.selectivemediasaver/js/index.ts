import { STARTUP_NATIVE_RETRY_DELAYS_MS } from './bridge-recovery'
import {
	addProfileHistoryEntry,
	addSenderFolderAssignment,
	hasProfileAsset,
	normalizeSettings,
	settingsChanged,
} from './defaults'
import {
	buildDownloadRequest,
	extractMedia,
	httpsHost,
	isMessageAllowed,
	messageContext,
	messageFromEvent,
	profileFolderSegments,
	seenKey,
} from './media'
import { streamDownload } from './native'
import {
	ensureNativeBridge,
	refreshNativeBridge,
	resetNativeBridgeConnection,
} from './native-status'
import {
	avatarCandidateFromUser,
	bannerCandidateFromProfileEvent,
	PROFILE_EVENT_TYPES,
	userFromUserUpdateEvent,
} from './profile-media'
import {
	getRuntimeStatus,
	resetRuntimeStatus,
	SeenKeyCache,
	updateRuntimeStatus,
} from './runtime'
import Settings from './Settings'
import type { PluginApi } from '@revenge-mod/plugins/types'
import type {
	NativeDownloadResult,
	ProfileAssetCandidate,
	SelectiveMediaSaverSettings,
} from './types'

const TAG = '[SelectiveMediaSaver]'
const MAX_QUEUED_MESSAGES = 64
const seenKeys = new SeenKeyCache(2_048)

type SmsPluginApi = PluginApi<{ jsonStorage: SelectiveMediaSaverSettings }>

function errorMessage(error: unknown): string {
	if (error instanceof Error) return error.message
	if (typeof error === 'string') return error
	try {
		return JSON.stringify(error)
	} catch {
		return 'Unknown error'
	}
}

function toast(key: string, content: string): void {
	try {
		revenge.discord.actions.ToastActionCreators.open({ key, content })
	} catch {
		console.log(`${TAG} ${content}`)
	}
}

function currentUserId(): string | undefined {
	try {
		const stores = revenge.discord.flux.Stores as any
		const id = stores.UserStore?.getCurrentUser?.()?.id
		return id == null ? undefined : String(id)
	} catch {
		return undefined
	}
}

function currentGuildName(guildId: string): string | undefined {
	if (!guildId) return undefined
	try {
		const stores = revenge.discord.flux.Stores as any
		const name = stores.GuildStore?.getGuild?.(guildId)?.name
		return typeof name === 'string' && name.trim() ? name.trim() : undefined
	} catch {
		return undefined
	}
}

function currentUsername(userId: string, fallback: string): string {
	try {
		const stores = revenge.discord.flux.Stores as any
		const username = stores.UserStore?.getUser?.(userId)?.username
		return typeof username === 'string' && username.trim()
			? username.trim()
			: fallback
	} catch {
		return fallback
	}
}

async function senderFolderAssignment(
	api: SmsPluginApi,
	userId: string,
	username: string,
): Promise<string> {
	const settings = normalizeSettings(api.jsonStorage.cache)
	const assignment = addSenderFolderAssignment(
		settings.senderFolderAssignments,
		userId,
		username,
	)
	if (assignment.changed) {
		await api.jsonStorage.set({
			senderFolderAssignments: assignment.assignments,
		})
	}
	return assignment.segment
}

function describeFailure(result: NativeDownloadResult): string | undefined {
	return result.ok ? undefined : `${result.error.code}: ${result.error.message}`
}

function profileHistoryKey(
	kind: ProfileAssetCandidate['kind'],
): 'avatarHistory' | 'bannerHistory' {
	return kind === 'avatar' ? 'avatarHistory' : 'bannerHistory'
}

function profileCaptureEnabled(
	candidate: ProfileAssetCandidate,
	settings: SelectiveMediaSaverSettings,
): boolean {
	return candidate.kind === 'avatar'
		? settings.saveAvatarsForAllowlistedUsers
		: settings.saveBannersForAllowlistedUsers
}

function changeTrackingEnabled(
	candidate: ProfileAssetCandidate,
	settings: SelectiveMediaSaverSettings,
): boolean {
	return candidate.kind === 'avatar'
		? settings.trackAvatarChanges
		: settings.trackBannerChanges
}

function profileCaptureAllowed(
	candidate: ProfileAssetCandidate,
	settings: SelectiveMediaSaverSettings,
): boolean {
	if (!settings.enabled || !profileCaptureEnabled(candidate, settings))
		return false
	if (settings.ignoreBots && candidate.userIsBot) return false
	if (settings.ignoreSelf && candidate.userId === currentUserId()) return false
	if (!settings.allowedUserIds.includes(candidate.userId)) return false
	return true
}

function recordProfileFailure(message: string): void {
	const status = getRuntimeStatus()
	updateRuntimeStatus({
		phase: 'error',
		failedThisSession: status.failedThisSession + 1,
		lastError: message,
		lastEventAt: Date.now(),
	})
}

async function processProfileAsset(
	candidate: ProfileAssetCandidate | undefined,
	api: SmsPluginApi,
	isDisposed: () => boolean,
): Promise<void> {
	if (!candidate || isDisposed()) return
	const settings = normalizeSettings(api.jsonStorage.cache)
	if (!profileCaptureAllowed(candidate, settings)) return

	const historyKey = profileHistoryKey(candidate.kind)
	if (
		changeTrackingEnabled(candidate, settings) &&
		hasProfileAsset(settings[historyKey], candidate.userId, candidate.assetHash)
	)
		return
	updateRuntimeStatus({ lastEventAt: Date.now() })
	if (!getRuntimeStatus().nativeReady && !(await ensureNativeBridge())) {
		if (isDisposed()) return
		const detail = getRuntimeStatus().lastError
		const message = `Could not save ${candidate.userName}'s ${candidate.kind}: the native saver is unavailable.`
		recordProfileFailure(detail ?? message)
		if (settings.showErrorToasts) {
			toast(`sms-${candidate.kind}-native-error`, message)
		}
		return
	}
	if (isDisposed()) return
	if (
		!seenKeys.addIfNew(
			`profile:${candidate.kind}:${candidate.userId}:${candidate.assetHash}`,
		)
	)
		return

	const runtime = getRuntimeStatus()
	const capabilities = runtime.capabilities
	if (
		(capabilities?.allowedHosts.length &&
			!capabilities.allowedHosts.includes('cdn.discordapp.com')) ||
		(capabilities?.allowedMimeTypes.length &&
			!capabilities.allowedMimeTypes.includes(candidate.mimeType)) ||
		(capabilities?.allowedExtensions.length &&
			!capabilities.allowedExtensions.includes(candidate.extension.slice(1)))
	) {
		const message = `Could not save ${candidate.userName}'s ${candidate.kind}: the native saver does not allow this Discord CDN format.`
		recordProfileFailure(message)
		if (settings.showErrorToasts) {
			toast(`sms-${candidate.kind}-format-error`, message)
		}
		return
	}

	const configuredMaxBytes = settings.maxDownloadMiB * 1024 * 1024
	const maxBytes = capabilities?.maxBytes
		? Math.min(configuredMaxBytes, capabilities.maxBytes)
		: configuredMaxBytes
	try {
		const assignedSenderFolder = settings.organizeProfileMediaBySender
			? await senderFolderAssignment(
					api,
					candidate.userId,
					currentUsername(candidate.userId, candidate.userUsername),
				)
			: undefined
		const result = await streamDownload({
			url: candidate.url,
			fileName: `${candidate.kind}-${candidate.userId}-${candidate.assetHash}${candidate.extension}`,
			mimeType: candidate.mimeType,
			folderSegments: profileFolderSegments(
				settings,
				candidate.kind,
				candidate.userUsername,
				candidate.userId,
				assignedSenderFolder,
			),
			maxBytes,
		})
		if (!result.ok) {
			const message =
				describeFailure(result) ?? `Could not save ${candidate.kind}.`
			recordProfileFailure(message)
			if (settings.showErrorToasts) {
				toast(`sms-${candidate.kind}-save-error`, message)
			}
			return
		}

		const latestSettings = normalizeSettings(api.jsonStorage.cache)
		const history = addProfileHistoryEntry(latestSettings[historyKey], {
			userId: candidate.userId,
			assetHash: candidate.assetHash,
			savedAt: Date.now(),
			uri: result.uri,
			displayName: candidate.userName,
		})
		await api.jsonStorage.set(
			{ ...latestSettings, [historyKey]: history },
			true,
		)
		if (isDisposed()) return

		const status = getRuntimeStatus()
		updateRuntimeStatus({
			phase: 'listening',
			savedThisSession: status.savedThisSession + 1,
			lastSavedName: result.displayName,
			lastError: undefined,
		})
		if (settings.showSaveToasts) {
			toast(
				`sms-${candidate.kind}-saved-${candidate.userId}`,
				`Saved ${candidate.userName}'s new ${candidate.kind}.`,
			)
		}
	} catch (error) {
		const message = errorMessage(error)
		recordProfileFailure(message)
		console.error(`${TAG} ${candidate.kind} download failed:`, error)
		if (settings.showErrorToasts) {
			toast(
				`sms-${candidate.kind}-save-error`,
				`Could not save ${candidate.userName}'s ${candidate.kind}.`,
			)
		}
	}
}

async function processMessageCreate(
	payload: unknown,
	api: SmsPluginApi,
	isDisposed: () => boolean,
): Promise<void> {
	if (isDisposed()) return
	const settings = normalizeSettings(api.jsonStorage.cache)
	if (!settings.enabled) return

	const message = messageFromEvent(payload)
	if (!message) return
	const context = messageContext(message)
	if (!context) return
	if (settings.ignoreBots && context.authorIsBot) return
	if (
		settings.ignoreSelf &&
		context.authorId &&
		context.authorId === currentUserId()
	)
		return
	if (!isMessageAllowed(context, settings)) return

	if (settings.allowedUserIds.includes(context.authorId)) {
		await processProfileAsset(
			avatarCandidateFromUser(message.author),
			api,
			isDisposed,
		)
		if (isDisposed()) return
	}

	const media = extractMedia(message, settings)
	if (!media.length) return
	updateRuntimeStatus({ lastEventAt: Date.now() })

	if (!getRuntimeStatus().nativeReady && !(await ensureNativeBridge())) {
		if (isDisposed()) return
		const detail = getRuntimeStatus().lastError
		updateRuntimeStatus({
			phase: 'error',
			lastError:
				detail ??
				'A qualifying message was found, but the native MediaStore bridge is unavailable.',
		})
		return
	}
	if (isDisposed()) return
	const assignedSenderFolder =
		settings.folderOrganization !== 'flat'
			? await senderFolderAssignment(
					api,
					context.authorId,
					currentUsername(context.authorId, context.authorUsername),
				)
			: undefined

	let saved = 0
	let failed = 0
	let lastSavedName: string | undefined
	let lastError: string | undefined

	for (let index = 0; index < media.length && !isDisposed(); index += 1) {
		const item = media[index]
		if (!seenKeys.addIfNew(seenKey(context.id, item.url))) continue
		const capabilities = getRuntimeStatus().capabilities
		const host = httpsHost(item.url)
		const allowedHosts = capabilities?.allowedHosts
		if (!host || (allowedHosts?.length && !allowedHosts.includes(host))) {
			failed += 1
			lastError = `Skipped ${item.fileName ?? item.kind}: its media host is not allowed by the native saver.`
			continue
		}
		if (
			item.mimeType &&
			capabilities?.allowedMimeTypes.length &&
			!capabilities.allowedMimeTypes.includes(item.mimeType)
		) {
			failed += 1
			lastError = `Skipped ${item.fileName ?? item.kind}: ${item.mimeType} is not supported by the native saver.`
			continue
		}
		const extension = item.extension.replace(/^\./, '').toLowerCase()
		if (
			capabilities?.allowedExtensions.length &&
			!capabilities.allowedExtensions.includes(extension)
		) {
			failed += 1
			lastError = `Skipped ${item.fileName ?? item.kind}: .${extension} is not supported by the native saver.`
			continue
		}

		const configuredMaxBytes = settings.maxDownloadMiB * 1024 * 1024
		const maxBytes = capabilities?.maxBytes
			? Math.min(configuredMaxBytes, capabilities.maxBytes)
			: configuredMaxBytes
		if (item.size !== undefined && item.size > maxBytes) {
			failed += 1
			lastError = `Skipped ${item.fileName ?? item.kind}: it exceeds the ${settings.maxDownloadMiB} MiB limit.`
			continue
		}

		try {
			const request = buildDownloadRequest(
				context,
				item,
				index,
				settings,
				currentGuildName(context.guildId),
				assignedSenderFolder,
			)
			request.maxBytes = maxBytes
			const result = await streamDownload(request)
			if (result.ok) {
				saved += 1
				lastSavedName = result.displayName
			} else {
				failed += 1
				lastError = describeFailure(result)
			}
		} catch (error) {
			failed += 1
			lastError = errorMessage(error)
			console.error(`${TAG} native download failed:`, error)
		}
	}
	if (isDisposed()) return

	const status = getRuntimeStatus()
	updateRuntimeStatus({
		phase: failed > 0 && saved === 0 ? 'error' : 'listening',
		savedThisSession: status.savedThisSession + saved,
		failedThisSession: status.failedThisSession + failed,
		lastSavedName: lastSavedName ?? status.lastSavedName,
		lastError: lastError ?? (failed === 0 ? undefined : status.lastError),
	})

	if (saved > 0 && settings.showSaveToasts) {
		toast(
			`sms-saved-${context.id}`,
			saved === 1
				? `Saved ${lastSavedName ?? '1 media item'}.`
				: `Saved ${saved} media items.`,
		)
	}
	if (failed > 0 && settings.showErrorToasts) {
		toast(
			`sms-failed-${context.id}`,
			`${failed} media ${failed === 1 ? 'item' : 'items'} could not be saved. Open plugin settings for details.`,
		)
	}
}

export default plugin<{ jsonStorage: SelectiveMediaSaverSettings }>({
	jsonStorage: {
		load: true,
		default: normalizeSettings(undefined),
	},

	start(api) {
		let disposed = false
		const unregisterFluxListeners: Array<() => void> = []
		let queuedMessages = 0
		let queueTail: Promise<void> = Promise.resolve()

		seenKeys.clear()
		resetNativeBridgeConnection()
		resetRuntimeStatus()
		updateRuntimeStatus({ phase: 'starting' })

		api.cleanup(() => {
			disposed = true
			resetNativeBridgeConnection()
			for (const unregister of unregisterFluxListeners.splice(0)) {
				try {
					unregister()
				} catch (error) {
					console.error(`${TAG} listener cleanup failed:`, error)
				}
			}
			seenKeys.clear()
			updateRuntimeStatus({
				phase: 'stopped',
				listening: false,
				queuedMessages: 0,
			})
		})

		const enqueue = (label: string, task: () => Promise<void>) => {
			if (disposed) return
			if (queuedMessages >= MAX_QUEUED_MESSAGES) {
				const status = getRuntimeStatus()
				updateRuntimeStatus({
					phase: 'error',
					failedThisSession: status.failedThisSession + 1,
					lastError:
						'Capture queue reached its 64-message safety limit; one event was skipped.',
				})
				return
			}

			queuedMessages += 1
			updateRuntimeStatus({ queuedMessages })
			queueTail = queueTail
				.then(task)
				.catch(error => {
					const status = getRuntimeStatus()
					updateRuntimeStatus({
						phase: 'error',
						failedThisSession: status.failedThisSession + 1,
						lastError: errorMessage(error),
					})
					console.error(`${TAG} ${label} processing failed:`, error)
				})
				.finally(() => {
					queuedMessages = Math.max(0, queuedMessages - 1)
					updateRuntimeStatus({ queuedMessages })
				})
		}

		void (async () => {
			const rawSettings = await api.jsonStorage.get()
			const migrated = normalizeSettings(rawSettings)
			if (settingsChanged(rawSettings, migrated)) {
				await api.jsonStorage.set(migrated, true)
			}

			if (disposed) return
			unregisterFluxListeners.push(
				revenge.discord.flux.onFluxEventDispatched(
					'MESSAGE_CREATE',
					(payload: any) => {
						enqueue('MESSAGE_CREATE', () =>
							processMessageCreate(payload, api, () => disposed),
						)
						return payload
					},
				),
			)
			unregisterFluxListeners.push(
				revenge.discord.flux.onFluxEventDispatched(
					'USER_UPDATE',
					(payload: any) => {
						enqueue('USER_UPDATE', () =>
							processProfileAsset(
								avatarCandidateFromUser(userFromUserUpdateEvent(payload)),
								api,
								() => disposed,
							),
						)
						return payload
					},
				),
			)
			for (const eventType of PROFILE_EVENT_TYPES) {
				unregisterFluxListeners.push(
					revenge.discord.flux.onFluxEventDispatched(
						eventType,
						(payload: any) => {
							enqueue(eventType, () =>
								processProfileAsset(
									bannerCandidateFromProfileEvent(payload),
									api,
									() => disposed,
								),
							)
							return payload
						},
					),
				)
			}
			updateRuntimeStatus({
				phase: 'starting',
				listening: true,
				nativeReady: false,
			})
			const nativeReady = await refreshNativeBridge({
				retryDelaysMs: STARTUP_NATIVE_RETRY_DELAYS_MS,
			})
			if (disposed) return
			if (!nativeReady && migrated.showErrorToasts) {
				toast(
					'sms-native-start-error',
					'Selective Media Saver could not connect to its native saver. Open plugin settings for details.',
				)
			}
			console.log(
				`${TAG} foreground listeners started; native bridge ${nativeReady ? 'ready' : 'unavailable'}`,
			)
		})().catch(error => {
			for (const unregister of unregisterFluxListeners.splice(0)) {
				try {
					unregister()
				} catch {
					// The startup error below is the actionable failure.
				}
			}
			const message = errorMessage(error)
			updateRuntimeStatus({
				phase: 'error',
				listening: false,
				lastError: message,
			})
			// Do not pass recoverable startup failures to reportError. Revenge treats a
			// reported plugin error as fatal, disables the plugin, and persists its main
			// toggle as OFF. Keep the failure visible here so the next launch can retry.
			console.error(`${TAG} startup failed:`, error)
		})
	},

	stop() {
		resetNativeBridgeConnection()
		resetRuntimeStatus()
		console.log(`${TAG} stopped`)
	},

	SettingsComponent: Settings,
})
