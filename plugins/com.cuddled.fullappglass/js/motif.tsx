import type { Settings } from './core'

/** Drawn with native primitives: no downloads, animation, labels or touch targets. */
export function SignatureMotif({
	settings,
	size = 24,
}: {
	settings: Settings
	size?: number
}) {
	const { View, Text } = revenge.react.ReactNative
	const motif = settings.studio.signatureMotif
	if (!settings.enabled || !settings.mainScreens || motif === 'none')
		return null
	return (
		<View
			pointerEvents="none"
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			style={{ width: size, height: size, opacity: 0.8 }}
		>
			{motif === 'star' ? (
				<Text
					style={{
						color: settings.accentColor,
						fontSize: size,
						lineHeight: size,
					}}
				>
					✦
				</Text>
			) : (
				<>
					{[
						[0.08, 0.1, 0.36, 0.48, '-28deg'],
						[0.56, 0.1, 0.36, 0.48, '28deg'],
						[0.2, 0.55, 0.26, 0.3, '25deg'],
						[0.54, 0.55, 0.26, 0.3, '-25deg'],
					].map(([left, top, width, height, rotate]) => (
						<View
							key={`${left}:${top}`}
							style={{
								position: 'absolute',
								left: Number(left) * size,
								top: Number(top) * size,
								width: Number(width) * size,
								height: Number(height) * size,
								borderRadius: size,
								borderWidth: 1,
								borderColor: settings.accentColor,
								backgroundColor: `${settings.accentColor}28`,
								transform: [{ rotate: String(rotate) }],
							}}
						/>
					))}
					<View
						style={{
							position: 'absolute',
							left: size * 0.47,
							top: size * 0.3,
							width: size * 0.06,
							height: size * 0.48,
							borderRadius: size,
							backgroundColor: settings.accentColor,
						}}
					/>
				</>
			)}
		</View>
	)
}
