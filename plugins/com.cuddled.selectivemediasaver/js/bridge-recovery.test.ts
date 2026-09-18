import assert from 'node:assert/strict'
import test from 'node:test'
import {
	nativeBridgeErrorMessage,
	nativeCapabilitiesReady,
	probeNativeCapabilities,
} from './bridge-recovery'
import type { NativeCapabilities } from './types'

function capabilities(
	overrides: Partial<NativeCapabilities> = {},
): NativeCapabilities {
	return {
		ok: true,
		streamDownload: true,
		mediaStore: true,
		open: true,
		share: true,
		delete: true,
		apiLevel: 36,
		minApi: 29,
		targetApi: 36,
		compileApi: 36,
		storageMode: 'MediaStore',
		storageMounted: true,
		legacyWritePermissionRequired: false,
		legacyWritePermissionGranted: true,
		httpsOnly: true,
		maxBytes: 512 * 1024 * 1024,
		defaultMaxBytes: 100 * 1024 * 1024,
		allowedHosts: ['cdn.discordapp.com'],
		allowedMimeTypes: ['image/png'],
		allowedExtensions: ['png'],
		paths: {
			imagesRelative: 'Pictures/SelectiveMediaSaver',
			videosRelative: 'Movies/SelectiveMediaSaver',
			imagesPublic: 'Pictures/SelectiveMediaSaver',
			videosPublic: 'Movies/SelectiveMediaSaver',
		},
		...overrides,
	}
}

test('native capability readiness requires streaming MediaStore support', () => {
	assert.equal(nativeCapabilitiesReady(capabilities()), true)
	assert.equal(
		nativeCapabilitiesReady(capabilities({ streamDownload: false })),
		false,
	)
	assert.equal(
		nativeCapabilitiesReady(capabilities({ mediaStore: false })),
		false,
	)
})

test('native capability probe recovers when registration finishes after JS starts', async () => {
	let calls = 0
	let starts = 0
	const waits: number[] = []
	const result = await probeNativeCapabilities(
		async () => {
			calls += 1
			if (calls < 3) {
				throw new Error(
					'Native bridge method not registered: com.cuddled.selectivemediasaver.capabilities',
				)
			}
			return capabilities()
		},
		{
			beforeProbe: async () => {
				starts += 1
			},
			retryDelaysMs: [0, 250, 1_000],
			wait: async milliseconds => {
				waits.push(milliseconds)
			},
		},
	)

	assert.equal(result.ready, true)
	assert.equal(result.attempts, 3)
	assert.equal(starts, 1)
	assert.equal(calls, 3)
	assert.deepEqual(waits, [250, 1_000])
})

test('native capability probe reports a useful final registration failure', async () => {
	const result = await probeNativeCapabilities(
		async () => {
			throw new Error(
				'Native bridge method not registered: com.cuddled.selectivemediasaver.capabilities',
			)
		},
		{ retryDelaysMs: [0, 1], wait: async () => undefined },
	)

	assert.equal(result.ready, false)
	assert.equal(result.attempts, 2)
	assert.match(result.error ?? '', /did not register its bridge method/i)
	assert.match(
		result.error ?? '',
		/com\.cuddled\.selectivemediasaver\.capabilities/,
	)
})

test('native capability probe does not retry an unsupported loaded bridge', async () => {
	let calls = 0
	const result = await probeNativeCapabilities(
		async () => {
			calls += 1
			return capabilities({ mediaStore: false })
		},
		{ retryDelaysMs: [0, 250, 1_000], wait: async () => undefined },
	)

	assert.equal(result.ready, false)
	assert.equal(result.attempts, 1)
	assert.equal(calls, 1)
	assert.match(result.error ?? '', /MediaStore support/i)
})

test('native capability probe restarts the companion before checking capabilities', async () => {
	let starts = 0
	let probes = 0
	const order: string[] = []

	const result = await probeNativeCapabilities(
		async () => {
			order.push('capabilities')
			probes += 1
			return capabilities()
		},
		{
			beforeProbe: async () => {
				order.push('startNative')
				starts += 1
			},
			retryDelaysMs: [0, 1],
			wait: async () => undefined,
		},
	)

	assert.equal(starts, 1)
	assert.equal(probes, 1)
	assert.deepEqual(order, ['startNative', 'capabilities'])
	assert.equal(result.ready, true)
})

test('native capability probe still checks the bridge when lifecycle recovery fails', async () => {
	let probes = 0

	const result = await probeNativeCapabilities(
		async () => {
			probes += 1
			return capabilities()
		},
		{
			beforeProbe: async () => {
				throw new Error('Native lifecycle method unavailable')
			},
			retryDelaysMs: [0],
		},
	)

	assert.equal(probes, 1)
	assert.equal(result.ready, true)
})

test('native bridge error formatting tolerates non-Error values', () => {
	assert.equal(
		nativeBridgeErrorMessage('service unavailable'),
		'Native companion unavailable: service unavailable',
	)
	assert.equal(
		nativeBridgeErrorMessage(undefined),
		'Native companion unavailable: undefined',
	)
})

test('native bridge error formatting removes Java stack traces from the settings status', () => {
	const message = nativeBridgeErrorMessage(
		new Error(
			'Call failed: java.lang.Error: Native bridge method not registered: com.cuddled.selectivemediasaver.capabilities\n' +
				'  at io.github.revenge.xposed.tweaks.bridge.RevengeBridgeRegistry.tryDispatchNativeAsync(RevengeBridgeSupport.kt:170)\n' +
				'  at de.robv.android.xposed.XposedBridge.handleBefore(SourceFile:5)',
		),
	)

	assert.match(message, /did not register its bridge method/i)
	assert.match(message, /com\.cuddled\.selectivemediasaver\.capabilities/)
	assert.doesNotMatch(message, /RevengeBridgeRegistry|XposedBridge/)
})
