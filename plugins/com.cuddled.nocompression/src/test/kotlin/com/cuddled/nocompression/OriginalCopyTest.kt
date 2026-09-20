package com.cuddled.nocompression

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.util.concurrent.CancellationException
import org.junit.Assert.*
import org.junit.Test

class OriginalCopyTest {
    @Test fun preservesEveryByteAcrossBufferBoundaries() {
        val bytes = ByteArray(196613) { ((it * 31) % 256).toByte() }
        val output = ByteArrayOutputStream()
        val size = copyOriginal(ByteArrayInputStream(bytes), output, bytes.size.toLong()) {}
        assertEquals(bytes.size.toLong(), size)
        assertArrayEquals(bytes, output.toByteArray())
    }
    @Test fun exactLimitSucceedsButOneByteOverStopsBeforeWritingExcess() {
        val bytes = ByteArray(65537) { 17 }
        val output = ByteArrayOutputStream()
        try {
            copyOriginal(ByteArrayInputStream(bytes), output, 65536) {}
            fail("Expected oversized original")
        } catch (error: OriginalTooLarge) {
            assertEquals(65537L, error.observedSize)
            assertEquals(65536, output.size())
        }
    }
    @Test fun cancellationStopsReadingAndWriting() {
        val output = ByteArrayOutputStream()
        var checks = 0
        try {
            copyOriginal(ByteArrayInputStream(ByteArray(200000)), output, 200000) {
                if (++checks == 2) throw CancellationException()
            }
            fail("Expected cancellation")
        } catch (error: CancellationException) {
            assertEquals(65536, output.size())
        }
    }
    @Test fun handlesShortReadsAndEmptyStreams() {
        val input = object : InputStream() {
            var position = 0
            override fun read(): Int = if (position < 17) position++ else -1
            override fun read(bytes: ByteArray, offset: Int, length: Int): Int {
                val byte = read()
                if (byte < 0) return -1
                bytes[offset] = byte.toByte()
                return 1
            }
        }
        val output = ByteArrayOutputStream()
        assertEquals(17L, copyOriginal(input, output, 20) {})
        assertArrayEquals(ByteArray(17) { it.toByte() }, output.toByteArray())
        assertEquals(0L, copyOriginal(ByteArrayInputStream(byteArrayOf()), output, 20) {})
    }
}
