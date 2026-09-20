import { isId } from './workspaceModel'

/** Discord 347's useScrollHandlers passes the committed native rows to this handler. */
export function visibleAnchor(value: unknown): string {
	if (!value || typeof value !== 'object') return ''
	const v = value as Record<string, any>
	if (
		!Array.isArray(v.rows) ||
		!Number.isInteger(v.firstVisibleMessageRowIndex) ||
		!Number.isInteger(v.lastVisibleMessageRowIndex)
	)
		return ''
	const first = v.firstVisibleMessageRowIndex,
		last = v.lastVisibleMessageRowIndex
	if (first < 0 || last < first || last >= v.rows.length) return ''
	const center = Math.floor((first + last) / 2)
	for (let delta = 0; delta <= Math.min(last - first, 40); delta++) {
		for (const index of [center + delta, center - delta]) {
			if (index < first || index > last) continue
			const id = v.rows[index]?.message?.id
			if (isId(id)) return id
		}
	}
	return ''
}
export function createReadingTracker(
	record: (channelId: string, messageId: string) => void,
) {
	let alive = true
	const handlers = new WeakMap<
		object,
		{ channelId: string; proxy: Record<string, any> }
	>()
	return {
		wrap(input: any) {
			const original = input?.visibleMessagesWindowHandler
			if (
				!alive ||
				!isId(input?.channelId) ||
				typeof original?.handleScrollPosition !== 'function'
			)
				return input
			let entry = handlers.get(original)
			if (!entry) {
				const state = {
					channelId: input.channelId,
					proxy: Object.create(original),
				}
				state.proxy.handleScrollPosition = (...args: any[]) => {
					const result = original.handleScrollPosition(...args)
					const id = visibleAnchor(args[0])
					if (alive && id) record(state.channelId, id)
					return result
				}
				entry = state
				handlers.set(original, state)
			}
			entry.channelId = input.channelId
			return { ...input, visibleMessagesWindowHandler: entry.proxy }
		},
		dispose() {
			alive = false
		},
	}
}
