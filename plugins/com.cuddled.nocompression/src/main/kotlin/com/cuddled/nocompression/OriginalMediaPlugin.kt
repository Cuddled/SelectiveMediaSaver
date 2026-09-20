@file:JvmName("OriginalMediaPlugin")

package com.cuddled.nocompression

import android.content.Context
import android.net.Uri
import io.github.revenge.plugins.plugin
import io.github.revenge.xposed.api.registerNativeAsyncMethod
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext

private const val PREFIX = "com.cuddled.nocompression"
private const val CACHE_LIFETIME_MS = 24L * 60L * 60L * 1000L
private const val CACHE_BUDGET = 2L * 1024L * 1024L * 1024L
private val generation = AtomicLong(0)
private val service = AtomicReference<OriginalMediaService?>(null)

@Suppress("UNUSED")
val originalMediaPlugin = plugin {
    start {
        val current = generation.incrementAndGet()
        service.getAndSet(null)?.stop()
        registerNativeAsyncMethod("$PREFIX.capabilities") {
            hashMapOf<String, Any?>("ready" to (generation.get() == current && service.get() != null), "version" to 1)
        }
        registerNativeAsyncMethod("$PREFIX.prepare") { args ->
            if (generation.get() != current) failure("STOPPED")
            else service.get()?.prepare(args) ?: failure("NOT_READY")
        }
        registerNativeAsyncMethod("$PREFIX.cancel") { args ->
            if (generation.get() == current) service.get()?.cancel(args.firstOrNull() as? String)
            true
        }
        registerNativeAsyncMethod("$PREFIX.release") { args ->
            if (generation.get() == current) service.get()?.release(args.firstOrNull() as? String)
            true
        }
        withAppContext { context ->
            if (generation.get() == current) {
                val next = OriginalMediaService(context.applicationContext ?: context) { generation.get() == current }
                if (generation.get() == current) service.set(next)
            }
        }
    }
    stop {
        generation.incrementAndGet()
        service.getAndSet(null)?.stop()
    }
}

private fun failure(code: String, size: Long? = null): HashMap<String, Any?> =
    hashMapOf("ok" to false, "code" to code, "size" to size?.toDouble())

private class OriginalMediaService(private val context: Context, private val active: () -> Boolean) {
    private val directory = File(context.cacheDir, "original-media-uploads")
    private val requests = ConcurrentHashMap<String, AtomicBoolean>()
    private val leases = ConcurrentHashMap.newKeySet<String>()
    private val slots = Semaphore(2)
    private val cacheLock = Any()
    private var reserved = 0L

    fun stop() { requests.values.forEach { it.set(true) } }
    fun cancel(id: String?) { if (id != null) requests[id]?.set(true) }

    suspend fun release(value: String?) = withContext(Dispatchers.IO) {
        if (value == null) return@withContext
        val uri = Uri.parse(value)
        if (uri.scheme != "file") return@withContext
        val path = uri.path ?: return@withContext
        synchronized(cacheLock) {
            val file = File(path).canonicalFile
            if (file.parentFile == directory.canonicalFile && file.name.matches(Regex("[a-f0-9-]{36}\\.original"))) {
                leases.remove(file.name)
                file.delete()
            }
        }
    }

    suspend fun prepare(args: List<Any?>): HashMap<String, Any?> = withContext(Dispatchers.IO) {
        val id = args.getOrNull(0) as? String ?: return@withContext failure("INVALID_REQUEST")
        val source = args.getOrNull(1) as? String ?: return@withContext failure("INVALID_REQUEST")
        val rawLimit = (args.getOrNull(2) as? Number)?.toDouble() ?: return@withContext failure("INVALID_REQUEST")
        if (id.length !in 1..100 || source.length !in 1..8192 || !rawLimit.isFinite() || rawLimit <= 0 || rawLimit != rawLimit.toLong().toDouble())
            return@withContext failure("INVALID_REQUEST")
        val limit = rawLimit.toLong()
        val uri = if (source.startsWith("/")) Uri.fromFile(File(source)) else Uri.parse(source)
        if (uri.scheme != "content" && uri.scheme != "file") return@withContext failure("UNSUPPORTED_URI")
        val canceled = AtomicBoolean(false)
        if (requests.size >= 20 || requests.putIfAbsent(id, canceled) != null) return@withContext failure("BUSY")
        val coroutine = currentCoroutineContext()
        fun checkActive() {
            coroutine.ensureActive()
            if (!active() || canceled.get()) throw CancellationException("Original upload canceled")
        }
        var output: File? = null
        var reservation = 0L
        var committed = false
        try {
            slots.withPermit {
                checkActive()
                context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { descriptor ->
                    val knownSize = descriptor.length
                    if (knownSize > limit) return@withPermit failure("TOO_LARGE", knownSize)
                    // Providers can under-report their length. Reserve the hard
                    // copy bound so concurrent streams cannot overrun the cache.
                    val needed = limit
                    synchronized(cacheLock) {
                        check(directory.isDirectory || directory.mkdirs())
                        val now = System.currentTimeMillis()
                        directory.listFiles()?.filter { it.name !in leases && now - it.lastModified() > CACHE_LIFETIME_MS }?.forEach { it.delete() }
                        val used = directory.listFiles()?.sumOf { it.length() } ?: 0L
                        if (needed > CACHE_BUDGET - used - reserved || needed + 16L * 1024L * 1024L > directory.usableSpace)
                            return@withPermit failure("CACHE_FULL")
                        reserved += needed
                        reservation = needed
                        output = File(directory, "${UUID.randomUUID()}.original")
                    }
                    val size = descriptor.createInputStream().use { input ->
                        output!!.outputStream().use { destination -> copyOriginal(input, destination, limit, ::checkActive) }
                    }
                    checkActive()
                    if (size == 0L) return@withPermit failure("EMPTY_FILE")
                    val file = output!!
                    leases.add(file.name)
                    committed = true
                    hashMapOf<String, Any?>("ok" to true, "uri" to Uri.fromFile(file).toString(), "size" to size.toDouble())
                } ?: failure("UNREADABLE")
            }
        } catch (error: OriginalTooLarge) {
            failure("TOO_LARGE", error.observedSize)
        } catch (error: CancellationException) {
            failure("CANCELED")
        } catch (error: Exception) {
            // Provider errors can contain private file paths: keep them out of logs/UI.
            failure("UNREADABLE")
        } finally {
            synchronized(cacheLock) {
                if (!committed) output?.delete()
                reserved -= reservation
            }
            requests.remove(id)
        }
    }
}
