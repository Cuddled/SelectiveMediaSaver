import type { NativeCapabilities } from './types'

export const STARTUP_NATIVE_RETRY_DELAYS_MS = [0, 250, 1_000, 3_000] as const
export const ON_DEMAND_NATIVE_RETRY_DELAYS_MS = [0, 250, 750] as const

export interface NativeCapabilityProbeResult {
	ready: boolean
	attempts: number
	capabilities?: NativeCapabilities
	error?: string
}

interface ProbeOptions {
	retryDelaysMs?: readonly number[]
	wait?: (milliseconds: number) => Promise<void>
	beforeProbe?: () => Promise<unknown>
}

function defaultWait(milliseconds: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export function nativeCapabilitiesReady(
	capabilities: NativeCapabilities,
): boolean {
	return (
		capabilities.ok && capabilities.streamDownload && capabilities.mediaStore
	)
}

export function nativeBridgeErrorMessage(error: unknown): string {
	let rawDetail: string
	if (error instanceof Error) {
		rawDetail = error.message
	} else if (typeof error === 'string') {
		rawDetail = error
	} else {
		try {
			const serialized = JSON.stringify(error)
			rawDetail = typeof serialized === 'string' ? serialized : String(error)
		} catch {
			rawDetail = 'Unknown native bridge error'
		}
	}
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

	// Revenge can occasionally start the JavaScript lifecycle while its native
	// counterpart remains stopped. Give the loader one idempotent opportunity to
	// repair that split state before probing the plugin-specific bridge.
	if (options.beforeProbe) {
		try {
			await options.beforeProbe()
		} catch (error) {
			lastError = nativeBridgeErrorMessage(error)
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

	return { ready: false, attempts, error: lastError }
}
