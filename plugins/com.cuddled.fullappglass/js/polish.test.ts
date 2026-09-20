import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { createState, DEFAULT_SETTINGS, normalize } from './core'
import {
	compactMenuBody,
	createPolish,
	polishBaseChannel,
	polishEnabled,
	polishHandle,
	polishRow,
	polishSheet,
	polishStyles,
	polishTextChannel,
	scopeMenuCard,
} from './polish'

const active = normalize({ enabled: true })

function textChannel(selected = true): React.ReactElement<any> {
	const row = React.createElement(
		'View',
		{ style: { padding: 8 }, ref: React.createRef(), onLayout: () => {} },
		[
			React.createElement('Icon', { key: 'icon' }),
			React.createElement('Text', { key: 'name' }, 'general'),
			React.createElement('Badge', { key: 'mentions', count: 3 }),
		],
	)
	const outline =
		selected && React.createElement('View', { style: { position: 'absolute' } })
	const pressable = React.createElement(
		'Pressable',
		{
			style: [{ marginVertical: 2 }, { borderRadius: 8 }],
			accessibilityRole: 'button',
			accessibilityState: { selected, disabled: true },
			onPress: () => {},
			onPressIn: () => {},
			onLongPress: () => {},
			ref: React.createRef(),
			accessibilityLabel: 'general, 3 mentions',
		},
		[outline, row],
	)
	return React.createElement(React.Fragment, {}, [
		React.createElement('Unread', { key: 'unread', unread: true }),
		pressable,
		React.createElement('Coachmark', { key: 'coachmark' }),
	])
}

test('beta4 settings migrate additively and invalid custom colors never reach native styling', () => {
	const old = {
		enabled: true,
		panelColor: '#291835',
		textColor: '#F7F8FF',
		transparency: 0.47,
		darkness: 0.62,
		blur: 7,
		lowPower: false,
		menus: false,
		chats: false,
	}
	const original = structuredClone(old)
	const migrated = normalize(old)
	for (const [key, value] of Object.entries(old))
		assert.equal((migrated as any)[key], value)
	assert.deepEqual(old, original)
	assert.equal(migrated.accentColor, '#B8A1FF')
	assert.equal(migrated.polishChannels, true)
	assert.equal(normalize(null).enabled, false)
	for (const accentColor of [
		'rgba(1,2,3,1)',
		'#GGGGGG',
		'#B8A1FF99',
		{},
		null,
	]) {
		const settings = normalize({
			...migrated,
			accentColor,
			accentOpacity: Infinity,
		})
		assert.equal(settings.accentColor, DEFAULT_SETTINGS.accentColor)
		assert.match(
			polishStyles(settings).channelOutline.borderColor,
			/^#[A-F0-9]{8}$/,
		)
	}
	assert.equal(
		normalize({ accentColor: '#aBc', accentOpacity: 4 }).accentColor,
		'#AABBCC',
	)
	assert.equal(normalize({ accentOpacity: 4 }).accentOpacity, 1)
	assert.equal(normalize({ accentOpacity: -1 }).accentOpacity, 0)
})

test('polish switches respect the existing area controls and retain choices when paused', () => {
	for (const area of ['Channels', 'Composer', 'Menus'] as const) {
		assert.equal(polishEnabled(active, area), true)
		assert.equal(polishEnabled({ ...active, enabled: false }, area), false)
		assert.equal(
			polishEnabled({ ...active, [`polish${area}`]: false }, area),
			false,
		)
	}
	assert.equal(
		polishEnabled({ ...active, mainScreens: false }, 'Channels'),
		false,
	)
	assert.equal(polishEnabled({ ...active, controls: false }, 'Channels'), false)
	assert.equal(polishEnabled({ ...active, chats: false }, 'Composer'), false)
	assert.equal(polishEnabled({ ...active, controls: false }, 'Composer'), false)
	assert.equal(polishEnabled({ ...active, menus: false }, 'Menus'), false)
	const state = createState({ ...active, accentColor: '#9EE8CE' })
	state.update({ ...state.getSettings(), enabled: false })
	assert.equal(state.getSettings().accentColor, '#9EE8CE')
	assert.equal(
		polishStyles({ ...active, accentOpacity: 0 }).channelOutline.borderColor,
		'#B8A1FF00',
	)
})

test('text channel decoration preserves touch actions, refs, badges, unread state and measured row layout', () => {
	for (const selected of [true, false]) {
		const original = textChannel(selected)
		const next = polishTextChannel(React, original, active) as any
		const before = original.props.children[1] as React.ReactElement<any>
		const after = next.props.children[1]
		assert.equal(next.type, original.type)
		for (const key of [
			'ref',
			'onPress',
			'onLongPress',
			'onPressIn',
			'accessibilityLabel',
			'accessibilityState',
		])
			assert.equal(after.props[key], before.props[key])
		assert.equal(after.props.style[0], before.props.style)
		assert.equal(after.props.children[1], before.props.children[1])
		assert.equal(next.props.children[0], original.props.children[0])
		assert.equal(next.props.children[2], original.props.children[2])
		assert.equal(Object.hasOwn(after.props.style[1], 'height'), false)
		assert.equal(Object.hasOwn(after.props.style[1], 'padding'), false)
		if (selected) {
			assert.equal(after.props.children[0].props.pointerEvents, 'none')
			assert.equal(
				after.props.children[0].props.style[1].borderColor,
				'#B8A1FFA5',
			)
		}
		assert.equal(
			polishTextChannel(React, original, { ...active, polishChannels: false }),
			original,
		)
	}
})

test('base channel outlines preserve thread extras and stable child slots when selection or styling changes', () => {
	const content = [
		null,
		React.createElement('Icon', { key: 'icon' }),
		React.createElement('Name', { key: 'name' }),
		React.createElement('VoiceInfo', { key: 'info' }),
	]
	const row = React.createElement('View', { style: { minHeight: 36 } }, content)
	const extra = React.createElement('VoiceUsers', { users: ['one', 'two'] })
	const original = React.createElement(
		'Pressable',
		{
			onPress: () => {},
			onLongPress: () => {},
			accessibilityRole: 'button',
			accessibilityState: { selected: true },
			style: { marginLeft: 28 },
		},
		[row, extra],
	)
	const next = polishBaseChannel(React, 'View', original, active) as any
	const off = polishBaseChannel(React, 'View', original, {
		...active,
		enabled: false,
	}) as any
	assert.equal(next.props.onPress, original.props.onPress)
	assert.equal(next.props.style[0], original.props.style)
	assert.equal(next.props.children[1], extra)
	assert.equal(next.props.children[0].props.style[0], row.props.style)
	assert.equal(
		next.props.children[0].props.children[0].props.pointerEvents,
		'none',
	)
	assert.equal(next.props.children[0].props.children[1].props.children, content)
	assert.equal(off.props.children[0].props.children[0], null)
	assert.equal(
		off.props.children[0].props.children[1].key,
		next.props.children[0].props.children[1].key,
	)
	assert.equal(off.props.children[0].props.style, row.props.style)
})

test('action sheets retain dismiss/keyboard/scroll/ref behavior and skip custom backgrounds', () => {
	const body = React.createElement('Actions')
	const original = React.createElement(
		'BottomSheet',
		{
			ref: React.createRef(),
			onDismiss: () => {},
			onExpand: () => {},
			handleComponent: () => {},
			backgroundStyles: { elevation: 8 },
			contentStyles: { paddingHorizontal: 16 },
			bodyStyles: { gap: 24 },
			scrollable: true,
			startExpanded: true,
			keyboardShouldPersistTaps: 'handled',
			showGradient: true,
		},
		body,
	)
	const next = polishSheet(React, original, active) as any
	for (const key of [
		'ref',
		'onDismiss',
		'onExpand',
		'handleComponent',
		'contentStyles',
		'scrollable',
		'startExpanded',
		'keyboardShouldPersistTaps',
		'children',
	])
		assert.equal(next.props[key], (original.props as any)[key])
	assert.equal(next.props.backgroundStyles[0], original.props.backgroundStyles)
	assert.equal(next.props.backgroundStyles[1].backgroundColor, active.menuColor)
	assert.deepEqual(next.props.bodyStyles, [
		original.props.bodyStyles,
		{ gap: 8 },
	])
	assert.equal(
		(polishSheet(React, original, { ...active, compactMenus: false }) as any)
			.props.bodyStyles,
		original.props.bodyStyles,
	)
	assert.equal(next.props.showGradient, false)
	for (const props of [
		{ backgroundComponent: () => null },
		{ borderGradient: ['red', 'blue'] },
	]) {
		const custom = React.cloneElement(original, props as any)
		assert.equal(polishSheet(React, custom, active), custom)
	}
	assert.equal(
		polishSheet(React, original, { ...active, menus: false }),
		original,
	)
})

test('beta5 settings retain their tint and accents while menu options get independent defaults', () => {
	const saved = {
		enabled: true,
		panelColor: '#291835',
		accentColor: '#9EE8CE',
		accentOpacity: 0.2,
		polishMenus: false,
		transparency: 0.41,
	}
	const migrated = normalize(saved)
	for (const [key, value] of Object.entries(saved))
		assert.equal((migrated as any)[key], value)
	assert.equal(migrated.menuColor, '#111321')
	assert.equal(migrated.compactMenus, true)
	assert.equal(normalize({ menuColor: 'rgba(1,2,3,1)' }).menuColor, '#111321')
	const changed = normalize({
		...migrated,
		menuColor: '#abc',
		compactMenus: false,
	})
	assert.equal(changed.menuColor, '#AABBCC')
	assert.equal(changed.panelColor, saved.panelColor)
	assert.equal(changed.compactMenus, false)
})

test('compact action rows use stable scoped renderers, retain semantics and restore stock spacing live', () => {
	const state = createState(active)
	const hooks = {
		...React,
		useSyncExternalStore: (_s: any, snapshot: any) => snapshot(),
	}
	const ui = createPolish(hooks, 'View', { ...state, isActive: () => true })
	const children = [
		null,
		React.createElement('Icon', { key: 'icon' }),
		React.createElement(
			'Text',
			{
				allowFontScaling: true,
			},
			'A long action label that can wrap',
		),
		null,
		null,
	]
	const body = React.createElement(
		'View',
		{
			style: [
				{ minHeight: 64, padding: 16, opacity: 0.5 },
				{ height: undefined },
			],
			ref: React.createRef(),
			onLayout: () => {},
		},
		children,
	)
	let innerCalls = 0
	const Inner = () => {
		innerCalls++
		return body
	}
	const divider = React.createElement('Divider')
	const onPress = () => {}
	const Row = (props: any) =>
		React.createElement(React.Fragment, {}, [
			React.createElement(
				'InternalCard',
				{
					border: 'none',
					shadow: 'none',
					variant: 'muted',
					disabled: props.disabled,
					onPress: props.onPress,
					ref: props.ref,
					style: props.style,
				},
				React.createElement(Inner, props),
			),
			divider,
		])
	const originalRow = React.createElement(Row, {
		label: 'Delete message',
		variant: 'danger',
		disabled: true,
		onPress,
		ref: React.createRef(),
		key: 'delete',
	})
	const original = React.createElement(
		'Provider',
		{ value: 'danger' },
		originalRow,
	)
	const wrapped = ui.wrap('row', original) as any
	const render = () => {
		const provider = wrapped.type(wrapped.props)
		const row = provider.props.children
		const fragment = row.type(row.props)
		const card = fragment.props.children[0]
		const inner = card.props.children
		return {
			provider,
			row,
			fragment,
			card,
			inner,
			body: inner.type(inner.props),
		}
	}
	const compact = render()
	assert.equal(compact.provider.props.value, 'danger')
	assert.equal(compact.card.props.disabled, true)
	assert.equal(compact.card.props.onPress, onPress)
	assert.equal(compact.row.key, 'delete')
	assert.equal(compact.row.props.ref, originalRow.props.ref)
	assert.equal(compact.fragment.props.children[1], divider)
	assert.equal(compact.body.props.children, children)
	assert.equal(compact.body.props.ref, body.props.ref)
	assert.equal(compact.body.props.onLayout, body.props.onLayout)
	assert.deepEqual(compact.body.props.style[1], {
		minHeight: 52,
		paddingVertical: 10,
	})
	assert.equal(Object.hasOwn(compact.body.props.style[1], 'height'), false)
	// Ordinary TableRow calls never pass through the ActionSheetRow boundary.
	assert.equal(
		(Row(originalRow.props).props.children as any[])[0].props.children.type,
		Inner,
	)
	for (const changes of [
		{ compactMenus: false },
		{ menus: false },
		{ polishMenus: false },
		{ enabled: false },
	]) {
		state.update({ ...active, ...changes })
		const off = render()
		assert.equal(off.row.type, compact.row.type)
		assert.equal(off.inner.type, compact.inner.type)
		assert.equal(off.body, body)
	}
	state.update(active)
	assert.deepEqual(render().body.props.style[1], {
		minHeight: 52,
		paddingVertical: 10,
	})
	ui.dispose()
	assert.equal(render().body, body)
	assert.equal(innerCalls, 7)
})

test('compact menus skip custom-sized and rich rows, and guard unfamiliar card/body layouts', () => {
	const body = React.createElement('View', { style: { padding: 16 } }, [
		null,
		null,
		null,
		null,
		null,
	])
	for (const props of [
		{ height: 80 },
		{ subLabel: 'Details' },
		{ trailing: React.createElement('Switch') },
		{ draggable: true },
		{ dragHandlePressableProps: {} },
		{ label: React.createElement('Custom') },
	])
		assert.equal(
			compactMenuBody(React, body, { label: 'Action', ...props }, active),
			body,
		)
	for (const original of [
		null,
		{},
		React.createElement('Unknown', {}, body),
		React.createElement('View', { style: {} }, [null]),
	]) {
		assert.equal(
			compactMenuBody(React, original, { label: 'Action' }, active),
			original,
		)
		assert.equal(
			scopeMenuCard(React, original, () => {
				throw Error('Unexpected wrapper')
			}),
			original,
		)
	}
	const ui = createPolish(
		{ ...React, useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
		'View',
		{
			...createState(active),
			isActive: () => true,
		},
	)
	for (const style of [{ height: 90 }, [{ paddingVertical: 24 }], 123]) {
		const Inner = () => body
		const Row = (props: any) =>
			React.createElement(
				'InternalCard',
				{
					border: 'none',
					shadow: 'none',
					variant: 'muted',
				},
				React.createElement(Inner, props),
			)
		const original = React.createElement(
			'Provider',
			{ value: 'default' },
			React.createElement(Row, { label: 'Action', variant: 'default', style }),
		)
		const wrapped = ui.wrap('row', original) as any
		const row = wrapped.type(wrapped.props).props.children
		const inner = row.type(row.props).props.children
		assert.equal(inner.type(inner.props), body)
	}
})

test('menu row styling never changes danger labels, disabled actions, icons or callbacks', () => {
	for (const variant of ['default', 'danger']) {
		const row = React.createElement('TableRow', {
			variant,
			disabled: true,
			label: 'Delete message',
			icon: React.createElement('DangerIcon'),
			onPress: () => {},
			arrow: false,
			style: { opacity: 0.6 },
			height: 62,
		})
		const original = React.createElement('Provider', { value: variant }, row)
		const next = polishRow(React, original, active) as any
		assert.equal(next.type, original.type)
		assert.equal(next.props.value, variant)
		for (const key of [
			'variant',
			'disabled',
			'label',
			'icon',
			'onPress',
			'arrow',
			'height',
		])
			assert.equal(next.props.children.props[key], (row.props as any)[key])
		assert.equal(next.props.children.props.style[0], row.props.style)
	}
})

test('sheet handles preserve the screen-reader dismiss target and all touch handlers', () => {
	const bar = React.createElement('View', { style: { height: 4, width: 32 } })
	const container = React.createElement(
		'View',
		{ style: { marginBottom: 16 } },
		bar,
	)
	const touchable = React.createElement(
		'Touchable',
		{ 'aria-hidden': true, onPress: () => {}, onAccessibilityEscape: () => {} },
		container,
	)
	const dismiss = React.createElement('Pressable', {
		accessibilityRole: 'button',
		accessibilityLabel: 'Dismiss',
		onPress: () => {},
	})
	for (const fragment of [true, false]) {
		const original = fragment
			? React.createElement(React.Fragment, {}, [dismiss, touchable])
			: touchable
		const next = polishHandle(React, original, active) as any
		const result = fragment ? next.props.children[1] : next
		if (fragment) assert.equal(next.props.children[0], dismiss)
		assert.equal(result.props.onPress, touchable.props.onPress)
		assert.equal(
			result.props.onAccessibilityEscape,
			touchable.props.onAccessibilityEscape,
		)
		assert.equal(
			result.props.children.props.children.props.style[0],
			bar.props.style,
		)
	}
})

test('unknown outputs are untouched and mounted polish observes live colors, pause and disposal', () => {
	for (const original of [
		null,
		{},
		[],
		React.createElement('Unknown', { style: {} }),
	]) {
		for (const transform of [
			polishTextChannel,
			polishSheet,
			polishRow,
			polishHandle,
		])
			assert.equal(transform(React, original, active), original)
		assert.equal(polishBaseChannel(React, 'View', original, active), original)
	}
	const state = createState(active)
	const hooks = {
		...React,
		useSyncExternalStore: (_subscribe: any, snapshot: () => string) =>
			snapshot(),
	} as typeof React
	const ui = createPolish(hooks, 'View', { ...state, isActive: () => true })
	const original = textChannel()
	const wrapper = ui.wrap('text-channel', original) as any
	const render = () => wrapper.type(wrapper.props)
	state.update({
		...state.getSettings(),
		accentColor: '#9EE8CE',
		accentOpacity: 1,
	})
	assert.equal(
		render().props.children[1].props.children[0].props.style[1].borderColor,
		'#9EE8CEFF',
	)
	state.update({ ...state.getSettings(), enabled: false })
	assert.equal(render(), original)
	state.update(active)
	ui.dispose()
	assert.equal(render(), original)
	assert.equal(ui.wrap('text-channel', original), original)
})
