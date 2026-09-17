export function prependChatboxAvatar<T>(tree: T, avatar: unknown): T {
	const children = (tree as any)?.props?.children?.props?.children
	if (Array.isArray(children)) children.unshift(avatar)
	return tree
}
