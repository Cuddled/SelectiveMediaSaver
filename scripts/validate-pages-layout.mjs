import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

const pagesDirectory = resolve(process.argv[2] ?? 'build/pages')
const baseUrl = (process.argv[3] ?? 'https://revenge.local').replace(/\/+$/, '')

function fail(message) {
	throw new Error(message)
}

async function readJson(path, label) {
	let source
	try {
		source = await readFile(path, 'utf8')
	} catch (error) {
		fail(`${label} is missing: ${error.message}`)
	}

	try {
		return JSON.parse(source)
	} catch (error) {
		fail(`${label} is not valid JSON: ${error.message}`)
	}
}

async function sha256(path) {
	return createHash('sha256')
		.update(await readFile(path))
		.digest('hex')
}

function requireString(value, label) {
	if (typeof value !== 'string' || value.trim() === '')
		fail(`${label} must be a non-empty string`)
}

async function validateClassic() {
	try {
		await stat(join(pagesDirectory, '.nojekyll'))
	} catch (error) {
		fail(`Pages .nojekyll marker is missing: ${error.message}`)
	}

	const manifestPath = join(pagesDirectory, 'manifest.json')
	const scriptPath = join(pagesDirectory, 'index.js')
	const manifest = await readJson(manifestPath, 'Classic manifest.json')

	requireString(manifest.name, 'Classic manifest name')
	requireString(manifest.description, 'Classic manifest description')
	if (!Array.isArray(manifest.authors) || manifest.authors.length === 0) {
		fail('Classic manifest authors must contain at least one author')
	}
	for (const [index, author] of manifest.authors.entries()) {
		requireString(author?.name, `Classic manifest authors[${index}].name`)
	}
	if (manifest.main !== 'index.js')
		fail('Classic manifest main must be exactly "index.js"')
	if (!/^[a-f0-9]{64}$/u.test(manifest.hash ?? '')) {
		fail('Classic manifest hash must be a lowercase SHA-256 digest')
	}

	const script = await readFile(scriptPath, 'utf8')
	if (script.trim() === '') fail('Classic index.js must not be empty')
	try {
		// This matches Classic Revenge's `return ${plugin.js}` loader without executing plugin code.
		new Function('vendetta', `"use strict";\nreturn ${script}\n`)
	} catch (error) {
		fail(`Classic index.js is not a valid loader expression: ${error.message}`)
	}

	const actualHash = await sha256(scriptPath)
	if (actualHash !== manifest.hash) {
		fail(
			`Classic manifest hash ${manifest.hash} does not match index.js SHA-256 ${actualHash}`,
		)
	}

	try {
		await stat(join(pagesDirectory, 'plugin.jar'))
		fail('plugin.jar must not be published at the Classic root')
	} catch (error) {
		if (error.code !== 'ENOENT') throw error
	}
}

function collectVersions(repository, label) {
	if (repository?.format !== 1) fail(`${label} format must be 1`)
	if (typeof repository.plugins !== 'object' || repository.plugins === null) {
		fail(`${label} plugins must be an object`)
	}

	const versions = new Map()
	for (const [pluginId, plugin] of Object.entries(repository.plugins)) {
		if (typeof plugin?.versions !== 'object' || plugin.versions === null) {
			fail(`${label} plugin ${pluginId} is missing versions`)
		}
		for (const [version, release] of Object.entries(plugin.versions)) {
			const key = `${pluginId}@${version}`
			if (versions.has(key)) fail(`${label} contains duplicate release ${key}`)
			versions.set(key, release)
		}
	}
	return versions
}

async function poolFileNames(path) {
	try {
		return (await readdir(path)).filter(name => name.endsWith('.zip')).sort()
	} catch (error) {
		if (error.code === 'ENOENT') return []
		throw error
	}
}

async function validateNextRepositories() {
	const legacyIndex = await readJson(
		join(pagesDirectory, 'index.json'),
		'Legacy Revenge Next index.json',
	)
	const nextIndex = await readJson(
		join(pagesDirectory, 'next', 'index.json'),
		'Revenge Next /next/index.json',
	)
	const legacyVersions = collectVersions(
		legacyIndex,
		'Legacy Revenge Next index',
	)
	const nextVersions = collectVersions(nextIndex, 'Revenge Next index')

	if (legacyVersions.size !== nextVersions.size) {
		fail('Legacy and /next indexes expose different release counts')
	}

	const referencedFiles = new Set()
	for (const [key, legacyRelease] of legacyVersions) {
		const nextRelease = nextVersions.get(key)
		if (!nextRelease) fail(`/next index is missing ${key}`)

		for (const field of ['sha256', 'size', 'dependencies']) {
			if (
				JSON.stringify(legacyRelease[field]) !==
				JSON.stringify(nextRelease[field])
			) {
				fail(`Legacy and /next metadata differ for ${key} field ${field}`)
			}
		}

		const legacyPrefix = `${baseUrl}/pool/`
		const nextPrefix = `${baseUrl}/next/pool/`
		if (
			typeof legacyRelease.url !== 'string' ||
			!legacyRelease.url.startsWith(legacyPrefix)
		) {
			fail(`${key} legacy URL must start with ${legacyPrefix}`)
		}
		if (
			typeof nextRelease.url !== 'string' ||
			!nextRelease.url.startsWith(nextPrefix)
		) {
			fail(`${key} /next URL must start with ${nextPrefix}`)
		}

		const legacyName = basename(new URL(legacyRelease.url).pathname)
		const nextName = basename(new URL(nextRelease.url).pathname)
		if (legacyName !== nextName || legacyName === '')
			fail(`${key} uses inconsistent artifact filenames`)
		referencedFiles.add(legacyName)

		for (const relativePath of [
			['pool', legacyName],
			['next', 'pool', nextName],
		]) {
			const artifactPath = join(pagesDirectory, ...relativePath)
			const details = await stat(artifactPath).catch(error =>
				fail(
					`${key} artifact ${relativePath.join('/')} is missing: ${error.message}`,
				),
			)
			if (details.size !== legacyRelease.size) {
				fail(`${key} size metadata does not match ${relativePath.join('/')}`)
			}
			if ((await sha256(artifactPath)) !== legacyRelease.sha256) {
				fail(`${key} SHA-256 metadata does not match ${relativePath.join('/')}`)
			}
		}
	}

	const legacyFiles = await poolFileNames(join(pagesDirectory, 'pool'))
	const nextFiles = await poolFileNames(join(pagesDirectory, 'next', 'pool'))
	if (JSON.stringify(legacyFiles) !== JSON.stringify(nextFiles)) {
		fail(
			'Legacy /pool and canonical /next/pool do not contain the same artifacts',
		)
	}
	if (
		JSON.stringify(legacyFiles) !== JSON.stringify([...referencedFiles].sort())
	) {
		fail(
			'One or more Revenge Next pool artifacts are not represented in the indexes',
		)
	}
}

await validateClassic()
await validateNextRepositories()
console.log(
	`Validated Classic root and mirrored Revenge Next repositories in ${pagesDirectory}`,
)
