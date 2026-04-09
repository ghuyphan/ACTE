const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PROVIDER_SOURCE_PATH = path.join('widgets', 'android', 'NotoWidgetProvider.kt');
const PROVIDER_TARGET_PATH = 'app/src/main/java/com/acte/app/widget/NotoWidgetProvider.kt';

const RESOURCE_MAPPINGS = [
  ['widgets/android/layout/noto_widget_small.xml', 'app/src/main/res/layout/noto_widget_small.xml'],
  ['widgets/android/layout/noto_widget_medium.xml', 'app/src/main/res/layout/noto_widget_medium.xml'],
  ['widgets/android/drawable/noto_widget_outer_surface.xml', 'app/src/main/res/drawable/noto_widget_outer_surface.xml'],
  ['widgets/android/drawable/noto_widget_card_shell_small.xml', 'app/src/main/res/drawable/noto_widget_card_shell_small.xml'],
  ['widgets/android/drawable/noto_widget_card_shell_medium.xml', 'app/src/main/res/drawable/noto_widget_card_shell_medium.xml'],
  ['widgets/android/drawable/noto_widget_card_inner_paper_small.xml', 'app/src/main/res/drawable/noto_widget_card_inner_paper_small.xml'],
  ['widgets/android/drawable/noto_widget_card_inner_paper_medium.xml', 'app/src/main/res/drawable/noto_widget_card_inner_paper_medium.xml'],
  ['widgets/android/drawable/noto_widget_photo_scrim_small.xml', 'app/src/main/res/drawable/noto_widget_photo_scrim_small.xml'],
  ['widgets/android/drawable/noto_widget_photo_scrim_medium.xml', 'app/src/main/res/drawable/noto_widget_photo_scrim_medium.xml'],
  ['widgets/android/drawable/noto_widget_badge_light.xml', 'app/src/main/res/drawable/noto_widget_badge_light.xml'],
  ['widgets/android/drawable/noto_widget_overlay_chip_dark.xml', 'app/src/main/res/drawable/noto_widget_overlay_chip_dark.xml'],
  ['widgets/android/drawable/noto_widget_count_badge_dark.xml', 'app/src/main/res/drawable/noto_widget_count_badge_dark.xml'],
  ['widgets/android/drawable/noto_widget_pin_icon.xml', 'app/src/main/res/drawable/noto_widget_pin_icon.xml'],
];

function copyFileIfPresent(projectRoot, androidRoot, sourceRelativePath, targetRelativePath) {
  const sourcePath = path.join(projectRoot, sourceRelativePath);
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  const targetPath = path.join(androidRoot, targetRelativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

const withCustomAndroidWidget = (config) =>
  withFinalizedMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidRoot = config.modRequest.platformProjectRoot;

      copyFileIfPresent(projectRoot, androidRoot, PROVIDER_SOURCE_PATH, PROVIDER_TARGET_PATH);

      for (const [sourceRelativePath, targetRelativePath] of RESOURCE_MAPPINGS) {
        copyFileIfPresent(projectRoot, androidRoot, sourceRelativePath, targetRelativePath);
      }

      return config;
    },
  ]);

module.exports = withCustomAndroidWidget;
