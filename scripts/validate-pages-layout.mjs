import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

const pagesDirectory = resolve(process.argv[2] ?? 'build/pages')
const baseUrl = (process.argv[3] ?? 'https://revenge.local').replace(/\/+$/, '')
const midnightGlassPublicUrl =
	'https://cuddled.github.io/SelectiveMediaSaver/themes/midnight-glass'

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

function requireHexColor(value, label) {
	if (
		typeof value !== 'string' ||
		!/^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/iu.test(value)
	) {
		fail(`${label} must be a six- or eight-digit hexadecimal color`)
	}
}

async function validateMidnightGlass() {
	const themeDirectory = join(pagesDirectory, 'themes', 'midnight-glass')
	const manifest = await readJson(
		join(themeDirectory, 'theme.json'),
		'Midnight Glass theme.json',
	)

	if (manifest.spec !== 2) fail('Midnight Glass must use Revenge theme spec 2')
	if (manifest.name !== 'Midnight Glass') {
		fail('Midnight Glass theme name must be exactly "Midnight Glass"')
	}
	requireString(manifest.description, 'Midnight Glass description')
	if (!Array.isArray(manifest.authors) || manifest.authors.length === 0) {
		fail('Midnight Glass authors must contain at least one author')
	}
	for (const [index, author] of manifest.authors.entries()) {
		requireString(author?.name, `Midnight Glass authors[${index}].name`)
		if (author.id !== undefined && !/^\d{17,20}$/u.test(author.id)) {
			fail(`Midnight Glass authors[${index}].id must be a Discord snowflake`)
		}
	}

	if (
		typeof manifest.semanticColors !== 'object' ||
		manifest.semanticColors === null
	) {
		fail('Midnight Glass semanticColors must be an object')
	}
	for (const [name, values] of Object.entries(manifest.semanticColors)) {
		if (!Array.isArray(values) || values.length < 1 || values.length > 2) {
			fail(`Midnight Glass semantic color ${name} must have one or two values`)
		}
		for (const [index, value] of values.entries()) {
			requireHexColor(value, `Midnight Glass ${name}[${index}]`)
		}
	}
	for (const required of [
		'HEADER_PRIMARY',
		'TEXT_NORMAL',
		'BACKGROUND_PRIMARY',
		'BACKGROUND_SECONDARY',
		'BACKGROUND_TERTIARY',
		'BACKGROUND_FLOATING',
		'CHANNELTEXTAREA_BACKGROUND',
		'CHAT_BACKGROUND',
	]) {
		if (!(required in manifest.semanticColors)) {
			fail(`Midnight Glass is missing required semantic color ${required}`)
		}
	}
	for (const required of [
		'BACKGROUND_PRIMARY',
		'BACKGROUND_SECONDARY',
		'BACKGROUND_SECONDARY_ALT',
		'BACKGROUND_TERTIARY',
		'BACKGROUND_FLOATING',
		'BACKGROUND_MOBILE_PRIMARY',
		'BACKGROUND_MOBILE_SECONDARY',
		'BACKGROUND_NESTED_FLOATING',
		'BACKGROUND_BASE_LOW',
		'BACKGROUND_BASE_LOWER',
		'BACKGROUND_BASE_LOWEST',
		'BACKGROUND_SURFACE_HIGH',
		'BACKGROUND_SURFACE_HIGHEST',
		'BG_SURFACE_RAISED',
		'BACKGROUND_MESSAGE_HOVER',
		'BACKGROUND_MODIFIER_HOVER',
		'BACKGROUND_MODIFIER_ACTIVE',
		'BACKGROUND_MODIFIER_SELECTED',
		'BACKGROUND_MODIFIER_ACCENT',
		'CHANNELTEXTAREA_BACKGROUND',
		'REDESIGN_CHAT_INPUT_BACKGROUND',
		'CHAT_INPUT_BACKGROUND',
		'INPUT_BACKGROUND_DEFAULT',
		'CHAT_BACKGROUND',
		'CARD_PRIMARY_BG',
		'CARD_BACKGROUND_DEFAULT',
		'CARD_SECONDARY_BACKGROUND_DEFAULT',
		'CARD_SECONDARY_BG',
		'CHANNEL_BACKGROUND_DEFAULT',
		'MODAL_BACKGROUND',
		'MODAL_FOOTER_BACKGROUND',
		'PANEL_BG',
		'MOBILE_ACTIONSHEET_BACKGROUND',
		'MOBILE_ALERT_BACKGROUND_DEFAULT',
		'MOBILE_CHATINPUT_BACKGROUND_DEFAULT',
		'MOBILE_EXPRESSION_PICKER_BACKGROUND_DEFAULT',
		'MOBILE_FLOATING_ACCESSORY_BACKGROUND',
		'MOBILE_FLOATINGBAR_BACKGROUND',
		'MOBILE_KEYBOARD_PANEL_BACKGROUND',
		'MOBILE_TOAST_BACKGROUND_DEFAULT',
		'TAB_BAR_BACKGROUND',
		'TABLEROW_BACKGROUND_DEFAULT',
		'USER_PROFILE_CONTAINER_BACKGROUND',
	]) {
		const colors = manifest.semanticColors[required]
		if (
			!colors?.every(
				color =>
					typeof color === 'string' &&
					/^#[a-f0-9]{8}$/iu.test(color) &&
					Number.parseInt(color.slice(7), 16) > 0 &&
					Number.parseInt(color.slice(7), 16) < 255,
			)
		) {
			fail(`Midnight Glass surface ${required} must be translucent #RRGGBBAA`)
		}
	}
	for (const required of [
		'HEADER_PRIMARY',
		'HEADER_SECONDARY',
		'TEXT_NORMAL',
		'TEXT_MUTED',
		'TEXT_DEFAULT',
		'TEXT_STRONG',
		'TEXT_SUBTLE',
		'TEXT_BRAND',
		'ICON_DEFAULT',
		'ICON_STRONG',
		'ICON_SUBTLE',
		'ICON_MUTED',
		'INTERACTIVE_NORMAL',
	]) {
		const colors = manifest.semanticColors[required]
		if (!colors?.every(color => /^#[a-f0-9]{6}$/iu.test(color))) {
			fail(`Midnight Glass readable color ${required} must remain opaque`)
		}
	}

	if (typeof manifest.rawColors !== 'object' || manifest.rawColors === null) {
		fail('Midnight Glass rawColors must be an object')
	}
	for (const [name, value] of Object.entries(manifest.rawColors)) {
		requireHexColor(value, `Midnight Glass raw color ${name}`)
	}
	for (const required of [
		'PRIMARY_100',
		'PRIMARY_600',
		'PRIMARY_700',
		'BRAND_500',
	]) {
		if (!(required in manifest.rawColors)) {
			fail(`Midnight Glass is missing required raw color ${required}`)
		}
	}

	if (typeof manifest.background !== 'object' || manifest.background === null) {
		fail('Midnight Glass background must be an object')
	}
	const expectedBackgroundUrl = `${midnightGlassPublicUrl}/background-v1.png`
	if (manifest.background.url !== expectedBackgroundUrl) {
		fail(
			`Midnight Glass background URL must be exactly ${expectedBackgroundUrl}`,
		)
	}
	if (
		typeof manifest.background.blur !== 'number' ||
		!Number.isFinite(manifest.background.blur) ||
		manifest.background.blur < 0 ||
		manifest.background.blur > 100
	) {
		fail('Midnight Glass background blur must be a number from 0 through 100')
	}
	if (
		typeof manifest.background.alpha !== 'number' ||
		!Number.isFinite(manifest.background.alpha) ||
		manifest.background.alpha < 0 ||
		manifest.background.alpha > 1
	) {
		fail('Midnight Glass background alpha must be a number from 0 through 1')
	}

	const backgroundPath = join(themeDirectory, 'background-v1.png')
	const background = await readFile(backgroundPath).catch(error =>
		fail(`Midnight Glass background-v1.png is missing: ${error.message}`),
	)
	const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex')
	if (
		background.length < 24 ||
		!background.subarray(0, 8).equals(pngSignature)
	) {
		fail('Midnight Glass background-v1.png is not a valid PNG container')
	}
	if (background.length > 8 * 1024 * 1024) {
		fail('Midnight Glass background-v1.png must not exceed 8 MiB')
	}
	const width = background.readUInt32BE(16)
	const height = background.readUInt32BE(20)
	if (width < 720 || height < 1280 || height <= width) {
		fail(
			`Midnight Glass background must be a portrait image of at least 720×1280; received ${width}×${height}`,
		)
	}
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
await validateMidnightGlass()
console.log(
	`Validated Classic root, mirrored Revenge Next repositories, and Midnight Glass theme in ${pagesDirectory}`,
)
