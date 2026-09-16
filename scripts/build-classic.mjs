import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { transform } from 'esbuild'

const root = path.resolve(import.meta.dirname, '..')
const sourcePath = path.join(root, 'classic', 'src', 'index.cjs')
const outputDirectory = path.join(root, 'build', 'classic')
const outputPath = path.join(outputDirectory, 'index.js')
const manifestPath = path.join(outputDirectory, 'manifest.json')

const source = await readFile(sourcePath, 'utf8')
const result = await transform(source, {
	loader: 'js',
	minify: true,
	target: 'es2020',
	legalComments: 'none',
})
const bundle = result.code.trimStart()

if (!bundle.startsWith('function')) {
	throw new Error(
		'Classic bundle must begin with a function expression for the Revenge 1.11.6 loader',
	)
}

await mkdir(outputDirectory, { recursive: true })
await writeFile(outputPath, bundle, 'utf8')

const manifest = {
	name: 'Selective Media Saver',
	description:
		'Automatically save selected Discord images, GIFs, videos, avatars, and banners on Android.',
	authors: [{ name: 'Cuddled' }],
	main: 'index.js',
	hash: createHash('sha256').update(bundle).digest('hex'),
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`Built classic Revenge plugin: ${manifest.hash}`)
