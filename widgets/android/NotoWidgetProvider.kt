package com.acte.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PointF
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.BitmapShader
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.util.Base64
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import com.acte.app.R
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

private const val TEXT_NOTE_OVERLAY_OPACITY = 0.5f
private const val PHOTO_NOTE_OVERLAY_OPACITY = 0.92f
// Match the in-app photo memory card more closely than the SwiftUI widget.
private const val PHOTO_NOTE_STICKER_OVERLAY_OPACITY = 0.82f
private const val SMALL_WIDGET_MAX_RENDER_EDGE_PX = 760
private const val MEDIUM_WIDGET_MAX_RENDER_EDGE_PX = 960
private const val SMALL_WIDGET_MAX_RENDER_PIXELS = 440_000
private const val MEDIUM_WIDGET_MAX_RENDER_PIXELS = 600_000
private const val STICKER_OUTLINE_COLOR = "#FAFAFA"
private const val STICKER_OUTLINE_OPACITY = 0.72f
private const val STAMP_OUTLINE_COLOR = "#FFFAF0"
private const val STAMP_OUTLINE_OPACITY = 0.98f
private const val STAMP_PAPER_BORDER_COLOR = "#8F7048"
private const val STAMP_PAPER_BORDER_OPACITY = 0.10f
private val STICKER_OUTLINE_OFFSETS = listOf(
  PointF(-1f, 0f),
  PointF(-0.92f, -0.38f),
  PointF(-0.71f, -0.71f),
  PointF(-0.38f, -0.92f),
  PointF(0f, -1f),
  PointF(0.38f, -0.92f),
  PointF(0.71f, -0.71f),
  PointF(0.92f, -0.38f),
  PointF(1f, 0f),
  PointF(0.92f, 0.38f),
  PointF(0.71f, 0.71f),
  PointF(0.38f, 0.92f),
  PointF(0f, 1f),
  PointF(-0.38f, 0.92f),
  PointF(-0.71f, 0.71f),
  PointF(-0.92f, 0.38f)
)

private data class WidgetRenderSize(
  val widthPx: Int,
  val heightPx: Int
)

private data class WidgetOverlayRenderSpec(
  val doodleInsetDp: Float,
  val stickerInsetDp: Float,
  val stickerMinimumBaseSizeDp: Float,
  val stickerBaseSizeRatio: Float
)

private data class WidgetStampMetrics(
  val borderRadius: Float,
  val outerWidth: Float,
  val outerHeight: Float,
  val perforationOffset: Float,
  val perforationRadius: Float
)

private fun getWidgetOuterPaddingDp(isMedium: Boolean): Float {
  return if (isMedium) 8f else 6f
}

private fun getWidgetCardShellPaddingDp(isMedium: Boolean): Float {
  return if (isMedium) 5f else 4f
}

private fun getWidgetInnerCornerRadiusDp(isMedium: Boolean): Float {
  return if (isMedium) 26f else 22f
}

private fun applyAlphaToColor(color: Int, alphaFraction: Float): Int {
  val alpha = (alphaFraction.coerceIn(0f, 1f) * 255f).toInt().coerceIn(0, 255)
  return Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color))
}

private fun clampWidgetScalar(value: Float, minValue: Float, maxValue: Float): Float {
  return min(maxValue, max(minValue, value))
}

private fun buildWidgetStampPerforationCenters(length: Float, radius: Float): List<Float> {
  val safeLength = max(length, radius * 4f)
  val preferredSpacing = max(radius * 1.95f, 10f)
  val count = max(5, kotlin.math.floor(safeLength / preferredSpacing).toInt())
  val start = radius * 0.58f
  val end = safeLength - radius * 0.58f
  val step = if (count <= 1) 0f else (end - start) / (count - 1).toFloat()

  return List(count) { index ->
    start + (step * index.toFloat())
  }
}

private fun getWidgetStampMetrics(width: Float, height: Float): WidgetStampMetrics {
  val shortestEdge = max(min(width, height), 1f)
  val perforationRadius = clampWidgetScalar(shortestEdge * 0.048f, 4f, 6.6f)
  val perforationOffset = perforationRadius * 0.18f
  val borderRadius = clampWidgetScalar(shortestEdge * 0.02f, 1.5f, 3.5f)

  return WidgetStampMetrics(
    borderRadius = borderRadius,
    outerWidth = width,
    outerHeight = height,
    perforationOffset = perforationOffset,
    perforationRadius = perforationRadius
  )
}

private fun createWidgetStampCutoutPath(width: Float, height: Float, metrics: WidgetStampMetrics): Path {
  return Path().apply {
    fillType = Path.FillType.EVEN_ODD
    addRoundRect(RectF(0f, 0f, width, height), metrics.borderRadius, metrics.borderRadius, Path.Direction.CW)

    buildWidgetStampPerforationCenters(width, metrics.perforationRadius).forEach { centerX ->
      addCircle(centerX, -metrics.perforationOffset, metrics.perforationRadius, Path.Direction.CW)
      addCircle(centerX, height + metrics.perforationOffset, metrics.perforationRadius, Path.Direction.CW)
    }

    buildWidgetStampPerforationCenters(height, metrics.perforationRadius).forEach { centerY ->
      addCircle(-metrics.perforationOffset, centerY, metrics.perforationRadius, Path.Direction.CW)
      addCircle(width + metrics.perforationOffset, centerY, metrics.perforationRadius, Path.Direction.CW)
    }
  }
}

private fun createWidgetStampMaskPath(width: Float, height: Float, metrics: WidgetStampMetrics): Path {
  val roundedRectPath = Path().apply {
    addRoundRect(RectF(0f, 0f, width, height), metrics.borderRadius, metrics.borderRadius, Path.Direction.CW)
  }
  val cutoutPath = Path().apply {
    buildWidgetStampPerforationCenters(width, metrics.perforationRadius).forEach { centerX ->
      addCircle(centerX, -metrics.perforationOffset, metrics.perforationRadius, Path.Direction.CW)
      addCircle(centerX, height + metrics.perforationOffset, metrics.perforationRadius, Path.Direction.CW)
    }

    buildWidgetStampPerforationCenters(height, metrics.perforationRadius).forEach { centerY ->
      addCircle(-metrics.perforationOffset, centerY, metrics.perforationRadius, Path.Direction.CW)
      addCircle(width + metrics.perforationOffset, centerY, metrics.perforationRadius, Path.Direction.CW)
    }
  }

  return Path().apply {
    if (!op(roundedRectPath, cutoutPath, Path.Op.DIFFERENCE)) {
      addPath(roundedRectPath)
    }
  }
}

private fun drawBitmapAspectFill(
  canvas: Canvas,
  bitmap: Bitmap,
  left: Float,
  top: Float,
  targetWidth: Float,
  targetHeight: Float,
  paint: Paint
) {
  val sourceWidth = max(bitmap.width.toFloat(), 1f)
  val sourceHeight = max(bitmap.height.toFloat(), 1f)
  val scale = max(targetWidth / sourceWidth, targetHeight / sourceHeight)
  val dx = (targetWidth - (sourceWidth * scale)) / 2f
  val dy = (targetHeight - (sourceHeight * scale)) / 2f

  canvas.save()
  canvas.translate(left, top)
  canvas.translate(dx, dy)
  canvas.scale(scale, scale)
  canvas.drawBitmap(bitmap, 0f, 0f, paint)
  canvas.restore()
}

private fun renderWidgetStampBitmap(
  sourceBitmap: Bitmap,
  targetWidth: Int,
  targetHeight: Int,
  opacity: Float
): Bitmap {
  val width = max(targetWidth, 1)
  val height = max(targetHeight, 1)
  val metrics = getWidgetStampMetrics(width.toFloat(), height.toFloat())
  val stampPath = createWidgetStampMaskPath(width.toFloat(), height.toFloat(), metrics)
  val normalizedOpacity = opacity.coerceIn(0f, 1f)
  val output = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
  val canvas = Canvas(output)
  val outlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = max(2.6f, metrics.perforationRadius * 0.72f)
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
    color = Color.argb((250f * normalizedOpacity).toInt().coerceIn(0, 255), 255, 250, 240)
  }
  val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = max(1f, metrics.perforationRadius * 0.18f)
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
    color = Color.argb((26f * normalizedOpacity).toInt().coerceIn(0, 255), 143, 112, 72)
  }
  val imagePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    isFilterBitmap = true
    alpha = (255f * normalizedOpacity).toInt().coerceIn(0, 255)
  }

  canvas.save()
  canvas.clipRect(0f, 0f, width.toFloat(), height.toFloat())
  canvas.clipPath(stampPath)
  drawBitmapAspectFill(canvas, sourceBitmap, 0f, 0f, width.toFloat(), height.toFloat(), imagePaint)
  canvas.restore()

  canvas.save()
  canvas.clipRect(0f, 0f, width.toFloat(), height.toFloat())
  canvas.clipPath(stampPath)
  canvas.drawPath(stampPath, outlinePaint)
  canvas.drawPath(stampPath, borderPaint)
  canvas.restore()

  return output
}

class NotoWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    appWidgetIds.forEach { appWidgetId ->
      updateWidget(context, appWidgetManager, appWidgetId)
    }
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: Bundle
  ) {
    updateWidget(context, appWidgetManager, appWidgetId)
  }

  companion object {
    fun updateAllWidgets(context: Context) {
      val appWidgetManager = AppWidgetManager.getInstance(context)
      val componentName = ComponentName(context, NotoWidgetProvider::class.java)
      val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
      appWidgetIds.forEach { appWidgetId ->
        updateWidget(context, appWidgetManager, appWidgetId)
      }
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
      val snapshot = parseSnapshot(NotoWidgetStorage.loadSnapshotJson(context))
      val options = manager.getAppWidgetOptions(appWidgetId)
      val isMedium = isMediumWidget(options)
      val views = RemoteViews(
        context.packageName,
        if (isMedium) R.layout.noto_widget_medium else R.layout.noto_widget_small
      )

      bindRootIntent(context, views, appWidgetId, snapshot)
      bindSnapshot(context, views, snapshot, options, isMedium, appWidgetId)

      manager.updateAppWidget(appWidgetId, views)
    }

    private fun bindRootIntent(context: Context, views: RemoteViews, appWidgetId: Int, snapshot: NotoWidgetSnapshot) {
      views.setOnClickPendingIntent(
        R.id.widget_root,
        createWidgetPendingIntent(context, appWidgetId, snapshot.primaryActionUrl)
      )
    }

    private fun bindSnapshot(
      context: Context,
      views: RemoteViews,
      snapshot: NotoWidgetSnapshot,
      options: Bundle,
      isMedium: Boolean,
      appWidgetId: Int
    ) {
      val hasImage = !snapshot.backgroundImageUrl.isNullOrBlank() || !snapshot.backgroundImageBase64.isNullOrBlank()
      val showIdle = snapshot.noteCount <= 0 || (snapshot.isIdleState && snapshot.text.isBlank() && !hasImage)
      val showLivePhotoBadge = shouldShowLivePhotoBadge(snapshot, showIdle, hasImage)
      val usesTextSurface = showIdle || !hasImage
      val hasVisualOnlyContent =
        !showIdle &&
        snapshot.noteType == "text" &&
        snapshot.text.isBlank() &&
        (
          (snapshot.hasDoodle && !snapshot.doodleStrokesJson.isNullOrBlank()) ||
          (snapshot.hasStickers && !snapshot.stickerPlacementsJson.isNullOrBlank())
        )
      val shouldHidePhotoBodyText =
        !showIdle &&
        snapshot.noteType == "photo" &&
        hasImage
      val photoCaptionText = if (!showIdle && snapshot.noteType == "photo" && hasImage) {
        snapshot.text.trim()
      } else {
        ""
      }
      val bodyText = if (showIdle) {
        snapshot.idleText.ifBlank { context.getString(R.string.noto_widget_idle_fallback) }
      } else if (hasVisualOnlyContent || shouldHidePhotoBodyText) {
        ""
      } else {
        snapshot.text.ifBlank { snapshot.memoryReminderText.ifBlank { context.getString(R.string.noto_widget_memory_fallback) } }
      }
      val compactLocationName = getCompactLocationName(snapshot.locationName)
      val noteCountLabel = snapshot.savedCountText.ifBlank {
        context.resources.getQuantityString(
          R.plurals.noto_widget_count_fallback,
          snapshot.noteCount,
          snapshot.noteCount
        )
      }
      val showCountBadge = showIdle && snapshot.noteCount > 0
      val showCaption = isMedium && photoCaptionText.isNotBlank()

      bindTextBackgroundState(context, views, snapshot, options, isMedium, usesTextSurface, showIdle)
      bindPhotoState(context, views, snapshot, showIdle, options, isMedium)
      bindStickerState(context, views, snapshot, options, isMedium, showIdle)
      bindDoodleState(context, views, snapshot, options, isMedium, usesTextSurface, showIdle)
      val showAuthorChip = bindAuthorState(context, views, snapshot, showIdle, usesTextSurface)
      bindLivePhotoBadge(views, showLivePhotoBadge)

      views.setTextViewText(R.id.widget_body, bodyText)
      views.setViewVisibility(R.id.widget_body, if (bodyText.isBlank()) View.GONE else View.VISIBLE)
      views.setTextColor(
        R.id.widget_body,
        if (usesTextSurface) Color.parseColor("#2A1A11") else Color.parseColor("#FFF8F0")
      )
      views.setViewVisibility(R.id.widget_caption, if (showCaption) View.VISIBLE else View.GONE)
      if (showCaption) {
        views.setTextViewText(R.id.widget_caption, photoCaptionText)
        views.setInt(
          R.id.widget_caption,
          "setBackgroundResource",
          R.drawable.noto_widget_overlay_chip_dark
        )
        views.setTextColor(R.id.widget_caption, Color.parseColor("#FFF8F0"))
      }

      val showLocationChip = !showIdle && !showAuthorChip && compactLocationName.isNotBlank()
      views.setViewVisibility(R.id.widget_location, if (showLocationChip) View.VISIBLE else View.GONE)
      if (showLocationChip) {
        views.setTextViewText(R.id.widget_location, compactLocationName)
        views.setInt(
          R.id.widget_location,
          "setBackgroundResource",
          if (usesTextSurface) R.drawable.noto_widget_badge_light else R.drawable.noto_widget_overlay_chip_dark
        )
        views.setTextColor(
          R.id.widget_location,
          if (usesTextSurface) Color.parseColor("#6E5E4F") else Color.parseColor("#FFF8F0")
        )
      }

      views.setViewVisibility(R.id.widget_badge, if (showCountBadge) View.VISIBLE else View.GONE)
      if (showCountBadge) {
        views.setTextViewText(R.id.widget_badge, noteCountLabel)
        views.setInt(
          R.id.widget_badge,
          "setBackgroundResource",
          if (usesTextSurface) R.drawable.noto_widget_badge_light else R.drawable.noto_widget_count_badge_dark
        )
        views.setTextColor(
          R.id.widget_badge,
          if (usesTextSurface) Color.parseColor("#6E5E4F") else Color.parseColor("#FFF8F0")
        )
        views.setOnClickPendingIntent(
          R.id.widget_badge,
          createWidgetPendingIntent(context, (appWidgetId * 10) + 1, snapshot.badgeActionUrl)
        )
      }
    }

    private fun bindTextBackgroundState(
      context: Context,
      views: RemoteViews,
      snapshot: NotoWidgetSnapshot,
      options: Bundle,
      isMedium: Boolean,
      usesTextSurface: Boolean,
      showIdle: Boolean
    ) {
      val startColorValue = snapshot.backgroundGradientStartColor?.takeIf { it.isNotBlank() }
      if (!usesTextSurface || showIdle || startColorValue == null) {
        views.setViewVisibility(R.id.widget_text_background_overlay, View.GONE)
        return
      }

      val tintColor = applyAlphaToColor(Color.parseColor(startColorValue), 0.14f)
      val overlayBitmap = createRoundedGradientBitmap(
        widthPx = resolveContentWidthPx(context, options, isMedium),
        heightPx = resolveContentHeightPx(context, options, isMedium),
        cornerRadiusPx = context.dpToPx(getWidgetInnerCornerRadiusDp(isMedium)).toFloat(),
        startColor = tintColor,
        endColor = tintColor
      )

      views.setViewVisibility(R.id.widget_text_background_overlay, View.VISIBLE)
      views.setImageViewBitmap(R.id.widget_text_background_overlay, overlayBitmap)
    }

    private fun bindPhotoState(
      context: Context,
      views: RemoteViews,
      snapshot: NotoWidgetSnapshot,
      showIdle: Boolean,
      options: Bundle,
      isMedium: Boolean
    ) {
      val photoBitmap = if (!showIdle) {
        decodePhoto(
          snapshot = snapshot,
          targetWidthPx = resolveContentWidthPx(context, options, isMedium),
          targetHeightPx = resolveContentHeightPx(context, options, isMedium),
          cornerRadiusPx = context.dpToPx(getWidgetInnerCornerRadiusDp(isMedium)).toFloat()
        )
      } else {
        null
      }
      val hasPhoto = photoBitmap != null

      views.setViewVisibility(R.id.widget_photo, if (hasPhoto) View.VISIBLE else View.GONE)
      views.setViewVisibility(R.id.widget_photo_overlay, if (hasPhoto) View.VISIBLE else View.GONE)
      if (hasPhoto) {
        views.setImageViewBitmap(R.id.widget_photo, photoBitmap)
      }
    }

    private fun bindStickerState(
      context: Context,
      views: RemoteViews,
      snapshot: NotoWidgetSnapshot,
      options: Bundle,
      isMedium: Boolean,
      showIdle: Boolean
    ) {
      val shouldShowStickers =
        !showIdle &&
        snapshot.hasStickers &&
        !snapshot.stickerPlacementsJson.isNullOrBlank()

      if (!shouldShowStickers) {
        views.setViewVisibility(R.id.widget_sticker_overlay, View.GONE)
        return
      }

      val stickerBitmap = renderStickerBitmap(
        context = context,
        stickerPlacementsJson = snapshot.stickerPlacementsJson,
        widthPx = resolveContentWidthPx(context, options, isMedium),
        heightPx = resolveContentHeightPx(context, options, isMedium),
        overlayOpacity = getStickerOverlayOpacity(snapshot),
        renderSpec = getWidgetOverlayRenderSpec(isMedium)
      )

      if (stickerBitmap == null) {
        views.setViewVisibility(R.id.widget_sticker_overlay, View.GONE)
        return
      }

      views.setViewVisibility(R.id.widget_sticker_overlay, View.VISIBLE)
      views.setImageViewBitmap(R.id.widget_sticker_overlay, stickerBitmap)
    }

    private fun bindDoodleState(
      context: Context,
      views: RemoteViews,
      snapshot: NotoWidgetSnapshot,
      options: Bundle,
      isMedium: Boolean,
      usesTextSurface: Boolean,
      showIdle: Boolean
    ) {
      val shouldShowDoodle =
        usesTextSurface &&
        !showIdle &&
        snapshot.noteType == "text" &&
        snapshot.hasDoodle &&
        !snapshot.doodleStrokesJson.isNullOrBlank()

      if (!shouldShowDoodle) {
        views.setViewVisibility(R.id.widget_doodle_overlay, View.GONE)
        return
      }

      val doodleBitmap = renderDoodleBitmap(
        context = context,
        doodleStrokesJson = snapshot.doodleStrokesJson,
        widthPx = resolveContentWidthPx(context, options, isMedium),
        heightPx = resolveContentHeightPx(context, options, isMedium),
        overlayOpacity = getWidgetOverlayOpacity(snapshot),
        renderSpec = getWidgetOverlayRenderSpec(isMedium)
      )

      if (doodleBitmap == null) {
        views.setViewVisibility(R.id.widget_doodle_overlay, View.GONE)
        return
      }

      views.setViewVisibility(R.id.widget_doodle_overlay, View.VISIBLE)
      views.setImageViewBitmap(R.id.widget_doodle_overlay, doodleBitmap)
    }

    private fun bindAuthorState(
      context: Context,
      views: RemoteViews,
      snapshot: NotoWidgetSnapshot,
      showIdle: Boolean,
      usesTextSurface: Boolean
    ): Boolean {
      val compactAuthorName = getCompactAuthorName(snapshot)
      val showAuthorChip = shouldShowAuthorChip(snapshot, showIdle)

      if (!showAuthorChip) {
        views.setViewVisibility(R.id.widget_author_chip, View.GONE)
        views.setViewVisibility(R.id.widget_author_avatar, View.GONE)
        views.setViewVisibility(R.id.widget_author_initials, View.GONE)
        views.setViewVisibility(R.id.widget_author_name, View.GONE)
        return false
      }

      val onDarkSurface = !usesTextSurface
      views.setViewVisibility(R.id.widget_author_chip, View.VISIBLE)
      views.setInt(
        R.id.widget_author_chip,
        "setBackgroundResource",
        if (onDarkSurface) R.drawable.noto_widget_overlay_chip_dark else R.drawable.noto_widget_badge_light
      )

      val foregroundColor = if (onDarkSurface) Color.parseColor("#FFF8F0") else Color.parseColor("#2A1A11")
      val avatarBitmap = decodeAuthorAvatar(snapshot, context.dpToPx(18f))

      if (avatarBitmap != null) {
        views.setViewVisibility(R.id.widget_author_avatar, View.VISIBLE)
        views.setImageViewBitmap(R.id.widget_author_avatar, avatarBitmap)
        views.setViewVisibility(R.id.widget_author_initials, View.GONE)
      } else if (snapshot.authorInitials.isNotBlank()) {
        views.setViewVisibility(R.id.widget_author_avatar, View.GONE)
        views.setViewVisibility(R.id.widget_author_initials, View.VISIBLE)
        views.setTextViewText(R.id.widget_author_initials, snapshot.authorInitials)
        views.setTextColor(R.id.widget_author_initials, foregroundColor)
      } else {
        views.setViewVisibility(R.id.widget_author_avatar, View.GONE)
        views.setViewVisibility(R.id.widget_author_initials, View.GONE)
      }

      if (compactAuthorName.isNotBlank()) {
        views.setViewVisibility(R.id.widget_author_name, View.VISIBLE)
        views.setTextViewText(R.id.widget_author_name, compactAuthorName)
        views.setTextColor(R.id.widget_author_name, foregroundColor)
      } else {
        views.setViewVisibility(R.id.widget_author_name, View.GONE)
      }

      return true
    }

    private fun getCompactLocationName(locationName: String): String {
      val segments = locationName
        .split(',')
        .map { it.trim() }
        .filter { it.isNotBlank() }

      if (segments.isEmpty()) {
        return ""
      }

      val baseLabel = if (segments.first().length <= 6 && segments.size > 1) {
        "${segments[0]} ${segments[1]}".trim()
      } else {
        segments.first()
      }

      val shortenedStreetLabel = baseLabel
        .replace(Regex("^\\d+[\\p{L}\\p{N}/-]*\\s+"), "")
        .trim()
      val compactLabel = if (shortenedStreetLabel.length >= 6) {
        shortenedStreetLabel
      } else {
        baseLabel
      }

      return if (compactLabel.length <= 20) {
        compactLabel
      } else {
        "${compactLabel.take(19).trimEnd()}…"
      }
    }

    private fun getCompactAuthorName(snapshot: NotoWidgetSnapshot): String {
      return snapshot.authorDisplayName
        .trim()
        .split(Regex("\\s+"))
        .firstOrNull()
        ?.trim()
        .orEmpty()
    }

    private fun shouldShowAuthorChip(snapshot: NotoWidgetSnapshot, showIdle: Boolean): Boolean {
      if (showIdle || !snapshot.isSharedContent) {
        return false
      }

      val compactAuthorName = getCompactAuthorName(snapshot)
      return compactAuthorName.isNotBlank() ||
        snapshot.authorInitials.isNotBlank() ||
        !snapshot.authorAvatarImageUrl.isNullOrBlank() ||
        !snapshot.authorAvatarImageBase64.isNullOrBlank()
    }

    private fun shouldShowLivePhotoBadge(
      snapshot: NotoWidgetSnapshot,
      showIdle: Boolean,
      hasImage: Boolean
    ): Boolean {
      return !showIdle && hasImage && snapshot.noteType == "photo" && snapshot.isLivePhoto
    }

    private fun bindLivePhotoBadge(views: RemoteViews, shouldShowBadge: Boolean) {
      if (!shouldShowBadge) {
        views.setViewVisibility(R.id.widget_live_photo_badge, View.GONE)
        return
      }

      views.setViewVisibility(R.id.widget_live_photo_badge, View.VISIBLE)
      views.setInt(R.id.widget_live_photo_badge, "setBackgroundResource", R.drawable.noto_widget_overlay_chip_dark)
      views.setImageViewResource(R.id.widget_live_photo_icon, R.drawable.noto_widget_live_photo_icon)
    }

    private fun parseSnapshot(snapshotJson: String?): NotoWidgetSnapshot {
      val json = if (snapshotJson.isNullOrBlank()) JSONObject() else runCatching {
        JSONObject(snapshotJson)
      }.getOrDefault(JSONObject())

      return NotoWidgetSnapshot(
        noteType = json.optString("noteType", "text"),
        text = json.optString("text", ""),
        locationName = json.optString("locationName", ""),
        date = json.optString("date", ""),
        noteCount = json.optInt("noteCount", 0),
        nearbyPlacesCount = json.optInt("nearbyPlacesCount", 0),
        isLivePhoto = json.optBoolean("isLivePhoto", false),
        backgroundImageUrl = json.optString("backgroundImageUrl", "").takeIf { it.isNotBlank() },
        backgroundImageBase64 = json.optString("backgroundImageBase64", "").takeIf { it.isNotBlank() },
        backgroundGradientStartColor = json.optString("backgroundGradientStartColor", "").takeIf { it.isNotBlank() },
        backgroundGradientEndColor = json.optString("backgroundGradientEndColor", "").takeIf { it.isNotBlank() },
        hasDoodle = json.optBoolean("hasDoodle", false),
        doodleStrokesJson = json.optString("doodleStrokesJson", "").takeIf { it.isNotBlank() },
        hasStickers = json.optBoolean("hasStickers", false),
        stickerPlacementsJson = json.optString("stickerPlacementsJson", "").takeIf { it.isNotBlank() },
        isIdleState = json.optBoolean("isIdleState", true),
        idleText = json.optString("idleText", ""),
        savedCountText = json.optString("savedCountText", ""),
        nearbyPlacesLabelText = json.optString("nearbyPlacesLabelText", ""),
        memoryReminderText = json.optString("memoryReminderText", ""),
        accessorySaveMemoryText = json.optString("accessorySaveMemoryText", ""),
        accessoryAddFirstPlaceText = json.optString("accessoryAddFirstPlaceText", ""),
        accessoryMemoryNearbyText = json.optString("accessoryMemoryNearbyText", ""),
        accessoryOpenAppText = json.optString("accessoryOpenAppText", ""),
        accessoryAddLabelText = json.optString("accessoryAddLabelText", ""),
        accessorySavedLabelText = json.optString("accessorySavedLabelText", ""),
        accessoryNearLabelText = json.optString("accessoryNearLabelText", ""),
        livePhotoBadgeText = json.optString("livePhotoBadgeText", ""),
        isSharedContent = json.optBoolean("isSharedContent", false),
        authorDisplayName = json.optString("authorDisplayName", ""),
        authorInitials = json.optString("authorInitials", ""),
        authorAvatarImageUrl = json.optString("authorAvatarImageUrl", "").takeIf { it.isNotBlank() },
        authorAvatarImageBase64 = json.optString("authorAvatarImageBase64", "").takeIf { it.isNotBlank() },
        primaryActionUrl = json.optString("primaryActionUrl", "noto:///").ifBlank { "noto:///" },
        badgeActionUrl = json.optString("badgeActionUrl", "").takeIf { it.isNotBlank() }
      )
    }

    private fun decodeAuthorAvatar(snapshot: NotoWidgetSnapshot, targetSizePx: Int): Bitmap? {
      snapshot.authorAvatarImageUrl?.let { uriString ->
        val normalizedPath = if (uriString.startsWith("file://")) {
          Uri.parse(uriString).path
        } else {
          uriString
        }

        if (!normalizedPath.isNullOrBlank()) {
          BitmapFactory.decodeFile(normalizedPath)?.let { bitmap ->
            return createCircularBitmap(bitmap, targetSizePx)
          }
        }
      }

      snapshot.authorAvatarImageBase64?.let { base64 ->
        return runCatching {
          val bytes = Base64.decode(base64, Base64.DEFAULT)
          BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.let { bitmap ->
            createCircularBitmap(bitmap, targetSizePx)
          }
        }.getOrNull()
      }

      return null
    }

    private fun decodePhoto(
      snapshot: NotoWidgetSnapshot,
      targetWidthPx: Int,
      targetHeightPx: Int,
      cornerRadiusPx: Float
    ): Bitmap? {
      snapshot.backgroundImageUrl?.let { uriString ->
        val normalizedPath = if (uriString.startsWith("file://")) {
          Uri.parse(uriString).path
        } else {
          uriString
        }

        if (!normalizedPath.isNullOrBlank()) {
          val bitmap = BitmapFactory.decodeFile(normalizedPath)
          if (bitmap != null) {
            return createRoundedBitmap(bitmap, targetWidthPx, targetHeightPx, cornerRadiusPx)
          }
        }
      }

      snapshot.backgroundImageBase64?.let { base64 ->
        return runCatching {
          val bytes = Base64.decode(base64, Base64.DEFAULT)
          BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.let { bitmap ->
            createRoundedBitmap(bitmap, targetWidthPx, targetHeightPx, cornerRadiusPx)
          }
        }.getOrNull()
      }

      return null
    }

    private fun createRoundedBitmap(
      bitmap: Bitmap,
      targetWidthPx: Int,
      targetHeightPx: Int,
      cornerRadiusPx: Float
    ): Bitmap {
      val output = Bitmap.createBitmap(targetWidthPx, targetHeightPx, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(output)
      val shader = BitmapShader(bitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
      val scale = max(
        targetWidthPx / bitmap.width.toFloat(),
        targetHeightPx / bitmap.height.toFloat()
      )
      val scaledWidth = bitmap.width * scale
      val scaledHeight = bitmap.height * scale
      val dx = (targetWidthPx - scaledWidth) / 2f
      val dy = (targetHeightPx - scaledHeight) / 2f
      shader.setLocalMatrix(android.graphics.Matrix().apply {
        setScale(scale, scale)
        postTranslate(dx, dy)
      })

      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        isFilterBitmap = true
        this.shader = shader
      }
      val rect = RectF(0f, 0f, targetWidthPx.toFloat(), targetHeightPx.toFloat())
      canvas.drawRoundRect(rect, cornerRadiusPx, cornerRadiusPx, paint)
      return output
    }

    private fun createRoundedGradientBitmap(
      widthPx: Int,
      heightPx: Int,
      cornerRadiusPx: Float,
      startColor: Int,
      endColor: Int
    ): Bitmap {
      val output = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(output)
      val shader = LinearGradient(
        0f,
        0f,
        widthPx.toFloat(),
        heightPx.toFloat(),
        startColor,
        endColor,
        Shader.TileMode.CLAMP
      )
      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.shader = shader
      }
      val rect = RectF(0f, 0f, widthPx.toFloat(), heightPx.toFloat())
      canvas.drawRoundRect(rect, cornerRadiusPx, cornerRadiusPx, paint)
      return output
    }

    private fun createCircularBitmap(bitmap: Bitmap, targetSizePx: Int): Bitmap {
      val output = Bitmap.createBitmap(targetSizePx, targetSizePx, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(output)
      val shader = BitmapShader(bitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
      val scale = max(
        targetSizePx / bitmap.width.toFloat(),
        targetSizePx / bitmap.height.toFloat()
      )
      val scaledWidth = bitmap.width * scale
      val scaledHeight = bitmap.height * scale
      val dx = (targetSizePx - scaledWidth) / 2f
      val dy = (targetSizePx - scaledHeight) / 2f
      shader.setLocalMatrix(android.graphics.Matrix().apply {
        setScale(scale, scale)
        postTranslate(dx, dy)
      })

      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        isFilterBitmap = true
        this.shader = shader
      }
      canvas.drawCircle(
        targetSizePx / 2f,
        targetSizePx / 2f,
        targetSizePx / 2f,
        paint
      )
      return output
    }

    private fun renderDoodleBitmap(
      context: Context,
      doodleStrokesJson: String?,
      widthPx: Int,
      heightPx: Int,
      overlayOpacity: Float,
      renderSpec: WidgetOverlayRenderSpec
    ): Bitmap? {
      if (doodleStrokesJson.isNullOrBlank() || widthPx <= 0 || heightPx <= 0) {
        return null
      }

      val parsed = runCatching { JSONArray(doodleStrokesJson) }.getOrNull() ?: return null
      val bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      val paddingX = context.dpToPx(renderSpec.doodleInsetDp).toFloat()
      val paddingY = context.dpToPx(renderSpec.doodleInsetDp).toFloat()
      val drawWidth = max(1f, widthPx.toFloat() - (paddingX * 2f))
      val drawHeight = max(1f, heightPx.toFloat() - (paddingY * 2f))
      val strokeWidth = max(context.dpToPx(4f).toFloat(), min(drawWidth, drawHeight) * 0.013f)

      for (index in 0 until parsed.length()) {
        val item = parsed.optJSONObject(index) ?: continue
        val points = item.optJSONArray("points") ?: continue
        if (points.length() < 2) {
          continue
        }

        val color = parseColor(item.optString("color", "#1C1C1E"), overlayOpacity)
        val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          style = Paint.Style.STROKE
          strokeCap = Paint.Cap.ROUND
          strokeJoin = Paint.Join.ROUND
          this.strokeWidth = strokeWidth
          this.color = color
        }
        val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          style = Paint.Style.FILL
          this.color = parseColor(item.optString("color", "#1C1C1E"), overlayOpacity)
        }
        var pointIndex = 0
        val resolvedPoints = mutableListOf<PointF>()

        while (pointIndex + 1 < points.length()) {
          val x = paddingX + (points.optDouble(pointIndex).coerceIn(0.0, 1.0).toFloat() * drawWidth)
          val y = paddingY + (points.optDouble(pointIndex + 1).coerceIn(0.0, 1.0).toFloat() * drawHeight)
          resolvedPoints.add(PointF(x, y))
          pointIndex += 2
        }

        if (resolvedPoints.isEmpty()) {
          continue
        }

        if (resolvedPoints.size == 1) {
          val point = resolvedPoints.first()
          canvas.drawCircle(point.x, point.y, strokeWidth / 2f, dotPaint)
          continue
        }

        val path = Path().apply {
          moveTo(resolvedPoints[0].x, resolvedPoints[0].y)
        }

        if (resolvedPoints.size == 2) {
          path.lineTo(resolvedPoints[1].x, resolvedPoints[1].y)
          canvas.drawPath(path, strokePaint)
          continue
        }

        if (resolvedPoints.size > 3) {
          for (resolvedIndex in 1 until resolvedPoints.size - 2) {
            val current = resolvedPoints[resolvedIndex]
            val next = resolvedPoints[resolvedIndex + 1]
            path.quadTo(
              current.x,
              current.y,
              (current.x + next.x) / 2f,
              (current.y + next.y) / 2f
            )
          }
        }

        val penultimate = resolvedPoints[resolvedPoints.size - 2]
        val last = resolvedPoints.last()
        path.quadTo(penultimate.x, penultimate.y, last.x, last.y)
        canvas.drawPath(path, strokePaint)
      }

      return bitmap
    }

    private fun renderStickerBitmap(
      context: Context,
      stickerPlacementsJson: String?,
      widthPx: Int,
      heightPx: Int,
      overlayOpacity: Float,
      renderSpec: WidgetOverlayRenderSpec
    ): Bitmap? {
      if (stickerPlacementsJson.isNullOrBlank() || widthPx <= 0 || heightPx <= 0) {
        return null
      }

      val parsed = runCatching { JSONArray(stickerPlacementsJson) }.getOrNull() ?: return null
      val bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      val padding = context.dpToPx(renderSpec.stickerInsetDp).toFloat()
      val drawWidth = max(1f, widthPx.toFloat() - (padding * 2f))
      val drawHeight = max(1f, heightPx.toFloat() - (padding * 2f))
      val baseSize = max(
        context.dpToPx(renderSpec.stickerMinimumBaseSizeDp).toFloat(),
        min(drawWidth, drawHeight) * renderSpec.stickerBaseSizeRatio
      )

      val placements = (0 until parsed.length())
        .mapNotNull { index -> parsed.optJSONObject(index) }
        .sortedBy { item -> item.optInt("zIndex", 0) }

      var renderedStickerCount = 0

      for (item in placements) {
        val asset = item.optJSONObject("asset") ?: continue
        val stickerBitmap = resolveStickerAssetBitmap(asset) ?: continue
        val assetWidth = asset.optDouble("width", stickerBitmap.width.toDouble()).toFloat().coerceAtLeast(1f)
        val assetHeight = asset.optDouble("height", stickerBitmap.height.toDouble()).toFloat().coerceAtLeast(1f)
        val scale = item.optDouble("scale", 1.0).toFloat().coerceIn(0.35f, 3f)
        val rotation = item.optDouble("rotation", 0.0).toFloat()
        val opacity = item.optDouble("opacity", 1.0).toFloat().coerceIn(0f, 1f)
        val renderMode = if (item.optString("renderMode", "") == "stamp") "stamp" else "default"
        val outlineEnabled = item.optBoolean("outlineEnabled", true)
        val centerX = padding + (item.optDouble("x", 0.5).toFloat().coerceIn(0f, 1f) * drawWidth)
        val centerY = padding + (item.optDouble("y", 0.5).toFloat().coerceIn(0f, 1f) * drawHeight)
        val longestEdge = max(assetWidth, assetHeight)
        val baseScale = baseSize / longestEdge
        val stickerWidth = assetWidth * baseScale * scale
        val stickerHeight = assetHeight * baseScale * scale
        val outlineSize = getStickerOutlineSize(stickerWidth, stickerHeight)
        val isStamp = renderMode == "stamp"
        val destinationRect = RectF(
          -stickerWidth / 2f,
          -stickerHeight / 2f,
          stickerWidth / 2f,
          stickerHeight / 2f
        )
        val outlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          isFilterBitmap = true
          colorFilter = android.graphics.PorterDuffColorFilter(
            parseColor(STICKER_OUTLINE_COLOR, STICKER_OUTLINE_OPACITY * opacity * overlayOpacity),
            android.graphics.PorterDuff.Mode.SRC_IN
          )
        }
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
          isFilterBitmap = true
          alpha = (opacity * (if (isStamp) 1f else overlayOpacity) * 255f).toInt().coerceIn(0, 255)
        }

        canvas.save()
        canvas.translate(centerX, centerY)
        canvas.rotate(rotation)
        if (!isStamp && outlineEnabled) {
          for (offset in STICKER_OUTLINE_OFFSETS) {
            canvas.save()
            canvas.translate(offset.x * outlineSize, offset.y * outlineSize)
            canvas.drawBitmap(stickerBitmap, null, destinationRect, outlinePaint)
            canvas.restore()
          }
        }

        if (isStamp) {
          val renderedStampBitmap = renderWidgetStampBitmap(
            stickerBitmap,
            max(1, kotlin.math.round(stickerWidth).toInt()),
            max(1, kotlin.math.round(stickerHeight).toInt()),
            opacity * overlayOpacity
          )
          canvas.drawBitmap(renderedStampBitmap, null, destinationRect, null)
        } else {
          canvas.drawBitmap(stickerBitmap, null, destinationRect, paint)
        }
        canvas.restore()
        renderedStickerCount += 1
      }

      return bitmap.takeIf { renderedStickerCount > 0 }
    }

    private fun resolveStickerAssetBitmap(asset: JSONObject): Bitmap? {
      val localUri = asset.optString("localUri", "").takeIf { it.isNotBlank() }
      if (!localUri.isNullOrBlank()) {
        val normalizedPath = if (localUri.startsWith("file://")) {
          Uri.parse(localUri).path
        } else {
          localUri
        }

        if (!normalizedPath.isNullOrBlank()) {
          BitmapFactory.decodeFile(normalizedPath)?.let { return it }
        }
      }

      val base64 = asset.optString("base64", "").takeIf { it.isNotBlank() }
      if (!base64.isNullOrBlank()) {
        return runCatching {
          val bytes = Base64.decode(base64, Base64.DEFAULT)
          BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        }.getOrNull()
      }

      return null
    }

    private fun parseColor(value: String, opacity: Float): Int {
      val alpha = (opacity.coerceIn(0f, 1f) * 255f).toInt().coerceIn(0, 255)
      return try {
        val base = Color.parseColor(value)
        Color.argb(alpha, Color.red(base), Color.green(base), Color.blue(base))
      } catch (_: IllegalArgumentException) {
        Color.argb(alpha, 28, 28, 30)
      }
    }

    private fun getWidgetOverlayOpacity(snapshot: NotoWidgetSnapshot): Float {
      return if (snapshot.noteType == "photo") {
        PHOTO_NOTE_OVERLAY_OPACITY
      } else {
        TEXT_NOTE_OVERLAY_OPACITY
      }
    }

    private fun getStickerOverlayOpacity(snapshot: NotoWidgetSnapshot): Float {
      return if (snapshot.noteType == "photo") {
        PHOTO_NOTE_STICKER_OVERLAY_OPACITY
      } else {
        TEXT_NOTE_OVERLAY_OPACITY
      }
    }

    private fun getStickerOutlineSize(width: Float, height: Float): Float {
      return max(3f, min(8f, min(width, height) * 0.045f))
    }

    private fun getWidgetOverlayRenderSpec(isMedium: Boolean): WidgetOverlayRenderSpec {
      return if (isMedium) {
        WidgetOverlayRenderSpec(
          doodleInsetDp = 18f,
          stickerInsetDp = 18f,
          stickerMinimumBaseSizeDp = 68f,
          stickerBaseSizeRatio = 0.30f
        )
      } else {
        WidgetOverlayRenderSpec(
          doodleInsetDp = 0f,
          stickerInsetDp = 0f,
          stickerMinimumBaseSizeDp = 48f,
          stickerBaseSizeRatio = 0.24f
        )
      }
    }

    private fun resolveContentWidthPx(context: Context, options: Bundle, isMedium: Boolean): Int {
      return resolveContentRenderSizePx(context, options, isMedium).widthPx
    }

    private fun resolveContentHeightPx(context: Context, options: Bundle, isMedium: Boolean): Int {
      return resolveContentRenderSizePx(context, options, isMedium).heightPx
    }

    private fun resolveContentRenderSizePx(context: Context, options: Bundle, isMedium: Boolean): WidgetRenderSize {
      val exactSizeDp = resolveExactWidgetSizeDp(options, isMedium)
      val minWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, if (isMedium) 250 else 160)
      val minHeightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, if (isMedium) 140 else 160)
      val requestedWidthDp = exactSizeDp?.width ?: max(minWidthDp.toFloat(), if (isMedium) 250f else 160f)
      val requestedHeightDp = exactSizeDp?.height ?: max(minHeightDp.toFloat(), if (isMedium) 140f else 160f)
      val totalInsetDp = (getWidgetOuterPaddingDp(isMedium) + getWidgetCardShellPaddingDp(isMedium)) * 2f
      val requestedWidthPx = context.dpToPx(max(1f, requestedWidthDp - totalInsetDp))
      val requestedHeightPx = context.dpToPx(max(1f, requestedHeightDp - totalInsetDp))

      val maxEdgePx = if (isMedium) MEDIUM_WIDGET_MAX_RENDER_EDGE_PX else SMALL_WIDGET_MAX_RENDER_EDGE_PX
      val maxPixels = if (isMedium) MEDIUM_WIDGET_MAX_RENDER_PIXELS else SMALL_WIDGET_MAX_RENDER_PIXELS
      val currentMaxEdge = max(requestedWidthPx, requestedHeightPx).coerceAtLeast(1)
      val currentPixels = (requestedWidthPx.toLong() * requestedHeightPx.toLong()).coerceAtLeast(1L)
      val edgeScale = maxEdgePx / currentMaxEdge.toFloat()
      val areaScale = sqrt(maxPixels.toDouble() / currentPixels.toDouble()).toFloat()
      val scale = min(1f, min(edgeScale, areaScale))

      val widthPx = max(1, (requestedWidthPx * scale).toInt())
      val heightPx = max(1, (requestedHeightPx * scale).toInt())

      return WidgetRenderSize(widthPx = widthPx, heightPx = heightPx)
    }

    private fun resolveExactWidgetSizeDp(options: Bundle, isMedium: Boolean): SizeF? {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        return null
      }

      val sizes = options.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
        ?.filter { it.width > 0f && it.height > 0f }
        .orEmpty()

      if (sizes.isEmpty()) {
        return null
      }

      val targetAspectRatio = if (isMedium) 250f / 140f else 1f
      val targetArea = if (isMedium) 250f * 140f else 160f * 160f

      return sizes.minWithOrNull(
        compareBy<SizeF> { size ->
          kotlin.math.abs((size.width / size.height) - targetAspectRatio)
        }.thenBy { size ->
          kotlin.math.abs((size.width * size.height) - targetArea)
        }
      )
    }

    private fun isMediumWidget(options: Bundle): Boolean {
      val minWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 160)
      return minWidthDp >= 180
    }

    private fun createWidgetPendingIntent(
      context: Context,
      requestCode: Int,
      urlString: String?
    ): PendingIntent {
      val normalizedUrl = urlString?.trim().takeUnless { it.isNullOrBlank() }
      val launchIntent = if (normalizedUrl != null) {
        Intent(Intent.ACTION_VIEW, Uri.parse(normalizedUrl)).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
          setPackage(context.packageName)
        }
      } else {
        context.packageManager.getLaunchIntentForPackage(context.packageName)
          ?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
          }
          ?: Intent(Intent.ACTION_VIEW, Uri.parse("noto:///"))
      }

      return PendingIntent.getActivity(
        context,
        requestCode,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    private fun Context.dpToPx(value: Float): Int {
      return TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP,
        value,
        resources.displayMetrics
      ).toInt()
    }
  }
}
