import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const javascriptSourceUrl = new URL('./index.ts', import.meta.url)
const nativeSourceUrl = new URL(
	'../src/main/kotlin/com/cuddled/selectivemediasaver/SelectiveMediaSaverPlugin.kt',
	import.meta.url,
)

test('recoverable startup failures do not enter Revenge fatal error handling', async () => {
	const [javascriptSource, nativeSource] = await Promise.all([
		readFile(javascriptSourceUrl, 'utf8'),
		readFile(nativeSourceUrl, 'utf8'),
	])

	assert.doesNotMatch(javascriptSource, /api\.plugin\.reportError\s*\(/)
	assert.doesNotMatch(nativeSource, /\berrors\.tryEmit\s*\(/)
})

test('native startup falls back to Revenge supplied context', async () => {
	const nativeSource = await readFile(nativeSourceUrl, 'utf8')

	assert.match(
		nativeSource,
		/val serviceContext = context\.applicationContext \?: context/,
	)
	assert.doesNotMatch(
		nativeSource,
		/context\s*=\s*context\.applicationContext\s*[,)]/,
	)
})
