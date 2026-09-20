import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import * as JSXRuntime from 'react/jsx-runtime'
import {
	Atmosphere,
	setAtmosphereActive,
	setAtmosphereGradient,
} from './Atmosphere'
import { normalize } from './core'

test('ambient native animation stops on low-power, background and unmount without intercepting touches', async () => {
	const previous = (globalThis as any).revenge
	const states: any[] = []
	const effects: any[] = []
	const subscriptions = new Map<any, () => void>()
	let cursor = 0
	let effectCursor = 0
	let started = 0
	let stopped = 0
	let nativeStops = 0
	const configs: any[] = []
	const events: Record<string, (value: any) => void> = {}
	const hooks = {
		...React,
		useSyncExternalStore(subscribe: any, snapshot: any) {
			if (!subscriptions.has(subscribe))
				subscriptions.set(
					subscribe,
					subscribe(() => {}),
				)
			return snapshot()
		},
		useState(initial: any) {
			const index = cursor++
			if (!(index in states)) states[index] = initial()
			return [states[index], () => {}]
		},
		useEffect(effect: () => (() => void) | undefined, deps: any[]) {
			const index = effectCursor++
			if (
				!effects[index] ||
				deps.some((value, i) => value !== effects[index].deps[i])
			) {
				effects[index]?.stop?.()
				effects[index] = { deps, stop: effect() }
			}
		},
	}
	const subscribe = (name: string, callback: (value: any) => void) => {
		events[name] = callback
		return {
			remove: () => {
				delete events[name]
			},
		}
	}
	const native = {
		View: 'View',
		AccessibilityInfo: {
			isReduceMotionEnabled: async () => false,
			addEventListener: subscribe,
		},
		AppState: { currentState: 'active', addEventListener: subscribe },
		Animated: {
			View: 'AnimatedView',
			Value: class {
				interpolate(value: any) {
					return value
				}
				stopAnimation() {
					nativeStops++
				}
				setValue() {}
			},
			timing(_value: any, config: any) {
				configs.push(config)
				return {}
			},
			sequence: (values: any) => values,
			loop: () => ({ start: () => started++, stop: () => stopped++ }),
		},
	}
	;(globalThis as any).revenge = {
		react: { React: hooks, ReactNative: native, ReactJSXRuntime: JSXRuntime },
	}
	const render = (changes: any = {}) => {
		cursor = 0
		effectCursor = 0
		return Atmosphere({
			settings: normalize({ enabled: true, lowPower: false, ...changes }),
		}) as any
	}
	try {
		setAtmosphereGradient(() => null)
		render()
		await Promise.resolve()
		const output = render()
		assert.equal(output.props.pointerEvents, 'none')
		assert.equal(output.props.importantForAccessibility, 'no-hide-descendants')
		assert.equal(started, 1)
		assert.ok(
			configs.every(
				config =>
					config.useNativeDriver &&
					config.isInteraction === false &&
					config.duration === 12000,
			),
		)
		render({ lowPower: true })
		assert.equal(stopped, 1)
		assert.equal(nativeStops, 1)
		render()
		assert.equal(started, 2)
		events.change('background')
		render()
		assert.equal(stopped, 2)
		events.change('active')
		render()
		assert.equal(started, 3)
		setAtmosphereActive(false)
		assert.equal(stopped, 3)
		render()
		assert.equal(started, 3)
	} finally {
		for (const effect of effects) effect?.stop?.()
		for (const stop of subscriptions.values()) stop()
		setAtmosphereGradient(undefined)
		setAtmosphereActive(true)
		;(globalThis as any).revenge = previous
	}
	assert.equal(stopped, 3)
	assert.equal(nativeStops, 3)
	assert.deepEqual(events, {})
})
