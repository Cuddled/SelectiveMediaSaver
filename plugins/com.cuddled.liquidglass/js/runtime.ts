import { normalizeSettings } from './core'
import type { LiquidGlassSettings } from './types'

type PreviewHandler = (settings: LiquidGlassSettings) => void

interface ReloadAwarePlugin {
	startedLate: boolean
	requireReload(): void
}

let previewHandler: PreviewHandler | undefined

export function registerRuntimePreview(handler: PreviewHandler): () => void {
	previewHandler = handler
	return () => {
		if (previewHandler === handler) previewHandler = undefined
	}
}

export function previewRuntimeSettings(value: unknown): void {
	previewHandler?.(normalizeSettings(value))
}

/** Structural patches are safe only before Discord mounts its application tree. */
export function deferLateRuntime(plugin: ReloadAwarePlugin): boolean {
	if (!plugin.startedLate) return false
	plugin.requireReload()
	return true
}
