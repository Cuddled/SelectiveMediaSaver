import assert from 'node:assert/strict'
import test from 'node:test'
import {
	activateAnimatedProfileBanner,
	animateMessageRow,
	forceAvatarDecorationAnimation,
	forceGuildMemberAvatarAnimation,
	forceUserAvatarAnimation,
} from './core'

test('forces the same avatar animation flags as the Classic plugin', () => {
	const decoration: Array<{ canAnimate?: boolean }> = [{}]
	forceAvatarDecorationAnimation(decoration)
	assert.equal(decoration[0].canAnimate, true)

	const user = [{ id: '1' }, false]
	forceUserAvatarAnimation(user)
	assert.equal(user[1], true)

	const guildMember: Array<{ canAnimate?: boolean }> = [{}]
	forceGuildMemberAvatarAnimation(guildMember)
	assert.equal(guildMember[0].canAnimate, true)
})

test('rewrites only animated message-row avatar webp URLs', () => {
	const animated = {
		message: { avatarURL: 'https://cdn.discordapp.com/avatars/1/a_hash.webp' },
	}
	animateMessageRow({ rowType: 1 }, animated)
	assert.equal(
		animated.message.avatarURL,
		'https://cdn.discordapp.com/avatars/1/a_hash.gif',
	)

	const staticAvatar = {
		message: { avatarURL: 'https://cdn.discordapp.com/avatars/1/hash.webp' },
	}
	animateMessageRow({ rowType: 1 }, staticAvatar)
	assert.match(staticAvatar.message.avatarURL, /\.webp$/)

	const nonMessage = {
		message: { avatarURL: 'https://cdn.discordapp.com/avatars/1/a_hash.webp' },
	}
	animateMessageRow({ rowType: 2 }, nonMessage)
	assert.match(nonMessage.message.avatarURL, /\.webp$/)
})

test('activates an animated profile banner through its existing press action', () => {
	let presses = 0
	const ProfileBanner = function ProfileBanner() {}
	const tree = {
		props: {
			children: {
				props: {
					onPress: () => {
						presses += 1
					},
					children: {
						key: 'a_hash-false',
						type: ProfileBanner,
						props: {
							bannerSource: {
								uri: 'https://cdn.discordapp.com/banners/1/a_hash.webp',
							},
						},
					},
				},
			},
		},
	}

	assert.equal(activateAnimatedProfileBanner(tree), tree)
	assert.equal(presses, 1)
})

test('does not press an already-playing profile banner', () => {
	let presses = 0
	const ProfileBanner = function ProfileBanner() {}
	const tree = {
		props: {
			onPress: () => {
				presses += 1
			},
			children: {
				key: 'a_hash-true',
				type: ProfileBanner,
				props: {
					bannerSource: {
						uri: 'https://cdn.discordapp.com/banners/1/a_hash.gif',
					},
				},
			},
		},
	}

	activateAnimatedProfileBanner(tree)
	assert.equal(presses, 0)
})

test('does not toggle Discord 347 animated banner sources on every render', () => {
	let presses = 0
	const ProfileBanner = function ProfileBanner() {}
	const tree = {
		props: {
			onPress: () => {
				presses += 1
			},
			children: {
				type: ProfileBanner,
				props: {
					bannerSource: {
						uri: 'https://cdn.discordapp.com/banners/1/a_hash.webp?size=480&animated=true',
					},
				},
			},
		},
	}

	activateAnimatedProfileBanner(tree)
	assert.equal(presses, 0)
})
