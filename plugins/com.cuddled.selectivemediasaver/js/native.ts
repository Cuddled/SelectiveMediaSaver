import { callNativeMethod } from '@revenge-mod/modules/native'
import type {
	NativeCapabilities,
	NativeDeleteResult,
	NativeDownloadRequest,
	NativeDownloadResult,
	NativeLaunchResult,
} from './types'

export const NATIVE_PREFIX = 'com.cuddled.selectivemediasaver' as const

export function getNativeCapabilities(): Promise<NativeCapabilities> {
	return callNativeMethod(`${NATIVE_PREFIX}.capabilities`, [])
}

/**
 * The native companion performs the HTTP request and streams its response directly
 * into Android MediaStore. JS intentionally never buffers the media payload.
 */
export function streamDownload(
	request: NativeDownloadRequest,
): Promise<NativeDownloadResult> {
	return callNativeMethod(`${NATIVE_PREFIX}.download`, [request])
}

export function openSavedMedia(uri: string): Promise<NativeLaunchResult> {
	return callNativeMethod(`${NATIVE_PREFIX}.open`, [{ uri }])
}

export function shareSavedMedia(
	uri: string,
	title?: string,
): Promise<NativeLaunchResult> {
	return callNativeMethod(`${NATIVE_PREFIX}.share`, [{ uri, title }])
}

export function deleteSavedMedia(uri: string): Promise<NativeDeleteResult> {
	return callNativeMethod(`${NATIVE_PREFIX}.delete`, [{ uri }])
}

declare module '@revenge-mod/modules/native' {
	export interface NativeMethods {
		'com.cuddled.selectivemediasaver.capabilities': [
			args: [],
			returnValue: NativeCapabilities,
		]
		'com.cuddled.selectivemediasaver.download': [
			args: [request: NativeDownloadRequest],
			returnValue: NativeDownloadResult,
		]
		'com.cuddled.selectivemediasaver.open': [
			args: [{ uri: string }],
			returnValue: NativeLaunchResult,
		]
		'com.cuddled.selectivemediasaver.share': [
			args: [{ uri: string; title?: string }],
			returnValue: NativeLaunchResult,
		]
		'com.cuddled.selectivemediasaver.delete': [
			args: [{ uri: string }],
			returnValue: NativeDeleteResult,
		]
	}
}
