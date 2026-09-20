export const REPOSITORY = 'https://cuddled.github.io/SelectiveMediaSaver/next'
export const GLASS_ID = 'com.cuddled.fullappglass'
export const TARGET_VERSION = '1.0.0-beta15'
export const TARGET_SHA256 =
	'a59b040109fe3654f56aade8006efa642cd8d700d750250cfa9d6eeef74e183f'
export const TARGET_SIZE = 78944
export const TARGET_URL = `${REPOSITORY}/pool/${GLASS_ID}@${TARGET_VERSION}.zip`

export type NativeCall = (name: string, args: unknown[]) => Promise<any>

export async function repairGlass(
	call: NativeCall,
	onProgress: (message: string) => void,
	isActive: () => boolean = () => true,
): Promise<void> {
	onProgress('Checking the update repository…')
	const repos = await call('revenge.plugins.repos.list', [])
	if (
		!Array.isArray(repos) ||
		!repos.some(repo => repo?.url === REPOSITORY && repo.enabled)
	) {
		throw new Error(
			`Add and enable this repository in Plugins → Advanced: ${REPOSITORY}`,
		)
	}
	await call('revenge.plugins.repos.refresh', [REPOSITORY])
	const plan = await call('revenge.plugins.planInstall', [
		GLASS_ID,
		TARGET_VERSION,
		'latest',
		[REPOSITORY],
	])
	if (Array.isArray(plan?.actions) && plan.actions.length === 0) {
		throw new Error(
			'Glass is already at beta15. This helper only upgrades beta14 or older; nothing was changed. Restart Discord and check its version.',
		)
	}
	const action = plan?.actions?.[0]
	const previousBeta = /^1\.0\.0-beta(\d+)$/.exec(action?.replaces ?? '')
	if (
		!Array.isArray(plan?.actions) ||
		plan.actions.length !== 1 ||
		!Array.isArray(plan.warnings) ||
		plan.warnings.length !== 0 ||
		action?.id !== GLASS_ID ||
		action.version !== TARGET_VERSION ||
		action.repo !== REPOSITORY ||
		action.channel !== 'latest' ||
		action.url !== TARGET_URL ||
		action.sha256 !== TARGET_SHA256 ||
		action.size !== TARGET_SIZE ||
		!previousBeta ||
		Number(previousBeta[1]) < 1 ||
		Number(previousBeta[1]) >= 15
	) {
		throw new Error(
			'The install plan did not match the verified beta15 upgrade. Nothing was installed. Keep your existing Glass plugin and share this error.',
		)
	}
	if (!isActive()) throw new Error('Update canceled before installation.')
	onProgress('Installing beta15 and linking future updates…')
	const result = await call('revenge.plugins.install', [plan])
	if (
		![result?.pending, result?.installed, result?.skipped].some(
			ids => Array.isArray(ids) && ids.includes(GLASS_ID),
		)
	) {
		throw new Error(
			'Revenge did not confirm the update. Restart Discord and check the Glass version before trying again.',
		)
	}
	onProgress(
		'Update staged. Fully close and reopen Discord to load beta15. Your Glass settings were kept. After checking beta15 and its repository, you can remove only this Update Helper.',
	)
}
