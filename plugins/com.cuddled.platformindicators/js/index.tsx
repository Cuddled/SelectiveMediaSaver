import { getModules, lookupModule } from '@revenge-mod/modules/finders'
import {
	createFilterGenerator,
	withProps,
} from '@revenge-mod/modules/finders/filters'
import type { PluginApi } from '@revenge-mod/plugins/types'

interface PlatformIndicatorSettings {
	dmTopBar: boolean
	userList: boolean
	profileUsername: boolean
	removeDefaultMobile: boolean
	fallbackColors: boolean
	oldUserListIcons: boolean
}

type PlatformApi = PluginApi<{ jsonStorage: PlatformIndicatorSettings }>
type AnyRecord = Record<string, any>
type PatchTarget = {
	parent: Record<string, (...args: any[]) => any>
	key: string
}

const DEFAULT_SETTINGS: PlatformIndicatorSettings = {
	dmTopBar: true,
	userList: true,
	profileUsername: true,
	removeDefaultMobile: true,
	fallbackColors: false,
	oldUserListIcons: false,
}

const ICON_PATHS: Record<string, string> = {
	desktop:
		'M4 2.5c-1.103 0-2 .897-2 2v11c0 1.104.897 2 2 2h7v2H7v2h10v-2h-4v-2h7c1.103 0 2-.896 2-2v-11c0-1.103-.897-2-2-2H4Zm16 2v9H4v-9h16Z',
	web: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93Zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39Z',
	mobile:
		'M15.5 1h-8A2.5 2.5 0 0 0 5 3.5v17A2.5 2.5 0 0 0 7.5 23h8a2.5 2.5 0 0 0 2.5-2.5v-17A2.5 2.5 0 0 0 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z',
	embedded:
		'M5.79335761,5 L18.2066424,5 C19.7805584,5 21.0868816,6.21634264 21.1990185,7.78625885 L21.8575059,17.0050826 C21.9307825,18.0309548 21.1585512,18.9219909 20.132679,18.9952675 C20.088523,18.9984215 20.0442685,19 20,19 C18.8245863,19 17.8000084,18.2000338 17.5149287,17.059715 L17,15 L7,15 L6.48507125,17.059715 C6.19999155,18.2000338 5.1754137,19 4,19 C2.97151413,19 2.13776159,18.1662475 2.13776159,17.1377616 C2.13776159,17.0934931 2.1393401,17.0492386 2.1424941,17.0050826 L2.80098151,7.78625885 C2.91311838,6.21634264 4.21944161,5 5.79335761,5 Z M14.5,10 C15.3284271,10 16,9.32842712 16,8.5 C16,7.67157288 15.3284271,7 14.5,7 C13.6715729,7 13,7.67157288 13,8.5 C13,9.32842712 13.6715729,10 14.5,10 Z M18.5,13 C19.3284271,13 20,12.3284271 20,11.5 C20,10.6715729 19.3284271,10 18.5,10 C17.6715729,10 17,10.6715729 17,11.5 C17,12.3284271 17.6715729,13 18.5,13 Z M6,9 L4,9 L4,11 L6,11 L6,13 L8,13 L8,11 L10,11 L10,9 L8,9 L8,7 L6,7 L6,9 ZM5.79335761,5 L18.2066424,5 C19.7805584,5 21.0868816,6.21634264 21.1990185,7.78625885 L21.8575059,17.0050826 C21.9307825,18.0309548 21.1585512,18.9219909 20.132679,18.9952675 C20.088523,18.9984215 20.0442685,19 20,19 C18.8245863,19 17.8000084,18.2000338 17.5149287,17.059715 L17,15 L7,15 L6.48507125,17.059715 C6.19999155,18.2000338 5.1754137,19 4,19 C2.97151413,19 2.13776159,18.1662475 2.13776159,17.1377616 C2.13776159,17.0934931 2.1393401,17.0492386 2.1424941,17.0050826 L2.80098151,7.78625885 C2.91311838,6.21634264 4.21944161,5 5.79335761,5 Z M14.5,10 C15.3284271,10 16,9.32842712 16,8.5 C16,7.67157288 15.3284271,7 14.5,7 C13.6715729,7 13,7.67157288 13,8.5 C13,9.32842712 13.6715729,10 14.5,10 Z M18.5,13 C19.3284271,13 20,12.3284271 20,11.5 C20,10.6715729 19.3284271,10 18.5,10 C17.6715729,10 17,10.6715729 17,11.5 C17,12.3284271 17.6715729,13 18.5,13 Z M6,9 L4,9 L4,11 L6,11 L6,13 L8,13 L8,11 L10,11 L10,9 L8,9 L8,7 L6,7 L6,9 Z',
}

const FALLBACK_COLORS: Record<string, string> = {
	online: '#23a55a',
	dnd: '#f23f43',
	idle: '#f0b232',
	offline: '#80848e',
}

const STATUS_TOKENS: Record<string, string> = {
	online: 'STATUS_ONLINE',
	dnd: 'STATUS_DANGER',
	idle: 'STATUS_WARNING',
	offline: 'STATUS_OFFLINE',
}

const CURRENT_PROFILE_PATH =
	'modules/user_profile/native/UserProfilePrimaryInfo.tsx'

const exactName = createFilterGenerator(
	([name]: [string], _key: PropertyKey, value: any) => {
		const candidates = [
			value,
			value?.default,
			value?.type,
			value?.default?.type,
			value?.render,
			value?.default?.render,
			value?.type?.render,
			value?.default?.type?.render,
		]
		return candidates.some(
			candidate => candidate?.name === name || candidate?.displayName === name,
		)
	},
	([name]: [string]) => `exactName(${name})`,
	1,
)

let activeApi: PlatformApi | undefined
let statusCache: AnyRecord | undefined
let statusCacheHits = 0
let statusCacheTimeout: ReturnType<typeof setTimeout> | undefined
let currentUserId: string | undefined
let svgModule: AnyRecord | undefined

function settings(): PlatformIndicatorSettings {
	return { ...DEFAULT_SETTINGS, ...activeApi?.jsonStorage.cache }
}

function targetOf(
	value: any,
	parent?: AnyRecord,
	parentKey?: string,
): PatchTarget | undefined {
	if (typeof value === 'function' && parent && parentKey) {
		return { parent, key: parentKey }
	}
	if (typeof value?.default === 'function') {
		return { parent: value, key: 'default' }
	}
	if (typeof value?.default?.type?.render === 'function') {
		return { parent: value.default.type, key: 'render' }
	}
	if (typeof value?.default?.type === 'function') {
		return { parent: value.default, key: 'type' }
	}
	if (typeof value?.default?.render === 'function') {
		return { parent: value.default, key: 'render' }
	}
	if (typeof value?.type === 'function') return { parent: value, key: 'type' }
	if (typeof value?.type?.render === 'function') {
		return { parent: value.type, key: 'render' }
	}
	if (typeof value?.render === 'function')
		return { parent: value, key: 'render' }
	return undefined
}

function findInReactTree(root: any, predicate: (node: any) => boolean): any {
	const seen = new WeakSet<object>()
	const visit = (node: any): any => {
		if (node == null) return undefined
		if (predicate(node)) return node
		if (Array.isArray(node)) {
			for (const child of node) {
				const found = visit(child)
				if (found !== undefined) return found
			}
			return undefined
		}
		if (typeof node !== 'object') return undefined
		if (seen.has(node)) return undefined
		seen.add(node)

		for (const child of [node.props, node.children]) {
			const found = visit(child)
			if (found !== undefined) return found
		}
		return undefined
	}
	return visit(root)
}

function getSvgModule(): AnyRecord | undefined {
	if (svgModule) return svgModule
	const [found] = lookupModule(
		exactName('Svg') as any,
		{
			returnNamespace: true,
		} as any,
	)
	if (found) svgModule = found as AnyRecord
	return svgModule
}

function getStatusColor(status: string, useFallback = false): string {
	if (useFallback) return FALLBACK_COLORS[status] ?? FALLBACK_COLORS.offline
	try {
		const common = revenge.discord.common as AnyRecord
		const tokens = common.tokens?.Tokens ?? common.Tokens
		const color = tokens?.colors?.[STATUS_TOKENS[status]]
		if (typeof color === 'string') return color
		if (typeof color?.resolve === 'function') return color.resolve()
	} catch {
		// Fall back to the same Discord colors used by the linked snapshot.
	}
	return FALLBACK_COLORS[status] ?? FALLBACK_COLORS.offline
}

function queryPresenceStoreWithCache(): AnyRecord | undefined {
	if (!statusCacheTimeout) {
		statusCacheTimeout = setTimeout(() => {
			statusCacheHits = 0
			statusCacheTimeout = undefined
		}, 5_000)
	}

	if (!statusCache || statusCacheHits === 0) {
		statusCache = (
			revenge.discord.flux.Stores as AnyRecord
		).PresenceStore?.getState?.()
	}
	statusCacheHits = (statusCacheHits + 1) % 20
	return statusCache
}

function getUserStatuses(userId: string): AnyRecord | undefined {
	const stores = revenge.discord.flux.Stores as AnyRecord
	currentUserId ??= stores.UserStore?.getCurrentUser?.()?.id

	if (userId === currentUserId) {
		return Object.values(stores.SessionsStore?.getSessions?.() ?? {}).reduce(
			(accumulator: AnyRecord, session: any) => {
				if (session.clientInfo.client !== 'unknown') {
					accumulator[session.clientInfo.client] = session.status
				}
				return accumulator
			},
			{},
		)
	}
	return queryPresenceStoreWithCache()?.clientStatuses?.[userId]
}

function StatusIcon({ platform, color }: { platform: string; color: string }) {
	const { View } = revenge.react.ReactNative
	const module = getSvgModule()
	const Svg = module?.default ?? module?.Svg
	const Path = module?.Path
	if (!Svg || !Path) return null

	return (
		<View>
			<Svg height="16" width="16" viewBox="0 0 24 24" fill={color}>
				<Path d={ICON_PATHS[platform]} />
			</Svg>
		</View>
	)
}

function StatusIcons({ userId }: { userId: string }) {
	const liveSettings = activeApi?.jsonStorage.use() ?? DEFAULT_SETTINGS
	const statuses = getUserStatuses(userId) ?? {}

	return (
		<>
			{Object.keys(statuses).map(platform => (
				<StatusIcon
					key={platform}
					platform={platform}
					color={getStatusColor(
						statuses[platform],
						liveSettings.fallbackColors,
					)}
				/>
			))}
		</>
	)
}

function PresenceUpdatedContainer({ children }: { children: any }) {
	const React = revenge.react.React
	const [counter, setCounter] = React.useState(0)

	React.useEffect(
		() =>
			revenge.discord.flux.onFluxEventDispatched(
				'PRESENCE_UPDATES',
				payload => {
					setCounter(previous => previous + 1)
					return payload
				},
			),
		[],
	)

	return React.Children.map(children, (child, index) =>
		React.cloneElement(child, { key: `${index}-${counter}` }),
	)
}

function Settings({ api }: { api: PlatformApi }) {
	const liveSettings = api.jsonStorage.use() ?? DEFAULT_SETTINGS
	const { TableRowGroup, TableSwitchRow } = revenge.discord.design.Design
	const set = <K extends keyof PlatformIndicatorSettings>(
		key: K,
		value: PlatformIndicatorSettings[K],
	) => void api.jsonStorage.set({ [key]: value } as any)

	return (
		<TableRowGroup>
			<TableSwitchRow
				label="Show icons on the dm top bar"
				value={liveSettings.dmTopBar}
				onValueChange={value => set('dmTopBar', value)}
			/>
			<TableSwitchRow
				label="Show icons on the users and DMs list"
				value={liveSettings.userList}
				onValueChange={value => set('userList', value)}
			/>
			<TableSwitchRow
				label="Show icons on user profiles"
				value={liveSettings.profileUsername}
				onValueChange={value => set('profileUsername', value)}
			/>
			<TableSwitchRow
				label="Hide mobile status from the normal indicator"
				value={liveSettings.removeDefaultMobile}
				onValueChange={value => set('removeDefaultMobile', value)}
			/>
			<TableSwitchRow
				label="Theme compatibility mode"
				value={liveSettings.fallbackColors}
				onValueChange={value => set('fallbackColors', value)}
			/>
			<TableSwitchRow
				label="Old user list icon style"
				value={liveSettings.oldUserListIcons}
				onValueChange={value => set('oldUserListIcons', value)}
			/>
		</TableRowGroup>
	)
}

function patchPressableProps(props: AnyRecord): void {
	const { View } = revenge.react.ReactNative
	if (!props) return

	if (props.accessibilityRole === 'button') {
		if (!settings().userList) return
		if (
			Array.isArray(props.children) &&
			props.children.length >= 2 &&
			((props.children[0]?.props?.user && props.children[0]?.props?.channel) ||
				settings().oldUserListIcons)
		) {
			const userId = props.children[0]?.props?.user?.id
			if (!userId) return
			if (!props.children.find((child: any) => child?.key === 'StatusIcons')) {
				props.children.push(
					<View
						key="StatusIcons"
						style={{ display: 'flex', flexDirection: 'row' }}
					/>,
				)
			}
			const icons = props.children.find(
				(child: any) => child?.key === 'StatusIcons',
			)
			icons.props.children = <StatusIcons userId={userId} />
		}
	}

	if (props.accessibilityRole === 'button') {
		if (!settings().userList) return
		const children = props.children?.props?.children?.props?.children
		if (children?.[0]?.type?.type?.name !== 'GuildContainerIndicator') return

		const userId =
			children?.[1]?.props?.children?.[0]?.props?.children?.props?.user?.id
		const guildId =
			children?.[1]?.props?.children?.[0]?.props?.children?.props?.guildId
		if (guildId || !userId) return

		const nameArea = children?.[2]?.props?.children?.[0]
		const userName = nameArea?.props?.children?.[0]?.props?.children
		if (
			Array.isArray(userName) &&
			!findInReactTree(userName, node => node?.key === 'DMTabsV2DMList-v2')
		) {
			userName.push(
				<PresenceUpdatedContainer key="DMTabsV2DMList-v2">
					<StatusIcons userId={userId} />
				</PresenceUpdatedContainer>,
			)
		}
	}
}

/**
 * Direct Revenge Next compatibility port of the supplied PlatformIndicators
 * snapshot. The six settings and every original injection surface are kept.
 */
export default plugin<{ jsonStorage: PlatformIndicatorSettings }>({
	jsonStorage: {
		load: true,
		default: DEFAULT_SETTINGS,
	},

	start(api) {
		activeApi = api
		const patched = new WeakMap<object, Set<string>>()
		const claim = (target: PatchTarget): boolean => {
			let keys = patched.get(target.parent)
			if (!keys) {
				keys = new Set()
				patched.set(target.parent, keys)
			}
			if (keys.has(target.key)) return false
			keys.add(target.key)
			return true
		}
		const safely = (callback: () => void) => {
			try {
				callback()
			} catch (error) {
				console.error('[PlatformIndicators] render patch failed:', error)
			}
		}
		const watchNamed = (
			name: string,
			callback: (module: any) => void,
			max = Number.POSITIVE_INFINITY,
		) => {
			api.cleanup(getModules(exactName(name) as any, callback, { max } as any))
		}

		api.cleanup(() => {
			if (activeApi === api) activeApi = undefined
			statusCache = undefined
			statusCacheHits = 0
			currentUserId = undefined
			if (statusCacheTimeout) clearTimeout(statusCacheTimeout)
			statusCacheTimeout = undefined
		})

		const View: any = revenge.react.ReactNative.View
		if (typeof View?.render === 'function') {
			const target = { parent: View, key: 'render' }
			if (claim(target)) {
				api.cleanup(
					(revenge.patcher.after as any)(View, 'render', (result: any) => {
						safely(() => {
							if (!settings().dmTopBar) return
							const textChannel = findInReactTree(
								result,
								node =>
									node?.props?.children?.[1]?.type?.name ===
										'ChannelActivity' &&
									Object.hasOwn(
										node?.props?.children?.[1]?.props ?? {},
										'userId',
									),
							)
							if (
								textChannel?.props?.children?.length !== 2 ||
								textChannel.props?.children?.[0]?.props?.children?.length !== 2
							) {
								return
							}
							const children = textChannel.props.children[0].props.children
							if (
								children.filter((child: any) => child?.props?.userId).length !==
								2
							) {
								return
							}
							const activity = children[1]
							const userId = activity.props?.userId
							const activityTarget = targetOf(activity)
							if (!userId || !activityTarget || !claim(activityTarget)) return
							api.cleanup(
								revenge.patcher.after(
									activityTarget.parent,
									activityTarget.key,
									activityResult => {
										if (
											!findInReactTree(
												activityResult,
												node => node?.key === 'StatusIcons',
											)
										) {
											return (
												<View style={{ display: 'flex', flexDirection: 'row' }}>
													{activityResult}
													<PresenceUpdatedContainer key="StatusIcons">
														<StatusIcons userId={userId} />
													</PresenceUpdatedContainer>
												</View>
											)
										}
										return activityResult
									},
								),
							)
						})
						return result
					}),
				)
			}
		}

		watchNamed(
			'Pressable',
			module => {
				const target = targetOf(module)
				if (!target || !claim(target)) return
				api.cleanup(
					revenge.patcher.instead(
						target.parent,
						target.key,
						function (this: any, args, original) {
							safely(() => patchPressableProps(args[0]))
							return Reflect.apply(original, this, args)
						},
					),
				)
			},
			1,
		)

		watchNamed(
			'ChannelHeader',
			module => {
				const target = targetOf(module)
				if (!target || !claim(target)) return
				api.cleanup(
					revenge.patcher.after(target.parent, target.key, result => {
						safely(() => {
							if (
								!settings().dmTopBar ||
								result?.type?.type?.name !== 'PrivateChannelHeader'
							) {
								return
							}
							const headerTarget = targetOf(result.type)
							if (!headerTarget || !claim(headerTarget)) return
							api.cleanup(
								revenge.patcher.after(
									headerTarget.parent,
									headerTarget.key,
									header => {
										safely(() => {
											if (!header.props?.children?.props?.children) return
											const userId = findInReactTree(
												header,
												node => node?.props?.user?.id,
											)?.props?.user?.id
											if (!userId) return
											const dmTopBar = header.props.children
											if (
												!findInReactTree(
													header,
													node => node?.key === 'DMTabsV2Header',
												)
											) {
												const title =
													dmTopBar.props?.children?.props?.children?.[1]
												if (title && typeof title.type === 'function') {
													const unpatch = revenge.patcher.after(
														title,
														'type',
														titleResult => {
															unpatch()
															if (
																!findInReactTree(
																	titleResult,
																	node => node?.key === 'DMTabsV2Header-v2',
																)
															) {
																titleResult.props?.children?.[0]?.props?.children?.push(
																	<PresenceUpdatedContainer key="DMTabsV2Header-v2">
																		<StatusIcons userId={userId} />
																	</PresenceUpdatedContainer>,
																)
															}
															return titleResult
														},
													)
													api.cleanup(unpatch)
												} else {
													const arrowId = (
														revenge.assets as AnyRecord
													).getAssetIdByName?.('arrow-right')
													const container = findInReactTree(
														dmTopBar,
														node =>
															node?.props?.children?.[1]?.props?.source ===
															arrowId,
													)
													container?.props?.children?.push(
														<revenge.react.ReactNative.View
															key="DMTabsV2Header"
															style={{
																flexDirection: 'row',
																justifyContent: 'center',
																alignContent: 'flex-start',
															}}
														>
															<revenge.react.ReactNative.View
																key="DMTabsV2HeaderIcons"
																style={{ flexDirection: 'row' }}
															/>
														</revenge.react.ReactNative.View>,
													)
												}
											}
											const topIcons = findInReactTree(
												header,
												node => node?.key === 'DMTabsV2HeaderIcons',
											)
											if (topIcons) {
												topIcons.props.children = (
													<StatusIcons userId={userId} />
												)
											}
										})
										return header
									},
								),
							)
						})
						return result
					}),
				)
			},
			1,
		)

		const installProfilePatch = (module: any, kind: 'default' | 'display') => {
			const target = targetOf(module)
			if (!target || !claim(target)) return
			api.cleanup(
				revenge.patcher.instead(
					target.parent,
					target.key,
					function (this: any, args, original) {
						const result = Reflect.apply(original, this, args)
						safely(() => {
							const user = args[0]?.user
							if (!user?.id || !result || !settings().profileUsername) return
							if (kind === 'default') {
								result.props?.children?.[0]?.props?.children?.push(
									<StatusIcons userId={user.id} />,
								)
							} else {
								result.props?.children?.props?.children?.[0]?.props?.children?.push(
									<StatusIcons userId={user.id} />,
								)
							}
						})
						return result
					},
				),
			)
		}
		watchNamed('DefaultName', module => installProfilePatch(module, 'default'))
		watchNamed('DisplayName', module => installProfilePatch(module, 'display'))
		api.cleanup(
			revenge.discord.utils.modules.finders.getModuleWithImportedPath<AnyRecord>(
				CURRENT_PROFILE_PATH,
				module => {
					if (typeof module?.default !== 'function') return
					const target: PatchTarget = { parent: module, key: 'default' }
					if (!claim(target)) return

					api.cleanup(
						revenge.patcher.instead(
							target.parent,
							target.key,
							function (this: any, args, original) {
								const result = Reflect.apply(original, this, args)
								safely(() => {
									const user = args[0]?.user
									const children = result?.props?.children
									if (
										!settings().profileUsername ||
										!user?.id ||
										!Array.isArray(children) ||
										!children[0] ||
										findInReactTree(
											children[0],
											node => node?.key === 'ProfileNameStatusIcons',
										)
									) {
										return
									}

									children[0] = (
										<View
											key="ProfileNameStatusIcons"
											style={{ flexDirection: 'row', alignItems: 'center' }}
										>
											{children[0]}
											<StatusIcons userId={user.id} />
										</View>
									)
								})
								return result
							},
						),
					)
				},
			),
		)

		watchNamed(
			'Status',
			module => {
				const target = targetOf(module)
				if (!target || !claim(target)) return
				api.cleanup(
					revenge.patcher.before(target.parent, target.key, args => {
						if (args[0] && settings().removeDefaultMobile) {
							args[0].isMobileOnline = false
						}
						return args
					}),
				)
			},
			1,
		)

		api.cleanup(
			getModules(withProps('GuildMemberRow'), module => {
				const row = (module as AnyRecord).GuildMemberRow
				const target = targetOf(row, module as AnyRecord, 'GuildMemberRow')
				if (!target || !claim(target)) return
				api.cleanup(
					revenge.patcher.instead(
						target.parent,
						target.key,
						function (this: any, args, original) {
							const result = Reflect.apply(original, this, args)
							safely(() => {
								const user = args[0]?.user
								if (
									!settings().userList ||
									settings().oldUserListIcons ||
									!user?.id ||
									findInReactTree(
										result,
										node => node?.key === 'GuildMemberRowStatusIconsView',
									)
								) {
									return
								}
								const rowNode = findInReactTree(
									result,
									node => node?.props?.style?.flexDirection === 'row',
								)
								rowNode?.props?.children?.splice(
									2,
									0,
									<revenge.react.ReactNative.View
										key="GuildMemberRowStatusIconsView"
										style={{ flexDirection: 'row' }}
									>
										<StatusIcons userId={user.id} />
									</revenge.react.ReactNative.View>,
								)
							})
							return result
						},
					),
				)
			}),
		)

		watchNamed('UserRow', module => {
			const target = targetOf(module)
			if (!target || !claim(target)) return
			api.cleanup(
				revenge.patcher.instead(
					target.parent,
					target.key,
					function (this: any, args, original) {
						const result = Reflect.apply(original, this, args)
						safely(() => {
							const user = args[0]?.user
							if (
								!settings().userList ||
								settings().oldUserListIcons ||
								!user?.id
							) {
								return
							}
							if (
								findInReactTree(
									result,
									node => node?.key === 'TabsV2MemberListStatusIconsView',
								)
							) {
								return
							}
							const lineClamp = findInReactTree(
								result?.props?.label,
								node => node?.props?.lineClamp,
							)
							const row = lineClamp?.props?.children
							if (!row?.props?.children) return

							row.props.children[1] = (
								<revenge.react.ReactNative.View
									key="TabsV2MemberListStatusIconsView"
									style={{ flexDirection: 'row' }}
								>
									<StatusIcons userId={user.id} />
								</revenge.react.ReactNative.View>
							)
						})
						return result
					},
				),
			)
		})
	},

	SettingsComponent: Settings,
})
