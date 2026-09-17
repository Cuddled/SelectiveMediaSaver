@file:JvmName("SelectiveMediaSaverPlugin")

package com.cuddled.selectivemediasaver

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.AtomicFile
import io.github.revenge.plugins.plugin
import io.github.revenge.xposed.api.HostScope
import io.github.revenge.xposed.api.registerNativeAsyncMethod
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.OutputStreamWriter
import java.net.IDN
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URI
import java.net.UnknownHostException
import java.security.MessageDigest
import java.text.Normalizer
import java.util.Locale
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext

private const val METHOD_PREFIX = "com.cuddled.selectivemediasaver"
private const val DEFAULT_FOLDER = "SelectiveMediaSaver"
private const val DEFAULT_MAX_BYTES = 100L * 1024L * 1024L
private const val HARD_MAX_BYTES = 512L * 1024L * 1024L
private const val CONNECT_TIMEOUT_MS = 15_000
private const val READ_TIMEOUT_MS = 30_000
private const val MAX_REDIRECTS = 5
private const val COPY_BUFFER_BYTES = 64 * 1024
private const val SIGNATURE_BYTES = 32
private const val COMPILE_API = 36
private const val MAX_FOLDER_DEPTH = 4
private const val MAX_FOLDER_SEGMENT_CODE_POINTS = 64
private const val MAX_FOLDER_SEGMENT_UTF8_BYTES = 240

private val lifecycleGeneration = AtomicLong(0)
private val lifecycleLock = Any()

private val ALLOWED_HOSTS = setOf(
    "cdn.discordapp.com",
    "media.discordapp.net",
    "images-ext-1.discordapp.net",
    "images-ext-2.discordapp.net",
)

private enum class MediaKind(val directory: String) {
    IMAGE(Environment.DIRECTORY_PICTURES),
    VIDEO(Environment.DIRECTORY_MOVIES),
}

private data class AllowedMediaType(
    val mimeType: String,
    val aliases: Set<String>,
    val extensions: Set<String>,
    val canonicalExtension: String,
    val kind: MediaKind,
    val signatureMatches: (ByteArray, Int) -> Boolean,
)

private fun hasPrefix(bytes: ByteArray, count: Int, vararg expected: Int): Boolean {
    if (count < expected.size) return false
    return expected.indices.all { index -> (bytes[index].toInt() and 0xff) == expected[index] }
}

private fun asciiAt(bytes: ByteArray, count: Int, offset: Int, value: String): Boolean {
    if (offset < 0 || count < offset + value.length) return false
    return value.indices.all { index -> bytes[offset + index].toInt() == value[index].code }
}

private val MEDIA_TYPES = listOf(
    AllowedMediaType(
        mimeType = "image/jpeg",
        aliases = setOf("image/jpeg", "image/jpg", "image/pjpeg"),
        extensions = setOf("jpg", "jpeg"),
        canonicalExtension = "jpg",
        kind = MediaKind.IMAGE,
        signatureMatches = { bytes, count -> hasPrefix(bytes, count, 0xff, 0xd8, 0xff) },
    ),
    AllowedMediaType(
        mimeType = "image/png",
        aliases = setOf("image/png", "image/x-png"),
        extensions = setOf("png"),
        canonicalExtension = "png",
        kind = MediaKind.IMAGE,
        signatureMatches = { bytes, count ->
            hasPrefix(bytes, count, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
        },
    ),
    AllowedMediaType(
        mimeType = "image/gif",
        aliases = setOf("image/gif"),
        extensions = setOf("gif"),
        canonicalExtension = "gif",
        kind = MediaKind.IMAGE,
        signatureMatches = { bytes, count ->
            asciiAt(bytes, count, 0, "GIF87a") || asciiAt(bytes, count, 0, "GIF89a")
        },
    ),
    AllowedMediaType(
        mimeType = "image/webp",
        aliases = setOf("image/webp"),
        extensions = setOf("webp"),
        canonicalExtension = "webp",
        kind = MediaKind.IMAGE,
        signatureMatches = { bytes, count ->
            asciiAt(bytes, count, 0, "RIFF") && asciiAt(bytes, count, 8, "WEBP")
        },
    ),
    AllowedMediaType(
        mimeType = "video/mp4",
        aliases = setOf("video/mp4", "video/x-m4v"),
        extensions = setOf("mp4", "m4v"),
        canonicalExtension = "mp4",
        kind = MediaKind.VIDEO,
        signatureMatches = { bytes, count -> asciiAt(bytes, count, 4, "ftyp") },
    ),
    AllowedMediaType(
        mimeType = "video/quicktime",
        aliases = setOf("video/quicktime"),
        extensions = setOf("mov"),
        canonicalExtension = "mov",
        kind = MediaKind.VIDEO,
        signatureMatches = { bytes, count -> asciiAt(bytes, count, 4, "ftyp") },
    ),
    AllowedMediaType(
        mimeType = "video/webm",
        aliases = setOf("video/webm"),
        extensions = setOf("webm"),
        canonicalExtension = "webm",
        kind = MediaKind.VIDEO,
        signatureMatches = { bytes, count -> hasPrefix(bytes, count, 0x1a, 0x45, 0xdf, 0xa3) },
    ),
    AllowedMediaType(
        mimeType = "video/x-matroska",
        aliases = setOf("video/x-matroska"),
        extensions = setOf("mkv"),
        canonicalExtension = "mkv",
        kind = MediaKind.VIDEO,
        signatureMatches = { bytes, count -> hasPrefix(bytes, count, 0x1a, 0x45, 0xdf, 0xa3) },
    ),
)

private val MEDIA_TYPE_BY_MIME = buildMap {
    MEDIA_TYPES.forEach { type -> type.aliases.forEach { alias -> put(alias, type) } }
}

private val MEDIA_TYPE_BY_EXTENSION = buildMap {
    MEDIA_TYPES.forEach { type -> type.extensions.forEach { extension -> put(extension, type) } }
}

private data class DownloadRequest(
    val uri: URI,
    val requestedFileName: String?,
    val mimeHint: String?,
    val folderSegments: List<String>,
    val maxBytes: Long,
)

private data class Destination(
    val uri: Uri,
    val displayName: String,
    val relativePath: String,
)

private class BridgeFailure(
    val code: String,
    override val message: String,
    val retryable: Boolean = false,
    val safeDetails: String? = null,
) : Exception(message)

@Suppress("UNUSED")
val selectiveMediaSaverPlugin = plugin {
    start {
        val generation = synchronized(lifecycleLock) { lifecycleGeneration.incrementAndGet() }
        val managedUrisFile = File(storageDir, "managed-media-uris.txt")

        withAppContext { context ->
            val service = SelectiveMediaSaverService(
                context = context.applicationContext,
                managedUrisFile = managedUrisFile,
                isActive = { generation == lifecycleGeneration.get() },
            )

            synchronized(lifecycleLock) {
                if (generation != lifecycleGeneration.get()) return@withAppContext

                registerNativeAsyncMethod("$METHOD_PREFIX.capabilities") {
                    if (generation == lifecycleGeneration.get()) {
                        service.capabilities()
                    } else {
                        error("Selective Media Saver is disabled.")
                    }
                }
                registerNativeAsyncMethod("$METHOD_PREFIX.download") { args ->
                    if (generation == lifecycleGeneration.get()) service.download(args) else stoppedFailure()
                }
                registerNativeAsyncMethod("$METHOD_PREFIX.delete") { args ->
                    if (generation == lifecycleGeneration.get()) service.delete(args) else stoppedFailure()
                }
                registerNativeAsyncMethod("$METHOD_PREFIX.open") { args ->
                    if (generation == lifecycleGeneration.get()) service.open(args) else stoppedFailure()
                }
                registerNativeAsyncMethod("$METHOD_PREFIX.share") { args ->
                    if (generation == lifecycleGeneration.get()) service.share(args) else stoppedFailure()
                }

                log.i("Registered Selective Media Saver native bridge methods")
            }
        }
    }

    stop {
        synchronized(lifecycleLock) {
            lifecycleGeneration.incrementAndGet()
            registerStoppedNativeMethods()
        }
        log.i("Stopped Selective Media Saver native component")
    }
}

private fun HostScope.registerStoppedNativeMethods() {
    registerNativeAsyncMethod("$METHOD_PREFIX.capabilities") {
        error("Selective Media Saver is disabled.")
    }
    registerNativeAsyncMethod("$METHOD_PREFIX.download") { stoppedFailure() }
    registerNativeAsyncMethod("$METHOD_PREFIX.delete") { stoppedFailure() }
    registerNativeAsyncMethod("$METHOD_PREFIX.open") { stoppedFailure() }
    registerNativeAsyncMethod("$METHOD_PREFIX.share") { stoppedFailure() }
}

private fun stoppedFailure(): HashMap<String, Any?> =
    failure("PLUGIN_STOPPED", "Selective Media Saver is disabled.")

private class SelectiveMediaSaverService(
    private val context: Context,
    managedUrisFile: File,
    private val isActive: () -> Boolean,
) {
    private val resolver: ContentResolver = context.contentResolver
    private val uriRegistry = ManagedUriRegistry(managedUrisFile)

    fun capabilities(): HashMap<String, Any?> {
        val legacyPermissionGranted = hasLegacyWritePermission()
        val storageMounted = Environment.getExternalStorageState() == Environment.MEDIA_MOUNTED
        val canWrite = storageMounted && (Build.VERSION.SDK_INT >= 29 || legacyPermissionGranted)
        val imageRelativePath = relativePath(MediaKind.IMAGE, listOf(DEFAULT_FOLDER))
        val videoRelativePath = relativePath(MediaKind.VIDEO, listOf(DEFAULT_FOLDER))

        return hashMapOf(
            "ok" to true,
            "streamDownload" to canWrite,
            "mediaStore" to canWrite,
            "open" to true,
            "share" to true,
            "delete" to true,
            "apiLevel" to Build.VERSION.SDK_INT,
            "minApi" to 24,
            "targetApi" to context.applicationInfo.targetSdkVersion,
            "compileApi" to COMPILE_API,
            "storageMode" to if (Build.VERSION.SDK_INT >= 29) "scoped-media-store" else "legacy-media-store",
            "storageMounted" to storageMounted,
            "legacyWritePermissionRequired" to (Build.VERSION.SDK_INT < 29),
            "legacyWritePermissionGranted" to legacyPermissionGranted,
            "httpsOnly" to true,
            "maxBytes" to HARD_MAX_BYTES.toDouble(),
            "defaultMaxBytes" to DEFAULT_MAX_BYTES.toDouble(),
            "allowedHosts" to ArrayList(ALLOWED_HOSTS.sorted()),
            "allowedMimeTypes" to ArrayList(MEDIA_TYPES.map { it.mimeType }.sorted()),
            "allowedExtensions" to ArrayList(MEDIA_TYPE_BY_EXTENSION.keys.sorted()),
            "paths" to hashMapOf(
                "imagesRelative" to imageRelativePath,
                "videosRelative" to videoRelativePath,
                "imagesPublic" to File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                    DEFAULT_FOLDER,
                ).absolutePath,
                "videosPublic" to File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES),
                    DEFAULT_FOLDER,
                ).absolutePath,
            ),
        )
    }

    suspend fun download(rawArgs: List<Any?>): HashMap<String, Any?> {
        var insertedUri: Uri? = null
        var connection: HttpsURLConnection? = null

        return try {
            requirePluginActive()
            val request = parseDownloadRequest(rawArgs)
            requireStorageAvailable()
            connection = openValidatedConnection(request.uri)

            val contentLength = connection.contentLengthLong
            if (contentLength > request.maxBytes) {
                throw BridgeFailure(
                    code = "CONTENT_TOO_LARGE",
                    message = "The media is larger than the configured download limit.",
                    safeDetails = "contentLength=$contentLength,maxBytes=${request.maxBytes}",
                )
            }

            val responseType = resolveMediaType(
                responseMime = connection.contentType,
                mimeHint = request.mimeHint,
                sourceUri = request.uri,
            )

            BufferedInputStream(connection.inputStream, COPY_BUFFER_BYTES).use { input ->
                val prefix = ByteArray(SIGNATURE_BYTES)
                var prefixCount = 0
                while (prefixCount < prefix.size) {
                    val read = input.read(prefix, prefixCount, prefix.size - prefixCount)
                    if (read < 0) break
                    prefixCount += read
                }

                if (!responseType.signatureMatches(prefix, prefixCount)) {
                    throw BridgeFailure(
                        code = "CONTENT_SIGNATURE_MISMATCH",
                        message = "The downloaded bytes do not match the declared media type.",
                        safeDetails = responseType.mimeType,
                    )
                }

                if (prefixCount.toLong() > request.maxBytes) {
                    throw BridgeFailure(
                        code = "CONTENT_TOO_LARGE",
                        message = "The media is larger than the configured download limit.",
                    )
                }

                val destination = createDestination(request, responseType)
                insertedUri = destination.uri
                val digest = MessageDigest.getInstance("SHA-256")
                var written = 0L

                val output = resolver.openOutputStream(destination.uri, "w")
                    ?: throw BridgeFailure(
                        code = "OUTPUT_OPEN_FAILED",
                        message = "Android could not open the MediaStore destination.",
                    )

                output.buffered(COPY_BUFFER_BYTES).use { sink ->
                    if (prefixCount > 0) {
                        digest.update(prefix, 0, prefixCount)
                        sink.write(prefix, 0, prefixCount)
                        written += prefixCount
                    }

                    val buffer = ByteArray(COPY_BUFFER_BYTES)
                    while (true) {
                        currentCoroutineContext().ensureActive()
                        requirePluginActive()
                        val count = input.read(buffer)
                        if (count < 0) break
                        if (written + count > request.maxBytes) {
                            throw BridgeFailure(
                                code = "CONTENT_TOO_LARGE",
                                message = "The media exceeded the configured limit while downloading.",
                                safeDetails = "maxBytes=${request.maxBytes}",
                            )
                        }
                        digest.update(buffer, 0, count)
                        sink.write(buffer, 0, count)
                        written += count
                    }
                    sink.flush()
                }

                if (written == 0L) {
                    throw BridgeFailure(
                        code = "EMPTY_RESPONSE",
                        message = "The media response was empty.",
                    )
                }

                requirePluginActive()
                publishDestination(destination.uri)
                uriRegistry.add(destination.uri)

                success(
                    "uri" to destination.uri.toString(),
                    "displayName" to destination.displayName,
                    "mimeType" to responseType.mimeType,
                    "mediaKind" to responseType.kind.name.lowercase(Locale.ROOT),
                    "bytes" to written.toDouble(),
                    "sha256" to digest.digest().joinToString("") { byte -> "%02x".format(byte) },
                    "relativePath" to destination.relativePath,
                    "sourceHost" to request.uri.host.lowercase(Locale.ROOT),
                ).also {
                    // Ownership is now recorded; cleanup below must no longer delete this row.
                    insertedUri = null
                }
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (problem: BridgeFailure) {
            failure(problem.code, problem.message, problem.retryable, problem.safeDetails)
        } catch (timeout: SocketTimeoutException) {
            failure("NETWORK_TIMEOUT", "The media download timed out.", retryable = true)
        } catch (unknownHost: UnknownHostException) {
            failure("NETWORK_UNREACHABLE", "The Discord media host could not be reached.", retryable = true)
        } catch (ssl: SSLException) {
            failure("TLS_ERROR", "A secure connection to the media host could not be established.", retryable = true)
        } catch (security: SecurityException) {
            failure("PERMISSION_DENIED", "Android denied access to public media storage.")
        } catch (io: IOException) {
            failure("IO_ERROR", "The media could not be downloaded or saved.", retryable = true)
        } catch (error: Throwable) {
            failure("UNEXPECTED_ERROR", "The media could not be saved.", safeDetails = error.javaClass.simpleName)
        } finally {
            insertedUri?.let { runCatching { resolver.delete(it, null, null) } }
            connection?.disconnect()
        }
    }

    suspend fun delete(rawArgs: List<Any?>): HashMap<String, Any?> = try {
        requirePluginActive()
        val uri = parseManagedUri(rawArgs)
        val count = resolver.delete(uri, null, null)
        uriRegistry.remove(uri)
        success(
            "uri" to uri.toString(),
            "deleted" to (count > 0),
        )
    } catch (problem: BridgeFailure) {
        failure(problem.code, problem.message, problem.retryable, problem.safeDetails)
    } catch (security: SecurityException) {
        failure("PERMISSION_DENIED", "Android denied permission to delete this saved item.")
    } catch (io: IOException) {
        failure("IO_ERROR", "The saved item could not be deleted.", retryable = true)
    } catch (error: Throwable) {
        failure("UNEXPECTED_ERROR", "The saved item could not be deleted.", safeDetails = error.javaClass.simpleName)
    }

    suspend fun open(rawArgs: List<Any?>): HashMap<String, Any?> = try {
        requirePluginActive()
        val uri = parseManagedUri(rawArgs)
        val mimeType = resolver.getType(uri) ?: "application/octet-stream"
        val intent = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, mimeType)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)

        launchIntent(intent)
        success("uri" to uri.toString(), "launched" to true)
    } catch (problem: BridgeFailure) {
        failure(problem.code, problem.message, problem.retryable, problem.safeDetails)
    } catch (security: SecurityException) {
        failure("PERMISSION_DENIED", "Android denied permission to open this saved item.")
    } catch (error: Throwable) {
        failure("OPEN_FAILED", "The saved item could not be opened.", safeDetails = error.javaClass.simpleName)
    }

    suspend fun share(rawArgs: List<Any?>): HashMap<String, Any?> = try {
        requirePluginActive()
        val request = requireObjectArg(rawArgs)
        val uri = parseManagedUri(rawArgs)
        val title = sanitizeShareTitle(request["title"] as? String)
        val mimeType = resolver.getType(uri) ?: "application/octet-stream"
        val sendIntent = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            clipData = ClipData.newUri(resolver, "Saved media", uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(sendIntent, title)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)

        launchIntent(chooser)
        success("uri" to uri.toString(), "launched" to true)
    } catch (problem: BridgeFailure) {
        failure(problem.code, problem.message, problem.retryable, problem.safeDetails)
    } catch (security: SecurityException) {
        failure("PERMISSION_DENIED", "Android denied permission to share this saved item.")
    } catch (error: Throwable) {
        failure("SHARE_FAILED", "The saved item could not be shared.", safeDetails = error.javaClass.simpleName)
    }

    private fun parseDownloadRequest(rawArgs: List<Any?>): DownloadRequest {
        val request = requireObjectArg(rawArgs)
        val url = (request["url"] as? String)?.trim().orEmpty()
        if (url.isEmpty()) {
            throw BridgeFailure("INVALID_REQUEST", "A media URL is required.")
        }

        val uri = try {
            URI(url)
        } catch (_: Exception) {
            throw BridgeFailure("INVALID_URL", "The media URL is not valid.")
        }
        validateRemoteUri(uri)

        val requestedFileName = (request["fileName"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
        val mimeHint = normalizeMime(request["mimeType"] as? String)
        if (mimeHint != null && mimeHint !in MEDIA_TYPE_BY_MIME) {
            throw BridgeFailure("UNSUPPORTED_MIME", "The requested media type is not supported.", safeDetails = mimeHint)
        }

        val folderSegments = parseFolderSegments(request)
        val maxBytes = when (val raw = request["maxBytes"]) {
            null -> DEFAULT_MAX_BYTES
            is Number -> raw.toLong()
            else -> throw BridgeFailure("INVALID_MAX_BYTES", "maxBytes must be a number.")
        }
        if (maxBytes !in 1..HARD_MAX_BYTES) {
            throw BridgeFailure(
                "INVALID_MAX_BYTES",
                "maxBytes must be between 1 and $HARD_MAX_BYTES.",
            )
        }

        validateRequestedExtension(requestedFileName, "fileName")
        validateRequestedExtension(sourceFileName(uri), "URL")

        return DownloadRequest(uri, requestedFileName, mimeHint, folderSegments, maxBytes)
    }

    private fun resolveMediaType(
        responseMime: String?,
        mimeHint: String?,
        sourceUri: URI,
    ): AllowedMediaType {
        val normalizedResponse = normalizeMime(responseMime)
        val hintedType = mimeHint?.let(MEDIA_TYPE_BY_MIME::get)
        val responseType = normalizedResponse?.let(MEDIA_TYPE_BY_MIME::get)
        val sourceExtension = extensionOf(sourceFileName(sourceUri))
        val extensionType = sourceExtension?.let(MEDIA_TYPE_BY_EXTENSION::get)

        val selected = when {
            responseType != null -> responseType
            normalizedResponse == null || normalizedResponse == "application/octet-stream" ->
                hintedType ?: extensionType ?: throw BridgeFailure(
                    "UNSUPPORTED_MIME",
                    "The server did not return a supported media type.",
                    safeDetails = normalizedResponse,
                )
            else -> throw BridgeFailure(
                "UNSUPPORTED_MIME",
                "The server returned an unsupported media type.",
                safeDetails = normalizedResponse,
            )
        }

        if (hintedType != null && hintedType !== selected) {
            throw BridgeFailure(
                "MIME_MISMATCH",
                "The server media type does not match the expected type.",
                safeDetails = "expected=${hintedType.mimeType},actual=${selected.mimeType}",
            )
        }
        if (extensionType != null && extensionType !== selected) {
            throw BridgeFailure(
                "EXTENSION_MISMATCH",
                "The URL extension does not match the downloaded media type.",
                safeDetails = "extension=$sourceExtension,mime=${selected.mimeType}",
            )
        }

        return selected
    }

    private fun createDestination(
        request: DownloadRequest,
        mediaType: AllowedMediaType,
    ): Destination {
        val relativePath = relativePath(mediaType.kind, request.folderSegments)
        val collection = collectionFor(mediaType.kind)
        val sourceName = request.requestedFileName ?: sourceFileName(request.uri)
        val displayName = uniqueDisplayName(collection, relativePath, sourceName, mediaType)
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
            put(MediaStore.MediaColumns.MIME_TYPE, mediaType.mimeType)
            if (Build.VERSION.SDK_INT >= 29) {
                put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            } else {
                val publicDirectory = Environment
                    .getExternalStoragePublicDirectory(mediaType.kind.directory)
                    .canonicalFile
                val folder = request.folderSegments
                    .fold(publicDirectory) { parent, segment -> File(parent, segment) }
                    .canonicalFile
                val publicPrefix = publicDirectory.path.trimEnd(File.separatorChar) + File.separator
                if (!folder.path.startsWith(publicPrefix)) {
                    throw BridgeFailure(
                        "INVALID_FOLDER_SEGMENTS",
                        "The requested media folder escapes its public collection.",
                    )
                }
                if (!folder.exists() && !folder.mkdirs()) {
                    throw BridgeFailure("DIRECTORY_CREATE_FAILED", "The public media folder could not be created.")
                }
                @Suppress("DEPRECATION")
                put(MediaStore.MediaColumns.DATA, File(folder, displayName).absolutePath)
            }
        }

        val uri = resolver.insert(collection, values)
            ?: throw BridgeFailure("MEDIASTORE_INSERT_FAILED", "Android could not create the MediaStore item.")

        return Destination(uri, displayName, relativePath)
    }

    private fun publishDestination(uri: Uri) {
        if (Build.VERSION.SDK_INT < 29) return
        val values = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
        if (resolver.update(uri, values, null, null) <= 0) {
            throw BridgeFailure("MEDIASTORE_PUBLISH_FAILED", "Android could not publish the saved media item.")
        }
    }

    private fun uniqueDisplayName(
        collection: Uri,
        relativePath: String,
        requestedName: String?,
        mediaType: AllowedMediaType,
    ): String {
        val sanitized = sanitizeFileName(requestedName)
        val requestedExtension = extensionOf(sanitized)
        val extension = requestedExtension
            ?.takeIf { it in mediaType.extensions }
            ?: mediaType.canonicalExtension
        val rawStem = if (requestedExtension != null) sanitized.dropLast(requestedExtension.length + 1) else sanitized
        val stem = truncateByCodePoints(rawStem.ifBlank { "discord_media" }, 80)

        for (index in 0..999) {
            val suffix = if (index == 0) "" else " ($index)"
            val tail = "$suffix.$extension"
            val safeStem = truncateUtf8(stem, 240 - tail.toByteArray(Charsets.UTF_8).size)
            val candidate = "$safeStem$tail"
            when (displayNameExists(collection, relativePath, candidate, mediaType.kind)) {
                false -> return candidate
                true -> Unit
                null -> {
                    // If an OEM provider refuses the read query, use entropy rather than risking a duplicate.
                    val randomSuffix = UUID.randomUUID().toString().substring(0, 8)
                    val tail = "-$randomSuffix.$extension"
                    return "${truncateUtf8(stem, 240 - tail.toByteArray(Charsets.UTF_8).size)}$tail"
                }
            }
        }

        throw BridgeFailure("UNIQUE_NAME_FAILED", "A unique media filename could not be created.")
    }

    private fun displayNameExists(
        collection: Uri,
        relativePath: String,
        displayName: String,
        kind: MediaKind,
    ): Boolean? {
        if (Build.VERSION.SDK_INT < 29) {
            val path = File(
                File(Environment.getExternalStoragePublicDirectory(kind.directory), relativePath.substringAfter('/')),
                displayName,
            )
            return path.exists()
        }

        return try {
            resolver.query(
                collection,
                arrayOf(MediaStore.MediaColumns._ID),
                "${MediaStore.MediaColumns.DISPLAY_NAME} = ? AND ${MediaStore.MediaColumns.RELATIVE_PATH} = ?",
                arrayOf(displayName, relativePath),
                null,
            )?.use { cursor -> cursor.moveToFirst() } ?: false
        } catch (_: SecurityException) {
            null
        }
    }

    private fun openValidatedConnection(start: URI): HttpsURLConnection {
        var current = start
        for (redirectCount in 0..MAX_REDIRECTS) {
            validateRemoteUri(current)
            val connection = current.toURL().openConnection() as HttpsURLConnection
            var returned = false
            try {
                connection.instanceFollowRedirects = false
                connection.connectTimeout = CONNECT_TIMEOUT_MS
                connection.readTimeout = READ_TIMEOUT_MS
                connection.requestMethod = "GET"
                connection.setRequestProperty("Accept", "image/*, video/*")
                connection.setRequestProperty("Accept-Encoding", "identity")
                connection.setRequestProperty("User-Agent", "SelectiveMediaSaver-Revenge/0.1")

                val status = connection.responseCode
                if (status in 200..299) {
                    returned = true
                    return connection
                }

                if (status in setOf(301, 302, 303, 307, 308)) {
                    val location = connection.getHeaderField("Location")
                    if (location.isNullOrBlank()) {
                        throw BridgeFailure("INVALID_REDIRECT", "The media server returned an invalid redirect.")
                    }
                    if (redirectCount == MAX_REDIRECTS) {
                        throw BridgeFailure("TOO_MANY_REDIRECTS", "The media URL redirected too many times.")
                    }
                    current = try {
                        current.resolve(location)
                    } catch (_: Exception) {
                        throw BridgeFailure("INVALID_REDIRECT", "The media server returned an invalid redirect.")
                    }
                    continue
                }

                connection.errorStream?.use { stream ->
                    // Drain only a tiny amount so the connection can close cleanly; never expose server bodies to JS.
                    val buffer = ByteArray(256)
                    stream.read(buffer)
                }
                throw BridgeFailure(
                    code = "HTTP_ERROR",
                    message = "The media server returned HTTP $status.",
                    retryable = status == 408 || status == 429 || status >= 500,
                    safeDetails = "status=$status",
                )
            } finally {
                if (!returned) connection.disconnect()
            }
        }

        throw BridgeFailure("TOO_MANY_REDIRECTS", "The media URL redirected too many times.")
    }

    private fun validateRemoteUri(uri: URI) {
        if (!uri.scheme.equals("https", ignoreCase = true)) {
            throw BridgeFailure("HTTPS_REQUIRED", "Only HTTPS media URLs are allowed.")
        }
        if (uri.rawUserInfo != null || (uri.port != -1 && uri.port != 443)) {
            throw BridgeFailure("INVALID_URL", "The media URL contains unsupported authority information.")
        }
        val rawHost = uri.host ?: throw BridgeFailure("INVALID_URL", "The media URL has no host.")
        val host = try {
            IDN.toASCII(rawHost, IDN.USE_STD3_ASCII_RULES).lowercase(Locale.ROOT)
        } catch (_: IllegalArgumentException) {
            throw BridgeFailure("INVALID_URL", "The media URL host is invalid.")
        }
        if (host !in ALLOWED_HOSTS) {
            throw BridgeFailure(
                "HOST_NOT_ALLOWED",
                "Only approved Discord CDN hosts are allowed.",
                safeDetails = host,
            )
        }
    }

    private fun requireStorageAvailable() {
        if (Environment.getExternalStorageState() != Environment.MEDIA_MOUNTED) {
            throw BridgeFailure("STORAGE_UNAVAILABLE", "Public media storage is not currently available.", retryable = true)
        }
        if (Build.VERSION.SDK_INT < 29 && !hasLegacyWritePermission()) {
            throw BridgeFailure(
                "LEGACY_STORAGE_PERMISSION_REQUIRED",
                "Android storage permission is required on Android 9 and older.",
            )
        }
    }

    private fun requirePluginActive() {
        if (!isActive()) {
            throw BridgeFailure("PLUGIN_STOPPED", "Selective Media Saver was disabled during this operation.")
        }
    }

    private fun hasLegacyWritePermission(): Boolean =
        Build.VERSION.SDK_INT >= 29 ||
            context.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED

    private fun parseManagedUri(rawArgs: List<Any?>): Uri {
        val request = requireObjectArg(rawArgs)
        val rawUri = (request["uri"] as? String)?.trim().orEmpty()
        if (rawUri.isEmpty()) throw BridgeFailure("INVALID_REQUEST", "A saved media URI is required.")

        val uri = Uri.parse(rawUri)
        if (uri.scheme != ContentResolver.SCHEME_CONTENT || uri.authority != MediaStore.AUTHORITY) {
            throw BridgeFailure("INVALID_URI", "Only MediaStore content URIs are accepted.")
        }
        if (!uriRegistry.contains(uri)) {
            throw BridgeFailure(
                "UNMANAGED_URI",
                "This item was not saved by Selective Media Saver and cannot be managed.",
            )
        }
        return uri
    }

    private suspend fun launchIntent(intent: Intent) {
        try {
            withContext(Dispatchers.Main.immediate) {
                context.startActivity(intent)
            }
        } catch (_: ActivityNotFoundException) {
            throw BridgeFailure("NO_HANDLER", "No installed app can handle this action.")
        }
    }

    private fun collectionFor(kind: MediaKind): Uri = when (kind) {
        MediaKind.IMAGE -> if (Build.VERSION.SDK_INT >= 29) {
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        } else {
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        }
        MediaKind.VIDEO -> if (Build.VERSION.SDK_INT >= 29) {
            MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        } else {
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        }
    }
}

private class ManagedUriRegistry(private val file: File) {
    private val lock = Any()
    private var loaded = false
    private val values = linkedSetOf<String>()

    fun contains(uri: Uri): Boolean = synchronized(lock) {
        loadLocked()
        uri.toString() in values
    }

    fun add(uri: Uri) = synchronized(lock) {
        loadLocked()
        if (values.add(uri.toString())) persistLocked()
    }

    fun remove(uri: Uri) = synchronized(lock) {
        loadLocked()
        if (values.remove(uri.toString())) persistLocked()
    }

    private fun loadLocked() {
        if (loaded) return
        loaded = true
        if (!file.isFile) return

        AtomicFile(file).openRead().bufferedReader(Charsets.UTF_8).useLines { lines ->
            lines.map(String::trim)
                .filter { it.startsWith("content://media/") }
                .forEach(values::add)
        }
    }

    private fun persistLocked() {
        file.parentFile?.mkdirs()
        val atomic = AtomicFile(file)
        var output: FileOutputStream? = null
        try {
            output = atomic.startWrite()
            val writer = OutputStreamWriter(output, Charsets.UTF_8).buffered()
            values.sorted().forEach { value ->
                writer.write(value)
                writer.newLine()
            }
            writer.flush()
            output.fd.sync()
            atomic.finishWrite(output)
        } catch (error: Throwable) {
            output?.let(atomic::failWrite)
            throw error
        }
    }
}

private fun requireObjectArg(rawArgs: List<Any?>): Map<*, *> =
    rawArgs.firstOrNull() as? Map<*, *>
        ?: throw BridgeFailure("INVALID_REQUEST", "The first argument must be an options object.")

private fun normalizeMime(raw: String?): String? = raw
    ?.substringBefore(';')
    ?.trim()
    ?.lowercase(Locale.ROOT)
    ?.takeIf(String::isNotEmpty)

private fun sourceFileName(uri: URI): String? {
    val segment = uri.rawPath?.substringAfterLast('/')?.takeIf(String::isNotEmpty) ?: return null
    return runCatching { Uri.decode(segment) }.getOrDefault(segment)
}

private fun extensionOf(fileName: String?): String? {
    if (fileName.isNullOrBlank()) return null
    val dot = fileName.lastIndexOf('.')
    if (dot <= 0 || dot == fileName.lastIndex) return null
    return fileName.substring(dot + 1).lowercase(Locale.ROOT).takeIf { it.length <= 8 }
}

private fun validateRequestedExtension(fileName: String?, source: String) {
    val extension = extensionOf(fileName) ?: return
    if (extension !in MEDIA_TYPE_BY_EXTENSION) {
        throw BridgeFailure(
            "UNSUPPORTED_EXTENSION",
            "The $source uses an unsupported file extension.",
            safeDetails = extension,
        )
    }
}

private fun sanitizeFileName(raw: String?): String {
    val candidate = raw?.takeIf(String::isNotBlank) ?: "discord_media"
    val normalized = Normalizer.normalize(candidate, Normalizer.Form.NFKC)
    val cleaned = buildString(normalized.length) {
        normalized.forEach { character ->
            when {
                character in setOf('/', '\\', ':', '*', '?', '"', '<', '>', '|') -> append('_')
                Character.isISOControl(character) || Character.getType(character) == Character.FORMAT.toInt() -> Unit
                else -> append(character)
            }
        }
    }.replace(Regex("\\s+"), " ").trim(' ', '.')

    return truncateByCodePoints(cleaned.ifBlank { "discord_media" }, 96)
}

private fun parseFolderSegments(request: Map<*, *>): List<String> {
    val rawSegments = request["folderSegments"]
    if (rawSegments != null) {
        val values = rawSegments as? List<*>
            ?: throw BridgeFailure("INVALID_FOLDER_SEGMENTS", "folderSegments must be an array of folder names.")
        if (values.isEmpty() || values.size > MAX_FOLDER_DEPTH) {
            throw BridgeFailure(
                "INVALID_FOLDER_SEGMENTS",
                "folderSegments must contain between 1 and $MAX_FOLDER_DEPTH folder names.",
            )
        }
        return values.mapIndexed { index, value ->
            val segment = value as? String
                ?: throw BridgeFailure(
                    "INVALID_FOLDER_SEGMENT",
                    "Folder segment ${index + 1} must be text.",
                )
            validateFolderSegment(segment, index)
        }
    }

    // Backward compatibility for builds that sent one legacy folder field.
    val legacyFolder = (request["folder"] as? String) ?: DEFAULT_FOLDER
    return listOf(validateFolderSegment(legacyFolder, 0))
}

private fun validateFolderSegment(raw: String, index: Int): String {
    val normalized = Normalizer.normalize(raw, Normalizer.Form.NFKC)
    if (
        normalized.isEmpty() ||
        normalized != normalized.trim() ||
        normalized == "." ||
        normalized == ".."
    ) {
        throw BridgeFailure(
            "INVALID_FOLDER_SEGMENT",
            "Folder segment ${index + 1} is empty or ambiguous.",
        )
    }
    if (normalized.any { character ->
            character in setOf('/', '\\', ':', '*', '?', '"', '<', '>', '|') ||
                Character.isISOControl(character) ||
                Character.getType(character) == Character.FORMAT.toInt()
        }
    ) {
        throw BridgeFailure(
            "INVALID_FOLDER_SEGMENT",
            "Folder segment ${index + 1} contains unsupported characters.",
        )
    }
    if (normalized.first() == '.' || normalized.last() == '.') {
        throw BridgeFailure(
            "INVALID_FOLDER_SEGMENT",
            "Folder segment ${index + 1} cannot start or end with a period.",
        )
    }

    if (normalized.codePointCount(0, normalized.length) > MAX_FOLDER_SEGMENT_CODE_POINTS) {
        throw BridgeFailure(
            "INVALID_FOLDER_SEGMENT",
            "Folder segment ${index + 1} is too long.",
        )
    }
    if (normalized.toByteArray(Charsets.UTF_8).size > MAX_FOLDER_SEGMENT_UTF8_BYTES) {
        throw BridgeFailure(
            "INVALID_FOLDER_SEGMENT",
            "Folder segment ${index + 1} uses too many encoded bytes.",
        )
    }
    return normalized
}

private fun sanitizeShareTitle(raw: String?): String =
    truncateByCodePoints(raw?.trim()?.takeIf(String::isNotEmpty) ?: "Share saved media", 80)

private fun truncateByCodePoints(value: String, maxCodePoints: Int): String {
    val count = value.codePointCount(0, value.length)
    if (count <= maxCodePoints) return value
    return value.substring(0, value.offsetByCodePoints(0, maxCodePoints))
}

private fun truncateUtf8(value: String, maxBytes: Int): String {
    if (maxBytes <= 0) return ""
    if (value.toByteArray(Charsets.UTF_8).size <= maxBytes) return value

    val result = StringBuilder(value.length)
    var byteCount = 0
    var offset = 0
    while (offset < value.length) {
        val codePoint = value.codePointAt(offset)
        val characters = String(Character.toChars(codePoint))
        val encodedBytes = characters.toByteArray(Charsets.UTF_8).size
        if (byteCount + encodedBytes > maxBytes) break
        result.append(characters)
        byteCount += encodedBytes
        offset += Character.charCount(codePoint)
    }
    return result.toString()
}

private fun relativePath(kind: MediaKind, folderSegments: List<String>): String =
    "${kind.directory}/${folderSegments.joinToString("/")}/"

private fun success(vararg values: Pair<String, Any?>): HashMap<String, Any?> =
    hashMapOf<String, Any?>("ok" to true).apply {
        values.forEach { (key, value) -> put(key, value) }
    }

private fun failure(
    code: String,
    message: String,
    retryable: Boolean = false,
    safeDetails: String? = null,
): HashMap<String, Any?> = hashMapOf(
    "ok" to false,
    "error" to hashMapOf<String, Any?>(
        "code" to code,
        "message" to message,
        "retryable" to retryable,
    ).apply {
        if (!safeDetails.isNullOrBlank()) put("details", safeDetails)
    },
)
