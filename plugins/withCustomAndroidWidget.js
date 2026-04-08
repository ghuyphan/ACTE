const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PROVIDER_SOURCE_PATH = path.join('widgets', 'android', 'NotoWidgetProvider.kt');
const PROVIDER_TARGET_PATH = 'app/src/main/java/com/acte/app/widget/NotoWidgetProvider.kt';

const RESOURCE_MAPPINGS = [
  ['widgets/android/layout/noto_widget_small.xml', 'app/src/main/res/layout/noto_widget_small.xml'],
  ['widgets/android/layout/noto_widget_medium.xml', 'app/src/main/res/layout/noto_widget_medium.xml'],
  ['widgets/android/drawable/noto_widget_outer_surface.xml', 'app/src/main/res/drawable/noto_widget_outer_surface.xml'],
  ['widgets/android/drawable/noto_widget_card_shell.xml', 'app/src/main/res/drawable/noto_widget_card_shell.xml'],
  ['widgets/android/drawable/noto_widget_card_inner_paper.xml', 'app/src/main/res/drawable/noto_widget_card_inner_paper.xml'],
  ['widgets/android/drawable/noto_widget_photo_scrim.xml', 'app/src/main/res/drawable/noto_widget_photo_scrim.xml'],
];

const OVERLAY_CHIP_DARK_PATH = 'app/src/main/res/drawable/noto_widget_overlay_chip_dark.xml';
const COUNT_BADGE_DARK_PATH = 'app/src/main/res/drawable/noto_widget_count_badge_dark.xml';

const OVERLAY_CHIP_DARK_CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#61000000" />
    <corners android:radius="999dp" />
</shape>
`;

const COUNT_BADGE_DARK_CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#F2FFF8F0" />
    <corners android:radius="999dp" />
</shape>
`;

function copyFileIfPresent(projectRoot, androidRoot, sourceRelativePath, targetRelativePath) {
  const sourcePath = path.join(projectRoot, sourceRelativePath);
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  const targetPath = path.join(androidRoot, targetRelativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function ensureFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (!fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8') !== content) {
    fs.writeFileSync(filePath, content);
  }
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

      ensureFile(path.join(androidRoot, OVERLAY_CHIP_DARK_PATH), OVERLAY_CHIP_DARK_CONTENT);
      ensureFile(path.join(androidRoot, COUNT_BADGE_DARK_PATH), COUNT_BADGE_DARK_CONTENT);

      return config;
    },
  ]);

module.exports = withCustomAndroidWidget;
