import type { NativeCapabilities } from './types'

export const STARTUP_NATIVE_RETRY_DELAYS_MS = [0, 250, 1_000, 3_000] as const
export const ON_DEMAND_NATIVE_RETRY_DELAYS_MS = [0, 250, 750] as const

export interface NativeCapabilityProbeResult {
	ready: boolean
	attempts: number
	capabilities?: NativeCapabilities
	error?: string
}

export interface NativeEnableFailure {
	code: 'DEPENDENCIES_UNSATISFIED'
	problems: Array<{
		id: string
		required: string
		installed: string | null
		enabled: boolean
	}>
}

interface ProbeOptions {
	retryDelaysMs?: readonly number[]
	wait?: (milliseconds: number) => Promise<void>
	beforeProbe?: () => Promise<unknown>
}

function defaultWait(milliseconds: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function errorDetail(error: unknown): string {
	if (error instanceof Error) return error.message
	if (typeof error === 'string') return error
	try {
		const serialized = JSON.stringify(error)
		return typeof serialized === 'string' ? serialized : String(error)
	} catch {
		return 'Unknown native bridge error'
	}
}

function nativeEnableFailureMessage(failure: NativeEnableFailure): string {
	const details = failure.problems
		.map(problem => {
			const installed = problem.installed ?? 'not installed'
			const disabled = problem.installed && !problem.enabled ? ', disabled' : ''
			return `"${problem.id}" (requires ${problem.required}; installed: ${installed}${disabled})`
		})
		.join(', ')
	return `Native companion cannot remain enabled because required plugins are unavailable: ${details || 'unknown dependency'}.`
}

function nativeEnableMethodUnavailable(error: unknown): boolean {
	const detail = errorDetail(error)
	return (
		/native bridge method not registered[^\n]*revenge\.plugins\.setEnabled/i.test(
			detail,
		) ||
		/revenge\.plugins\.setEnabled[^\n]*(?:not registered|not found|unknown)/i.test(
			detail,
		)
	)
}

/**
 * Keep Revenge's native plugin state aligned with an active JavaScript plugin.
 * Revenge Next persists the enabled flag before starting a late native plugin;
 * mirroring that order makes the companion load again after an app restart.
 */
export async function synchronizeNativeLifecycle(
	isActive: () => boolean,
	setEnabled: () => Promise<NativeEnableFailure | null>,
	startNative: () => Promise<unknown>,
	onPersistenceUnsupported?: (error: unknown) => void,
): Promise<void> {
	if (!isActive()) return

	try {
		const failure = await setEnabled()
		if (failure) throw new Error(nativeEnableFailureMessage(failure))
	} catch (error) {
		// Older Revenge loaders may expose startNative without the durable state
		// method. Preserve next5's session recovery on those hosts.
		if (!nativeEnableMethodUnavailable(error)) throw error
		onPersistenceUnsupported?.(error)
	}

	// Cleanup increments the bridge generation and clears listening. Do not
	// start a companion for a plugin that was disabled while the bridge awaited.
	if (!isActive()) return
	await startNative()
}

export function nativeCapabilitiesReady(
	capabilities: NativeCapabilities,
): boolean {
	return (
		capabilities.ok && capabilities.streamDownload && capabilities.mediaStore
	)
}

export function nativeBridgeErrorMessage(error: unknown): string {
	const rawDetail = errorDetail(error)
	const detail =
		rawDetail
			.split(/\r?\n/)
			.map(line => line.trim())
			.find(Boolean)
			?.slice(0, 480) || 'Unknown native bridge error'

	if (/native bridge method not registered/i.test(detail)) {
		return `Native plugin did not register its bridge method. ${detail}`
	}
	return `Native companion unavailable: ${detail}`
}

export async function probeNativeCapabilities(
	loadCapabilities: () => Promise<NativeCapabilities>,
	options: ProbeOptions = {},
): Promise<NativeCapabilityProbeResult> {
	const delays = options.retryDelaysMs?.length
		? options.retryDelaysMs
		: ([0] as const)
	const wait = options.wait ?? defaultWait
	let attempts = 0
	let lastError = 'Native companion could not be reached.'
	let lifecycleError: string | undefined

	// Revenge can occasionally start the JavaScript lifecycle while its native
	// counterpart remains stopped. Give the loader one idempotent opportunity to
	// repair that split state before probing the plugin-specific bridge.
	if (options.beforeProbe) {
		try {
			await options.beforeProbe()
		} catch (error) {
			lifecycleError = nativeBridgeErrorMessage(error)
			lastError = lifecycleError
		}
	}

	for (const delay of delays) {
		if (delay > 0) await wait(delay)
		attempts += 1
		try {
			const capabilities = await loadCapabilities()
			if (nativeCapabilitiesReady(capabilities)) {
				return { ready: true, attempts, capabilities }
			}
			return {
				ready: false,
				attempts,
				capabilities,
				error:
					'Native bridge loaded without streaming MediaStore support. Check Android storage availability and permissions.',
			}
		} catch (error) {
			lastError = nativeBridgeErrorMessage(error)
		}
	}

	return { ready: false, attempts, error: lifecycleError ?? lastError }
}
