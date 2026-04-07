const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withAndroidStyles,
} = require('@expo/config-plugins');

const { getMainActivityOrThrow } = AndroidConfig.Manifest;
const { getAppThemeGroup, removeStylesItem } = AndroidConfig.Styles;

function withAndroidActivityOrientation(config) {
  return withAndroidManifest(config, (config) => {
    const mainActivity = getMainActivityOrThrow(config.modResults);

    // Keep the shared Expo orientation lock for iOS, but let Android rotate on large screens.
    delete mainActivity.$['android:screenOrientation'];

    return config;
  });
}

function withAndroidEdgeToEdgeTheme(config) {
  return withAndroidStyles(config, (config) => {
    const parent = getAppThemeGroup();

    // Android 15+ treats direct system bar colors as deprecated under edge-to-edge.
    config.modResults = removeStylesItem({
      xml: config.modResults,
      parent,
      name: 'android:statusBarColor',
    });
    config.modResults = removeStylesItem({
      xml: config.modResults,
      parent,
      name: 'android:navigationBarColor',
    });

    return config;
  });
}

function withAndroidWindowBehavior(config) {
  config = withAndroidActivityOrientation(config);
  config = withAndroidEdgeToEdgeTheme(config);
  return config;
}

module.exports = createRunOncePlugin(
  withAndroidWindowBehavior,
  'withAndroidWindowBehavior',
  '1.0.0'
);
