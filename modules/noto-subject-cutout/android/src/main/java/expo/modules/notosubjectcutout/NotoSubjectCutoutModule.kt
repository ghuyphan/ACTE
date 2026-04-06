package expo.modules.notosubjectcutout

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.util.Log
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenter
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.nio.FloatBuffer
import kotlinx.coroutines.tasks.await

private const val MODULE_NAME = "NotoSubjectCutout"
private const val LOG_TAG = "NotoSubjectCutout"
private const val SUBJECT_MASK_MIN_ALPHA_CONFIDENCE = 0.08f
private const val SUBJECT_MASK_FULL_ALPHA_CONFIDENCE = 0.72f
private const val PREPARE_BITMAP_SIZE = 256

class NotoSubjectCutoutModule : Module() {
  private val segmenterOptions by lazy {
    SubjectSegmenterOptions.Builder()
      .enableForegroundBitmap()
      .enableForegroundConfidenceMask()
      .build()
  }

  private var cachedSegmenter: SubjectSegmenter? = null

  override fun definition() = ModuleDefinition {
    Name(MODULE_NAME)

    AsyncFunction("prepareAsync") Coroutine { ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
        Log.d(LOG_TAG, "prepareAsync: unavailable on sdk=${Build.VERSION.SDK_INT}")
        mapOf("available" to false, "ready" to false)
      } else {
        val segmenter = getOrCreateSegmenter()
        Log.d(LOG_TAG, "prepareAsync: waiting for segmenter init")
        segmenter.getInitTask().await()
        warmSubjectCutout(segmenter)
        Log.d(LOG_TAG, "prepareAsync: subject cutout model ready")
        mapOf("available" to true, "ready" to true)
      }
    }

    AsyncFunction("cutOutAsync") Coroutine { sourceUri: String, destinationBasePath: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
        throw SubjectCutoutException(
          "platform-unavailable",
          "Foreground subject cutout requires Android 7 or newer."
        )
      }

      val context = requireNotNull(appContext.reactContext) {
        "React application context is not available."
      }

      val sourceFile = fileFromRawUri(sourceUri)
      if (!sourceFile.exists() || sourceFile.isDirectory) {
        throw SubjectCutoutException("source-unavailable", "The source image is unavailable.")
      }

      val sourceBitmap = BitmapFactory.decodeFile(sourceFile.absolutePath)
        ?: throw SubjectCutoutException("source-unavailable", "Unable to decode the source image.")
      Log.d(
        LOG_TAG,
        "cutOutAsync: source=${sourceFile.absolutePath} size=${sourceBitmap.width}x${sourceBitmap.height}"
      )

      val destinationBaseFile = fileFromRawUri(destinationBasePath)
      val destinationFile = File(destinationBaseFile.parentFile, "${destinationBaseFile.name}.png")
      destinationFile.parentFile?.mkdirs()
      if (destinationFile.exists()) {
        destinationFile.delete()
      }

      val segmenter = getOrCreateSegmenter()

      try {
        segmenter.getInitTask().await()

        val result = segmenter.process(InputImage.fromFilePath(context, Uri.fromFile(sourceFile))).await()
        val foregroundMask = result.foregroundConfidenceMask
        Log.d(
          LOG_TAG,
          "cutOutAsync: hasForegroundMask=${foregroundMask != null}"
        )
        val cutoutBitmap = foregroundMask?.let { mask ->
          applyConfidenceMaskToBitmap(sourceBitmap, mask, sourceBitmap.width, sourceBitmap.height)
        }

        if (cutoutBitmap == null) {
          Log.w(LOG_TAG, "cutOutAsync: no visible pixels in foreground mask")
          throw SubjectCutoutException(
            "no-subject",
            "No clear foreground subject was found in this image."
          )
        }

        val croppedBitmap = cropBitmapToVisiblePixels(cutoutBitmap) ?: cutoutBitmap
        Log.d(
          LOG_TAG,
          "cutOutAsync: foreground bitmap=${cutoutBitmap.width}x${cutoutBitmap.height} cropped=${croppedBitmap.width}x${croppedBitmap.height}"
        )
        writeCutoutBitmap(croppedBitmap, destinationFile)

        mapOf(
          "uri" to Uri.fromFile(destinationFile).toString(),
          "mimeType" to "image/png",
          "width" to croppedBitmap.width,
          "height" to croppedBitmap.height
        )
      } catch (error: Throwable) {
        destinationFile.delete()
        Log.e(LOG_TAG, "cutOutAsync failed: ${error.message}", error)
        throw mapSubjectCutoutError(error)
      }
    }
  }

  private fun getOrCreateSegmenter(): SubjectSegmenter {
    cachedSegmenter?.let { return it }
    return SubjectSegmentation.getClient(segmenterOptions).also {
      cachedSegmenter = it
    }
  }

  private suspend fun warmSubjectCutout(segmenter: SubjectSegmenter) {
    val warmBitmap = Bitmap.createBitmap(PREPARE_BITMAP_SIZE, PREPARE_BITMAP_SIZE, Bitmap.Config.ARGB_8888)
    warmBitmap.eraseColor(Color.WHITE)
    Log.d(LOG_TAG, "warmSubjectCutout: warming with ${PREPARE_BITMAP_SIZE}x${PREPARE_BITMAP_SIZE} bitmap")
    segmenter.process(InputImage.fromBitmap(warmBitmap, 0)).await()
  }

  private fun applyConfidenceMaskToBitmap(
    sourceBitmap: Bitmap,
    maskBuffer: FloatBuffer,
    width: Int,
    height: Int
  ): Bitmap? {
    if (width <= 0 || height <= 0 || sourceBitmap.width < width || sourceBitmap.height < height) {
      return null
    }

    val pixels = IntArray(width * height)
    sourceBitmap.getPixels(pixels, 0, width, 0, 0, width, height)
    val outputBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val outputPixels = IntArray(width * height)
    val confidenceValues = maskBuffer.duplicate().apply { rewind() }
    var visiblePixelCount = 0

    for (index in 0 until width * height) {
      val confidence = confidenceValues.get()
      val alpha = toAlpha(confidence)
      if (alpha > 0) {
        visiblePixelCount += 1
      }
      val pixel = pixels[index]
      outputPixels[index] = Color.argb(
        alpha,
        Color.red(pixel),
        Color.green(pixel),
        Color.blue(pixel)
      )
    }

    if (visiblePixelCount == 0) {
      Log.w(LOG_TAG, "applyConfidenceMaskToBitmap: mask produced zero visible pixels width=$width height=$height")
      return null
    }

    outputBitmap.setPixels(outputPixels, 0, width, 0, 0, width, height)
    return outputBitmap
  }

  private fun toAlpha(confidence: Float): Int {
    val normalized = ((confidence - SUBJECT_MASK_MIN_ALPHA_CONFIDENCE) /
      (SUBJECT_MASK_FULL_ALPHA_CONFIDENCE - SUBJECT_MASK_MIN_ALPHA_CONFIDENCE))
      .coerceIn(0f, 1f)
    return (normalized * normalized * 255f).toInt().coerceIn(0, 255)
  }

  private fun cropBitmapToVisiblePixels(bitmap: Bitmap): Bitmap? {
    val width = bitmap.width
    val height = bitmap.height
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

    var minX = width
    var minY = height
    var maxX = -1
    var maxY = -1

    for (y in 0 until height) {
      for (x in 0 until width) {
        val alpha = Color.alpha(pixels[y * width + x])
        if (alpha > 10) {
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      Log.w(LOG_TAG, "cropBitmapToVisiblePixels: bitmap had no visible alpha")
      return null
    }

    val croppedWidth = maxX - minX + 1
    val croppedHeight = maxY - minY + 1
    if (croppedWidth == width && croppedHeight == height) {
      return bitmap
    }

    return Bitmap.createBitmap(bitmap, minX, minY, croppedWidth, croppedHeight)
  }

  private fun writeCutoutBitmap(bitmap: Bitmap, destinationFile: File) {
    FileOutputStream(destinationFile).use { output ->
      if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) {
        throw SubjectCutoutException("processing-failed", "Unable to save the sticker cutout.")
      }
    }
  }

  private fun fileFromRawUri(rawValue: String): File {
    val trimmedValue = rawValue.trim()
    if (trimmedValue.isEmpty()) {
      throw SubjectCutoutException("source-unavailable", "Expected a file path or file URI.")
    }

    val parsedUri = Uri.parse(trimmedValue)
    return if (parsedUri.scheme == "file") {
      File(requireNotNull(parsedUri.path) { "Expected a file URI with a path." })
    } else {
      File(trimmedValue)
    }
  }

  private fun mapSubjectCutoutError(error: Throwable): Throwable {
    if (error is SubjectCutoutException) {
      return error
    }

    if (error is MlKitException) {
      val normalizedMessage = error.message?.lowercase().orEmpty()
      Log.w(LOG_TAG, "mapSubjectCutoutError: MlKitException code=${error.errorCode} message=${error.message}")
      if (
        normalizedMessage.contains("download") &&
        (normalizedMessage.contains("model") || normalizedMessage.contains("module"))
      ) {
        return SubjectCutoutException(
          "model-unavailable",
          "The on-device subject cutout model is not ready yet. Try again in a moment."
        )
      }
    }

    return SubjectCutoutException(
      "processing-failed",
      error.message ?: "Unable to build a sticker cutout from this image."
    )
  }
}

internal class SubjectCutoutException(
  errorCode: String,
  override val message: String
) : CodedException(errorCode, message, null)
