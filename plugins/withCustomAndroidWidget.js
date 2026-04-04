const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SMALL_LAYOUT_PATH = 'app/src/main/res/layout/noto_widget_small.xml';
const MEDIUM_LAYOUT_PATH = 'app/src/main/res/layout/noto_widget_medium.xml';
const PROVIDER_PATH = 'app/src/main/java/com/acte/app/widget/NotoWidgetProvider.kt';
const TEXT_BACKGROUND_PATH = 'app/src/main/res/drawable/noto_widget_text_background.xml';
const PHOTO_BACKGROUND_PATH = 'app/src/main/res/drawable/noto_widget_photo_background.xml';
const PHOTO_SCRIM_PATH = 'app/src/main/res/drawable/noto_widget_photo_scrim.xml';
const OVERLAY_CHIP_DARK_PATH = 'app/src/main/res/drawable/noto_widget_overlay_chip_dark.xml';
const COUNT_BADGE_DARK_PATH = 'app/src/main/res/drawable/noto_widget_count_badge_dark.xml';

const OVERLAY_CHIP_DARK_CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#4D000000" />
    <corners android:radius="999dp" />
</shape>
`;

const COUNT_BADGE_DARK_CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#2EFFFFFF" />
    <corners android:radius="999dp" />
</shape>
`;

function patchFile(filePath, transform) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const patched = transform(original);

  if (patched !== original) {
    fs.writeFileSync(filePath, patched);
  }
}

function ensureFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (!fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8') !== content) {
    fs.writeFileSync(filePath, content);
  }
}

function removeLivePhotoTextView(layout) {
  return layout.replace(
    /\n\s*<TextView\s+android:id="@\+id\/widget_live_photo_text"[\s\S]*?\/>\n/g,
    '\n'
  );
}

function patchSmallLayout(layout) {
  return removeLivePhotoTextView(layout).replace(
    'android:background="@drawable/noto_widget_badge_dark"',
    'android:background="@drawable/noto_widget_overlay_chip_dark"'
  );
}

function patchMediumLayout(layout) {
  let patched = removeLivePhotoTextView(layout).replace(
    'android:background="@drawable/noto_widget_badge_dark"',
    'android:background="@drawable/noto_widget_overlay_chip_dark"'
  );

  patched = patched
    .replace('android:paddingLeft="24dp"', 'android:paddingLeft="20dp"')
    .replace('android:paddingTop="22dp"', 'android:paddingTop="18dp"')
    .replace('android:paddingRight="24dp"', 'android:paddingRight="20dp"')
    .replace('android:paddingBottom="22dp"', 'android:paddingBottom="18dp"')
    .replace(
      `            <TextView
                android:id="@+id/widget_location"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:ellipsize="end"
                android:fontFamily="@font/xml_noto_sans"
                android:includeFontPadding="false"
                android:maxLines="1"
                android:paddingBottom="12dp"
                android:textColor="#6E5E4F"
                android:textSize="12sp"
                android:visibility="gone" />`,
      `            <TextView
                android:id="@+id/widget_location"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:ellipsize="end"
                android:fontFamily="@font/xml_noto_sans"
                android:includeFontPadding="false"
                android:maxLines="1"
                android:paddingBottom="10dp"
                android:textColor="#6E5E4F"
                android:textSize="11sp"
                android:visibility="gone" />`
    )
    .replace('android:textSize="22sp"', 'android:textSize="21sp"')
    .replace(
      `            <TextView
                android:id="@+id/widget_badge"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:background="@drawable/noto_widget_badge_light"
                android:ellipsize="end"
                android:fontFamily="@font/xml_noto_sans"
                android:includeFontPadding="false"
                android:maxLines="1"
                android:paddingLeft="12dp"
                android:paddingTop="6dp"
                android:paddingRight="12dp"
                android:paddingBottom="6dp"
                android:textColor="#6E5E4F"
                android:textSize="11sp"
                android:visibility="gone" />`,
      `            <TextView
                android:id="@+id/widget_badge"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:background="@drawable/noto_widget_badge_light"
                android:ellipsize="end"
                android:fontFamily="@font/xml_noto_sans"
                android:includeFontPadding="false"
                android:maxLines="1"
                android:paddingLeft="10dp"
                android:paddingTop="5dp"
                android:paddingRight="10dp"
                android:paddingBottom="5dp"
                android:textColor="#6E5E4F"
                android:textSize="10sp"
                android:visibility="gone" />`
    );

  return patched;
}

function removeRoundedCorners(drawable) {
  return drawable.replace(/\s*<corners android:radius="28dp" \/>\n/g, '');
}

function patchProvider(provider) {
  let patched = provider
    .replace('bindLivePhotoBadge(views, snapshot, showLivePhotoBadge)', 'bindLivePhotoBadge(views, showLivePhotoBadge)')
    .replaceAll('cornerRadiusPx = context.dpToPx(28f).toFloat()', 'cornerRadiusPx = 0f')
    .replace(
      'if (onDarkSurface) R.drawable.noto_widget_badge_dark else R.drawable.noto_widget_badge_light',
      'if (onDarkSurface) R.drawable.noto_widget_overlay_chip_dark else R.drawable.noto_widget_badge_light'
    )
    .replace(
      `        views.setInt(
          locationOverlayViewId,
          "setBackgroundResource",
          if (usesTextSurface) R.drawable.noto_widget_badge_light else R.drawable.noto_widget_badge_dark
        )`,
      `        views.setInt(
          locationOverlayViewId,
          "setBackgroundResource",
          if (usesTextSurface) R.drawable.noto_widget_badge_light else R.drawable.noto_widget_overlay_chip_dark
        )`
    )
    .replace(
      `        views.setInt(
          R.id.widget_badge,
          "setBackgroundResource",
          if (usesTextSurface) R.drawable.noto_widget_badge_light else R.drawable.noto_widget_badge_dark
        )`,
      `        views.setInt(
          R.id.widget_badge,
          "setBackgroundResource",
          if (usesTextSurface) R.drawable.noto_widget_badge_light else R.drawable.noto_widget_count_badge_dark
        )`
    )
    .replace(
      `    private fun bindLivePhotoBadge(
      views: RemoteViews,
      snapshot: NotoWidgetSnapshot,
      shouldShowBadge: Boolean
    ) {
      if (!shouldShowBadge) {
        views.setViewVisibility(R.id.widget_live_photo_badge, View.GONE)
        return
      }

      views.setViewVisibility(R.id.widget_live_photo_badge, View.VISIBLE)
      views.setInt(R.id.widget_live_photo_badge, "setBackgroundResource", R.drawable.noto_widget_badge_dark)
      views.setImageViewResource(R.id.widget_live_photo_icon, R.drawable.noto_widget_live_photo_icon)
      views.setTextViewText(
        R.id.widget_live_photo_text,
        snapshot.livePhotoBadgeText.ifBlank { "Live" }
      )
      views.setTextColor(R.id.widget_live_photo_text, Color.parseColor("#FFF8F0"))
    }`,
      `    private fun bindLivePhotoBadge(views: RemoteViews, shouldShowBadge: Boolean) {
      if (!shouldShowBadge) {
        views.setViewVisibility(R.id.widget_live_photo_badge, View.GONE)
        return
      }

      views.setViewVisibility(R.id.widget_live_photo_badge, View.VISIBLE)
      views.setInt(R.id.widget_live_photo_badge, "setBackgroundResource", R.drawable.noto_widget_overlay_chip_dark)
      views.setImageViewResource(R.id.widget_live_photo_icon, R.drawable.noto_widget_live_photo_icon)
    }`
    )
    .replace(
      `    private fun resolveContentRenderSizePx(context: Context, options: Bundle, isMedium: Boolean): WidgetRenderSize {
      val minWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, if (isMedium) 250 else 160)
      val maxWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, minWidthDp)
      val minHeightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, if (isMedium) 140 else 160)
      val maxHeightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, minHeightDp)
      val requestedWidthPx = context.dpToPx(
        max(max(minWidthDp.toFloat(), maxWidthDp.toFloat()), if (isMedium) 250f else 160f)
      )
      val requestedHeightPx = context.dpToPx(
        max(max(minHeightDp.toFloat(), maxHeightDp.toFloat()), if (isMedium) 140f else 160f)
      )

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
    }`,
      `    private fun resolveContentRenderSizePx(context: Context, options: Bundle, isMedium: Boolean): WidgetRenderSize {
      val exactSizeDp = resolveExactWidgetSizeDp(options, isMedium)
      val minWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, if (isMedium) 250 else 160)
      val minHeightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, if (isMedium) 140 else 160)
      val requestedWidthPx = context.dpToPx(
        exactSizeDp?.width ?: max(minWidthDp.toFloat(), if (isMedium) 250f else 160f)
      )
      val requestedHeightPx = context.dpToPx(
        exactSizeDp?.height ?: max(minHeightDp.toFloat(), if (isMedium) 140f else 160f)
      )

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
    }`
    );

  if (!patched.includes('import android.os.Build')) {
    patched = patched.replace('import android.os.Bundle', 'import android.os.Build\nimport android.os.Bundle');
  }

  if (!patched.includes('import android.util.SizeF')) {
    patched = patched.replace('import android.util.Base64', 'import android.util.SizeF\nimport android.util.Base64');
  }

  return patched;
}

const withCustomAndroidWidget = (config) =>
  withFinalizedMod(config, [
    'android',
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;

      patchFile(path.join(androidRoot, SMALL_LAYOUT_PATH), patchSmallLayout);
      patchFile(path.join(androidRoot, MEDIUM_LAYOUT_PATH), patchMediumLayout);
      patchFile(path.join(androidRoot, PROVIDER_PATH), patchProvider);
      patchFile(path.join(androidRoot, TEXT_BACKGROUND_PATH), removeRoundedCorners);
      patchFile(path.join(androidRoot, PHOTO_BACKGROUND_PATH), removeRoundedCorners);
      patchFile(path.join(androidRoot, PHOTO_SCRIM_PATH), removeRoundedCorners);

      ensureFile(path.join(androidRoot, OVERLAY_CHIP_DARK_PATH), OVERLAY_CHIP_DARK_CONTENT);
      ensureFile(path.join(androidRoot, COUNT_BADGE_DARK_PATH), COUNT_BADGE_DARK_CONTENT);

      return config;
    },
  ]);

module.exports = withCustomAndroidWidget;
