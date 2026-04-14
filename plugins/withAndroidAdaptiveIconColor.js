const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function ensureColorResource(contents, colorName, colorValue) {
  const colorPattern = new RegExp(`<color\\s+name="${colorName}">[^<]*<\\/color>`);

  if (colorPattern.test(contents)) {
    return contents.replace(colorPattern, `<color name="${colorName}">${colorValue}</color>`);
  }

  return contents.replace(
    /<\/resources>\s*$/,
    `  <color name="${colorName}">${colorValue}</color>\n</resources>\n`
  );
}

const withAndroidAdaptiveIconColor = (config) =>
  withFinalizedMod(config, [
    'android',
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;
      const colorsPath = path.join(androidRoot, 'app', 'src', 'main', 'res', 'values', 'colors.xml');
      const iconBackgroundColor = config.android?.adaptiveIcon?.backgroundColor ?? '#F7F2EB';

      if (!fs.existsSync(colorsPath)) {
        return config;
      }

      const currentColors = fs.readFileSync(colorsPath, 'utf8');
      const nextColors = ensureColorResource(currentColors, 'iconBackground', iconBackgroundColor);

      if (nextColors !== currentColors) {
        fs.writeFileSync(colorsPath, nextColors);
      }

      return config;
    },
  ]);

module.exports = withAndroidAdaptiveIconColor;
