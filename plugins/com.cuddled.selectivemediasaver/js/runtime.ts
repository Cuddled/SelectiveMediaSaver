import type { RuntimeStatus } from './types'

const listeners = new Set<(status: RuntimeStatus) => void>()

let status: RuntimeStatus = {
	phase: 'stopped',
	listening: false,
	nativeReady: false,
	queuedMessages: 0,
	savedThisSession: 0,
	failedThisSession: 0,
}

export function getRuntimeStatus(): RuntimeStatus {
	return status
}

export function updateRuntimeStatus(patch: Partial<RuntimeStatus>): void {
	status = { ...status, ...patch }
	for (const listener of [...listeners]) {
		try {
			listener(status)
		} catch {
			// A settings screen unmount race must not affect capture.
		}
	}
}

export function resetRuntimeStatus(): void {
	updateRuntimeStatus({
		phase: 'stopped',
		listening: false,
		nativeReady: false,
		queuedMessages: 0,
		savedThisSession: 0,
		failedThisSession: 0,
		lastSavedName: undefined,
		lastError: undefined,
		lastEventAt: undefined,
		capabilities: undefined,
	})
}

export function subscribeRuntimeStatus(
	listener: (status: RuntimeStatus) => void,
): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

/** Fixed-size insertion-ordered cache: duplicate dispatcher paths cannot save twice forever. */
export class SeenKeyCache {
	private readonly keys = new Set<string>()

	constructor(private readonly limit = 2_048) {}

	addIfNew(key: string): boolean {
		if (this.keys.has(key)) return false
		this.keys.add(key)
		if (this.keys.size > this.limit) {
			const oldest = this.keys.values().next().value as string | undefined
			if (oldest !== undefined) this.keys.delete(oldest)
		}
		return true
	}

	clear(): void {
		this.keys.clear()
	}
}
