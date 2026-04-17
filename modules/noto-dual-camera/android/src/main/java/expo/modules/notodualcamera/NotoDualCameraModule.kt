package expo.modules.notodualcamera

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val MODULE_NAME = "NotoDualCamera"

class NotoDualCameraModule : Module() {
  override fun definition() = ModuleDefinition {
    Name(MODULE_NAME)

    AsyncFunction("getAvailabilityAsync") { ->
      mapOf(
        "available" to false,
        "supported" to false,
        "reason" to "sequential-capture-on-android"
      )
    }
  }
}
