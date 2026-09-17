import { getModules } from '@revenge-mod/modules/finders'
import {
	createFilterGenerator,
	withProps,
} from '@revenge-mod/modules/finders/filters'
import { Linking } from 'react-native'
import type { PluginApi } from '@revenge-mod/plugins/types'

interface BetterBiosSettings {
	dismiss: boolean
}

type BetterBiosApi = PluginApi<{ jsonStorage: BetterBiosSettings }>
type AnyNode = { props?: Record<string, any> } | null | undefined
type AnyRecord = Record<string, any>

let urlOpener: AnyRecord | undefined

const exactName = createFilterGenerator(
	([name]: [string], _key: PropertyKey, value: any) =>
		value?.name === name ||
		value?.default?.name === name ||
		value?.type?.name === name ||
		value?.default?.type?.name === name,
	([name]: [string]) => `exactName(${name})`,
	1,
)

function patchTarget(
	module: any,
):
	| { parent: Record<string, (...args: any[]) => any>; key: string }
	| undefined {
	if (typeof module?.default === 'function') {
		return { parent: module, key: 'default' }
	}
	if (typeof module?.default?.type === 'function') {
		return { parent: module.default, key: 'type' }
	}
	if (typeof module?.type === 'function') return { parent: module, key: 'type' }
	return undefined
}

function walkReactTree(
	root: AnyNode,
	visit: (node: NonNullable<AnyNode>) => void,
) {
	if (!root) return
	visit(root)
	const children = root.props?.children
	if (!children) return
	if (Array.isArray(children)) {
		for (const child of children) walkReactTree(child, visit)
	} else {
		walkReactTree(children, visit)
	}
}

function Settings({ api }: { api: BetterBiosApi }) {
	const settings = api.jsonStorage.use()
	const { TableRowGroup, TableSwitchRow } = revenge.discord.design.Design

	return (
		<TableRowGroup>
			<TableSwitchRow
				label="Dismiss ActionSheet"
				subLabel="Close the profile when clicking a link"
				value={settings?.dismiss ?? true}
				onValueChange={dismiss => void api.jsonStorage.set({ dismiss })}
			/>
		</TableRowGroup>
	)
}

/** Direct port of Vendicated's linked BetterBios/ClickableBioLinks snapshot. */
export default plugin<{ jsonStorage: BetterBiosSettings }>({
	jsonStorage: {
		load: true,
		default: { dismiss: true },
	},

	start(api) {
		const patched = new WeakSet<object>()
		api.cleanup(
			getModules(withProps('openURL', 'openDeeplink'), module => {
				urlOpener = module as AnyRecord
			}),
			() => {
				urlOpener = undefined
			},
		)

		api.cleanup(
			getModules(
				exactName('BioText'),
				module => {
					const target = patchTarget(module)
					if (!target || patched.has(target.parent)) return
					patched.add(target.parent)

					api.cleanup(
						revenge.patcher.after(target.parent, target.key, result => {
							if (!result?.props?.children) return result

							result.props.selectable = true
							walkReactTree(result, node => {
								if (node.props?.accessibilityRole !== 'link') return
								const url = node.props.children?.[0]
								if (typeof url !== 'string') return

								node.props.onPress = () => {
									if (typeof urlOpener?.openURL === 'function') {
										void urlOpener.openURL(url)
									} else {
										void Linking.openURL(url)
									}
									if (api.jsonStorage.cache?.dismiss !== false) {
										revenge.discord.actions.ActionSheetActionCreators.hideActionSheet()
									}
								}
							})

							return result
						}),
					)
				},
				{ max: Number.POSITIVE_INFINITY },
			),
		)
	},

	SettingsComponent: Settings,
})
