package expo.modules.notolivephotomotion

import android.media.MediaMetadataRetriever
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

private const val MODULE_NAME = "NotoLivePhotoMotion"

@androidx.annotation.OptIn(UnstableApi::class)
class NotoLivePhotoMotionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name(MODULE_NAME)

    AsyncFunction("normalizeAsync") Coroutine { sourceUri: String, destinationBasePath: String, maxDurationSeconds: Double, maxDimension: Double ->
      val context = requireNotNull(appContext.reactContext) {
        "React application context is not available."
      }

      val sourceFile = fileFromRawUri(sourceUri)
      val destinationBaseFile = fileFromRawUri(destinationBasePath)
      val destinationFile = File(destinationBaseFile.parentFile, "${destinationBaseFile.name}.mp4")

      destinationFile.parentFile?.mkdirs()
      if (destinationFile.exists()) {
        destinationFile.delete()
      }

      val mediaInfo = readMediaInfo(sourceFile)
      val maxDurationMs = (maxDurationSeconds * 1000).toLong().coerceAtLeast(100)
      val clippingConfiguration = MediaItem.ClippingConfiguration.Builder()
        .setEndPositionMs(mediaInfo.durationMs.coerceAtMost(maxDurationMs))
        .build()

      val mediaItem = MediaItem.Builder()
        .setUri(Uri.fromFile(sourceFile))
        .setClippingConfiguration(clippingConfiguration)
        .build()

      val presentation = buildPresentationEffect(
        width = mediaInfo.width,
        height = mediaInfo.height,
        maxDimension = maxDimension
      )

      val editedMediaItemBuilder = EditedMediaItem.Builder(mediaItem)
        .setRemoveAudio(true)

      if (presentation != null) {
        editedMediaItemBuilder.setEffects(Effects(emptyList(), listOf(presentation)))
      }

      val editedMediaItem = editedMediaItemBuilder.build()

      val transformer = Transformer.Builder(context)
        .setVideoMimeType(MimeTypes.VIDEO_H264)
        .build()

      suspendCancellableCoroutine<Unit> { continuation ->
        val listener = object : Transformer.Listener {
          override fun onCompleted(
            composition: androidx.media3.transformer.Composition,
            exportResult: ExportResult
          ) {
            continuation.resume(Unit)
          }

          override fun onError(
            composition: androidx.media3.transformer.Composition,
            exportResult: ExportResult,
            exportException: ExportException
          ) {
            destinationFile.delete()
            continuation.resumeWithException(exportException)
          }
        }

        transformer.addListener(listener)
        continuation.invokeOnCancellation {
          transformer.cancel()
          destinationFile.delete()
        }

        try {
          transformer.start(editedMediaItem, destinationFile.absolutePath)
        } catch (error: Throwable) {
          transformer.removeListener(listener)
          destinationFile.delete()
          continuation.resumeWithException(error)
        }
      }

      mapOf(
        "uri" to Uri.fromFile(destinationFile).toString(),
        "size" to destinationFile.length().toDouble()
      )
    }
  }

  private fun fileFromRawUri(rawValue: String): File {
    val trimmedValue = rawValue.trim()
    if (trimmedValue.isEmpty()) {
      throw IllegalArgumentException("Expected a file path or file URI.")
    }

    val parsedUri = Uri.parse(trimmedValue)
    return if (parsedUri.scheme == "file") {
      File(requireNotNull(parsedUri.path) { "Expected a file URI with a path." })
    } else {
      File(trimmedValue)
    }
  }

  private fun readMediaInfo(file: File): MediaInfo {
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(file.absolutePath)

      val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull()
      val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull()
      val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()

      require(width != null && height != null && durationMs != null) {
        "Unable to read motion clip metadata."
      }

      return if (rotation == 90 || rotation == 270) {
        MediaInfo(width = height, height = width, durationMs = durationMs)
      } else {
        MediaInfo(width = width, height = height, durationMs = durationMs)
      }
    } finally {
      retriever.release()
    }
  }

  private fun buildPresentationEffect(
    width: Int,
    height: Int,
    maxDimension: Double
  ): Presentation? {
    val boundedMaxDimension = maxDimension.toInt().coerceAtLeast(1)
    val longestSide = maxOf(width, height)
    if (longestSide <= boundedMaxDimension) {
      return null
    }

    val scale = boundedMaxDimension.toDouble() / longestSide.toDouble()
    val targetWidth = roundToEven((width * scale).toInt().coerceAtLeast(2))
    val targetHeight = roundToEven((height * scale).toInt().coerceAtLeast(2))

    return Presentation
      .createForWidthAndHeight(
        targetWidth,
        targetHeight,
        Presentation.LAYOUT_SCALE_TO_FIT
      )
  }

  private fun roundToEven(value: Int): Int {
    return if (value % 2 == 0) value else value - 1
  }

  private data class MediaInfo(
    val width: Int,
    val height: Int,
    val durationMs: Long
  )
}
