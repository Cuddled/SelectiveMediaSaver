import { callNativeMethod } from '@revenge-mod/modules/native'
import type { NativeEnableFailure } from './bridge-recovery'
import type {
	NativeCapabilities,
	NativeDeleteResult,
	NativeDownloadRequest,
	NativeDownloadResult,
	NativeLaunchResult,
} from './types'

export const NATIVE_PREFIX = 'com.cuddled.selectivemediasaver' as const

/**
 * Ask Revenge to align the native plugin lifecycle with the running JavaScript
 * plugin. This is a no-op when the native companion is already started, and
 * restarts it when Revenge has left only the JavaScript half running.
 */
export function startNativeCompanion(): Promise<null> {
	return callNativeMethod('revenge.plugins.startNative', [NATIVE_PREFIX])
}

/** Persist the native half's enabled flag so Revenge loads it on the next boot. */
export function setNativeCompanionEnabled(
	enabled: boolean,
): Promise<NativeEnableFailure | null> {
	return callNativeMethod('revenge.plugins.setEnabled', [
		NATIVE_PREFIX,
		enabled,
	])
}

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
		'revenge.plugins.startNative': [args: [id: string], returnValue: null]
		'revenge.plugins.setEnabled': [
			args: [id: string, enabled: boolean],
			returnValue: NativeEnableFailure | null,
		]
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
