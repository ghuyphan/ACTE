package com.acte.app.widget

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

data class NotoWidgetSnapshot(
  val noteType: String,
  val text: String,
  val noteColorId: String?,
  val locationName: String,
  val date: String,
  val noteCount: Int,
  val nearbyPlacesCount: Int,
  val isLivePhoto: Boolean,
  val backgroundImageUrl: String?,
  val backgroundImageBase64: String?,
  val backgroundGradientStartColor: String?,
  val backgroundGradientEndColor: String?,
  val hasDoodle: Boolean,
  val doodleStrokesJson: String?,
  val hasStickers: Boolean,
  val stickerPlacementsJson: String?,
  val isIdleState: Boolean,
  val idleText: String,
  val savedCountText: String,
  val nearbyPlacesLabelText: String,
  val memoryReminderText: String,
  val accessorySaveMemoryText: String,
  val accessoryAddFirstPlaceText: String,
  val accessoryMemoryNearbyText: String,
  val accessoryOpenAppText: String,
  val accessoryAddLabelText: String,
  val accessorySavedLabelText: String,
  val accessoryNearLabelText: String,
  val livePhotoBadgeText: String,
  val isSharedContent: Boolean,
  val authorDisplayName: String,
  val authorInitials: String,
  val authorAvatarImageUrl: String?,
  val authorAvatarImageBase64: String?,
  val primaryActionUrl: String,
  val badgeActionUrl: String?
)

object NotoWidgetStorage {
  private const val PREFS_NAME = "noto_widget_storage"
  private const val SNAPSHOT_KEY = "latest_snapshot"

  fun saveSnapshot(context: Context, snapshotJson: String): Boolean {
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(SNAPSHOT_KEY, snapshotJson)
      .commit()
  }

  fun loadSnapshotJson(context: Context): String? {
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(SNAPSHOT_KEY, null)
  }
}

class NotoWidgetModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "NotoWidgetModule"

  @ReactMethod
  fun updateSnapshot(snapshotJson: String) {
    if (NotoWidgetStorage.saveSnapshot(reactApplicationContext, snapshotJson)) {
      NotoWidgetProvider.updateAllWidgets(reactApplicationContext)
    }
  }
}
