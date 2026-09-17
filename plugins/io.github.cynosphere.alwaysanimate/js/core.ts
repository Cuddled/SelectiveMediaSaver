type ReactNodeLike = {
	key?: unknown
	props?: Record<string, any>
	type?: any
}

function childrenOf(value: unknown): unknown[] {
	if (Array.isArray(value)) return value
	if (value && typeof value === 'object') {
		const children = (value as ReactNodeLike).props?.children
		return Array.isArray(children) ? children : [children]
	}
	return []
}

function findNode(
	value: unknown,
	predicate: (node: ReactNodeLike) => boolean,
	seen = new Set<unknown>(),
): ReactNodeLike | undefined {
	if (!value || typeof value !== 'object' || seen.has(value)) return undefined
	seen.add(value)

	if (!Array.isArray(value) && predicate(value as ReactNodeLike)) {
		return value as ReactNodeLike
	}

	for (const child of childrenOf(value)) {
		const found = findNode(child, predicate, seen)
		if (found) return found
	}
	return undefined
}

function sourceUri(source: unknown): string | undefined {
	if (Array.isArray(source)) {
		for (const item of source) {
			const uri = sourceUri(item)
			if (uri) return uri
		}
		return undefined
	}
	if (!source || typeof source !== 'object') return undefined
	const uri = (source as { uri?: unknown }).uri
	return typeof uri === 'string' ? uri : undefined
}

export function forceAnimateProps(props: unknown): void {
	if (props && typeof props === 'object') {
		;(props as { animate?: boolean }).animate = true
	}
}

export function forceAvatarDecorationAnimation(args: any[]): any[] {
	if (args[0] && typeof args[0] === 'object') args[0].canAnimate = true
	return args
}

export function forceUserAvatarAnimation(args: any[]): any[] {
	args[1] = true
	return args
}

export function forceGuildMemberAvatarAnimation(args: any[]): any[] {
	if (args[0] && typeof args[0] === 'object') args[0].canAnimate = true
	return args
}

export function animateMessageRow<T>(row: unknown, generated: T): T {
	if ((row as any)?.rowType !== 1) return generated
	const candidate = generated as any
	const avatarURL = candidate?.message?.avatarURL
	if (typeof avatarURL === 'string' && avatarURL.includes('a_')) {
		candidate.message.avatarURL = avatarURL.replace('.webp', '.gif')
	}
	return generated
}

export function activateAnimatedProfileBanner<T>(tree: T): T {
	const pressable = findNode(
		tree,
		node =>
			typeof node.props?.onPress === 'function' &&
			Boolean(
				findNode(node.props?.children, child => {
					const name = child.type?.displayName ?? child.type?.name
					const uri = sourceUri(child.props?.bannerSource)
					const hasClassicStateKey =
						typeof child.key === 'string' && /-(?:true|false)$/.test(child.key)
					const classicPausedKey =
						typeof child.key === 'string' && child.key.endsWith('-false')
					const currentSourceIsPlaying =
						uri?.includes('.gif') === true ||
						/[?&]animated=true(?:&|$)/.test(uri ?? '')
					const currentPausedSource =
						!hasClassicStateKey &&
						uri?.includes('/a_') === true &&
						!currentSourceIsPlaying
					return (
						name === 'ProfileBanner' &&
						uri?.includes('/a_') === true &&
						(classicPausedKey || currentPausedSource)
					)
				}),
			),
	)
	pressable?.props?.onPress?.()
	return tree
}
