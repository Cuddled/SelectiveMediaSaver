import { normalize, runtime } from './core'
import type { Settings } from './core'

interface Storage {
	cache?: unknown
	set(value: Settings, immediate?: boolean): Promise<unknown>
}
/** Settings and Home share one queue so quick edits cannot overwrite each other. */
export function createSettingsWriter(storage: Storage) {
	let queue = Promise.resolve()
	let saved = normalize(storage.cache)
	let sequence = 0
	let pending = 0
	let alive = true
	return {
		isPending: () => pending > 0,
		stop() {
			alive = false
		},
		write(
			changes: Partial<Settings> | ((current: Settings) => Partial<Settings>),
		) {
			if (!alive)
				return Promise.reject(
					new Error('Reload Discord to edit this appearance.'),
				)
			const current = runtime.getSettings()
			const next = normalize({
				...current,
				...(typeof changes === 'function' ? changes(current) : changes),
			})
			const revision = ++sequence
			pending++
			runtime.update(next)
			const job = queue.then(async () => {
				try {
					await storage.set(next, true)
					saved = next
				} catch {
					if (alive && revision === sequence) runtime.update(saved)
					throw new Error('Could not save that change. Please try again.')
				} finally {
					pending--
				}
			})
			queue = job.catch(() => {})
			return job
		},
	}
}
export type SettingsWriter = ReturnType<typeof createSettingsWriter>
let current: SettingsWriter | undefined
export const setSettingsWriter = (writer: SettingsWriter | undefined) => {
	current = writer
}
export function saveSettings(
	changes: Partial<Settings> | ((value: Settings) => Partial<Settings>),
) {
	return current
		? current.write(changes)
		: Promise.reject(new Error('Reload Discord to open Appearance Studio.'))
}
