const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WIDGET_LAYOUT_RELATIVE_PATHS = [
  'app/src/main/res/layout/noto_widget_small.xml',
  'app/src/main/res/layout/noto_widget_medium.xml',
];

function patchWidgetLayoutTypography(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const patched = original
    .replaceAll('android:fontFamily="sans-serif-medium"', 'android:fontFamily="@font/xml_noto_sans"')
    .replaceAll('android:fontFamily="serif"', 'android:fontFamily="@font/xml_noto_sans"');

  if (patched !== original) {
    fs.writeFileSync(filePath, patched);
  }
}

const withAndroidWidgetTypography = (config) =>
  withFinalizedMod(config, [
    'android',
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;

      for (const relativePath of WIDGET_LAYOUT_RELATIVE_PATHS) {
        patchWidgetLayoutTypography(path.join(androidRoot, relativePath));
      }

      return config;
    },
  ]);

module.exports = withAndroidWidgetTypography;
