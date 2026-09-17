export type TimerStartArguments = [
	delay: number,
	callback: (...args: any[]) => any,
	restart?: boolean,
]

export function suppressDisconnectCallback(
	args: TimerStartArguments,
): TimerStartArguments {
	if (args[1]?.name === 'disconnect') args[1] = () => {}
	return args
}
