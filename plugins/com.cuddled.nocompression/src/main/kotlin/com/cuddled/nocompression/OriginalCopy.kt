package com.cuddled.nocompression

import java.io.InputStream
import java.io.OutputStream

internal class OriginalTooLarge(val observedSize: Long) : Exception("Original exceeds upload limit")

/** Streams original bytes, with no decoder/encoder and bounded working memory. */
internal fun copyOriginal(input: InputStream, output: OutputStream, limit: Long, checkActive: () -> Unit): Long {
    require(limit > 0)
    val buffer = ByteArray(64 * 1024)
    var size = 0L
    while (true) {
        checkActive()
        val count = input.read(buffer)
        if (count < 0) break
        if (count == 0) continue
        size += count
        if (size > limit) throw OriginalTooLarge(size)
        output.write(buffer, 0, count)
    }
    checkActive()
    return size
}
