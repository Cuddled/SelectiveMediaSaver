import { readableChatForeground } from '../../com.cuddled.liquidglass/js/core'
import type { Settings } from './core'

/** The final native row can contain a cached reply built before token overrides. */
export function readableReplies(
	settings: Settings,
	result: unknown,
	processColor: (value: string) => unknown,
): unknown {
	if (
		!settings.enabled ||
		!settings.chats ||
		!result ||
		typeof result !== 'object' ||
		Array.isArray(result)
	)
		return result
	const row = result as Record<string, any>
	if (
		typeof row.id !== 'string' ||
		(!row.referencedMessage && !row.threadEmbed?.referencedMessage)
	)
		return result
	let color: unknown
	try {
		color = processColor(readableChatForeground(settings.textColor))
	} catch {
		return result
	}
	if (typeof color !== 'number' || !Number.isFinite(color)) return result
	const update = (reference: any) => {
		const message = reference?.message
		// Blocked/deleted/system placeholders have no message; do not replace them.
		if (
			reference?.state !== 0 || // Discord 347: LOADED; SYSTEM is 1.
			!message ||
			typeof message.id !== 'string' ||
			typeof message.textColor !== 'number' ||
			message.textColor === color
		)
			return reference
		return { ...reference, message: { ...message, textColor: color } }
	}
	const reference = update(row.referencedMessage)
	const threadReference = update(row.threadEmbed?.referencedMessage)
	if (
		reference === row.referencedMessage &&
		threadReference === row.threadEmbed?.referencedMessage
	)
		return result
	return {
		...row,
		...(reference !== row.referencedMessage
			? { referencedMessage: reference }
			: {}),
		...(threadReference !== row.threadEmbed?.referencedMessage
			? {
					threadEmbed: {
						...row.threadEmbed,
						referencedMessage: threadReference,
					},
				}
			: {}),
	}
}
