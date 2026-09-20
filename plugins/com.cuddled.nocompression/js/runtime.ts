import { DEFAULT_SETTINGS } from './core'
import type { createController, Settings } from './core'

let revision = 0
const listeners = new Set<() => void>()
export const runtime = {
	settings: DEFAULT_SETTINGS as Settings,
	controller: undefined as ReturnType<typeof createController> | undefined,
	status: 'Restart Discord to load Original Media Mode.',
	subscribe(fn: () => void) {
		listeners.add(fn)
		return () => {
			listeners.delete(fn)
		}
	},
	snapshot: () => revision,
	changed() {
		revision++
		for (const fn of listeners) fn()
	},
}
