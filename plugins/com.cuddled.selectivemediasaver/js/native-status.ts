import {
	ON_DEMAND_NATIVE_RETRY_DELAYS_MS,
	probeNativeCapabilities,
} from './bridge-recovery'
import { getNativeCapabilities } from './native'
import { getRuntimeStatus, updateRuntimeStatus } from './runtime'

const AUTOMATIC_PROBE_COOLDOWN_MS = 5_000

let bridgeGeneration = 0
let nextAutomaticProbeAt = 0
let inFlight:
	| {
			generation: number
			promise: Promise<boolean>
	  }
	| undefined

export function resetNativeBridgeConnection(): void {
	bridgeGeneration += 1
	nextAutomaticProbeAt = 0
	inFlight = undefined
}

export function refreshNativeBridge(options?: {
	retryDelaysMs?: readonly number[]
}): Promise<boolean> {
	const generation = bridgeGeneration
	if (inFlight?.generation === generation) return inFlight.promise

	const promise = probeNativeCapabilities(getNativeCapabilities, {
		retryDelaysMs: options?.retryDelaysMs,
	})
		.then(result => {
			if (generation !== bridgeGeneration) return false
			nextAutomaticProbeAt = result.ready
				? 0
				: Date.now() + AUTOMATIC_PROBE_COOLDOWN_MS
			const status = getRuntimeStatus()
			updateRuntimeStatus({
				capabilities: result.capabilities,
				nativeReady: result.ready,
				lastError: result.ready ? undefined : result.error,
				phase: result.ready
					? status.listening
						? 'listening'
						: status.phase
					: status.listening
						? 'error'
						: status.phase,
			})
			return result.ready
		})
		.finally(() => {
			if (inFlight?.generation === generation && inFlight.promise === promise) {
				inFlight = undefined
			}
		})

	inFlight = { generation, promise }
	return promise
}

export function ensureNativeBridge(): Promise<boolean> {
	if (getRuntimeStatus().nativeReady) return Promise.resolve(true)
	if (Date.now() < nextAutomaticProbeAt) return Promise.resolve(false)
	return refreshNativeBridge({
		retryDelaysMs: ON_DEMAND_NATIVE_RETRY_DELAYS_MS,
	})
}
