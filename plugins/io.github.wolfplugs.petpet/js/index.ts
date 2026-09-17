import { instead } from '@revenge-mod/patcher'

type CommandArgument = {
	value: string
}

type CommandContext = {
	channel: {
		id: string
	}
}

type CommandResult = {
	content: string
}

type ApplicationCommand = {
	name: string
	description: string
	execute: (...args: any[]) => any
	options: Array<Record<string, unknown>>
	id?: string
	applicationId?: string
	displayName?: string
	displayDescription?: string
	untranslatedName?: string
	untranslatedDescription?: string
	inputType?: number
	type?: number
}

type CommandsModule = {
	getBuiltInCommands: (
		type: number | number[],
		includeBuiltIns: boolean,
		includeIntegrationCommands: boolean,
	) => ApplicationCommand[]
}

type MessageModule = {
	sendMessage: (channelId: string, message: CommandResult) => unknown
	sendBotMessage: (...args: unknown[]) => unknown
}

type DiscordUser = {
	getAvatarURL: (size: number) => string
}

type UserStore = {
	getUser: (userId: string) => DiscordUser | Promise<DiscordUser>
}

const CHAT_COMMAND_TYPE = 1
const BUILT_IN_INPUT_TYPE = 0
const USER_OPTION_TYPE = 6

async function getApiData(image: string): Promise<{ url: string }> {
	const data = await fetch(
		`https://api.obamabot.me/v2/image/petpet?image=${image.replace('webp', 'png')}`,
	)
	return data.json()
}

async function petPetCommand(
	args: CommandArgument[],
	_context: CommandContext,
): Promise<CommandResult> {
	const userStore = revenge.discord.flux.Stores
		.UserStore as unknown as UserStore
	const user = await userStore.getUser(args[0].value)
	const image = user.getAvatarURL(512)
	const data = await getApiData(image)

	return {
		content: data.url,
	}
}

export default plugin({
	start({ cleanup }) {
		let commandsModule: CommandsModule | undefined
		let messageModule: MessageModule | undefined
		let installed = false

		const install = () => {
			if (installed || !commandsModule || !messageModule) return
			installed = true

			let builtInCommands: ApplicationCommand[]
			try {
				builtInCommands = commandsModule.getBuiltInCommands(
					CHAT_COMMAND_TYPE,
					true,
					false,
				)
			} catch {
				builtInCommands = commandsModule.getBuiltInCommands(
					[1, 2, 3],
					true,
					false,
				)
			}

			builtInCommands.sort(
				(a, b) =>
					Number.parseInt(b.id ?? '0', 10) - Number.parseInt(a.id ?? '0', 10),
			)
			const lastCommand = builtInCommands[builtInCommands.length - 1]
			if (!lastCommand?.id) {
				throw new Error('petPet could not determine a local command ID.')
			}

			const command: ApplicationCommand = {
				name: 'petpet',
				displayName: 'petpet',
				displayDescription: 'PetPet someone',
				description: 'PetPet someone',
				options: [
					{
						name: 'user',
						description: 'The user(or their id) to be patted',
						type: USER_OPTION_TYPE,
						required: true,
						displayName: 'user',
						displayDescription: 'The user(or their id) to be patted',
					},
				],
				execute: petPetCommand,
				applicationId: '-1',
				inputType: BUILT_IN_INPUT_TYPE,
				type: CHAT_COMMAND_TYPE,
				id: (Number.parseInt(lastCommand.id, 10) - 1).toString(),
				untranslatedName: 'petpet',
				untranslatedDescription: 'PetPet someone',
			}

			cleanup(
				instead(command, 'execute', (args, original) => {
					void Promise.resolve(original.apply(command, args))
						.then(result => {
							if (result && typeof result === 'object') {
								messageModule?.sendMessage(args[1].channel.id, result)
							}
						})
						.catch(error => {
							console.error('[petPet] Failed to execute command', error)
						})
				}),
			)

			cleanup(
				instead(commandsModule, 'getBuiltInCommands', (args, original) => {
					const commands = original.apply(commandsModule, args)
					const requestedType = args[0]
					const includesChat = Array.isArray(requestedType)
						? requestedType.includes(CHAT_COMMAND_TYPE)
						: requestedType === CHAT_COMMAND_TYPE

					return includesChat ? [...commands, command] : commands
				}),
			)
		}

		cleanup(
			revenge.discord.utils.modules.finders.getModuleWithImportedPath<CommandsModule>(
				'modules/application_commands/ApplicationCommandBuiltIns.tsx',
				exports => {
					commandsModule = exports
					install()
				},
			),
			revenge.discord.utils.modules.finders.getModuleWithImportedPath<{
				default: MessageModule
			}>('actions/MessageActionCreators.tsx', exports => {
				messageModule = exports.default
				install()
			}),
		)
	},
})
