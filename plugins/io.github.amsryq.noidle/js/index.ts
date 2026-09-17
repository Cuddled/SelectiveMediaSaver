import { onFluxEventDispatched } from '@revenge-mod/discord/flux'

type IdleEvent = {
	type: 'IDLE'
	idle?: boolean
}

export default plugin({
	start({ cleanup }) {
		cleanup(
			onFluxEventDispatched<IdleEvent>('IDLE', () => ({
				type: 'IDLE',
				idle: false,
			})),
		)
	},
})
