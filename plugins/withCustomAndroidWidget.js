const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PROVIDER_SOURCE_PATH = path.join('widgets', 'android', 'NotoWidgetProvider.kt');
const PROVIDER_TARGET_PATH = 'app/src/main/java/com/acte/app/widget/NotoWidgetProvider.kt';
const MODULE_SOURCE_PATH = path.join('widgets', 'android', 'NotoWidgetModule.kt');
const MODULE_TARGET_PATH = 'app/src/main/java/com/acte/app/widget/NotoWidgetModule.kt';
const PACKAGE_SOURCE_PATH = path.join('widgets', 'android', 'NotoWidgetPackage.kt');
const PACKAGE_TARGET_PATH = 'app/src/main/java/com/acte/app/widget/NotoWidgetPackage.kt';
const MAIN_APPLICATION_PATH = 'app/src/main/java/com/acte/app/MainApplication.kt';
const ANDROID_MANIFEST_PATH = 'app/src/main/AndroidManifest.xml';

const RESOURCE_MAPPINGS = [
  ['widgets/android/xml/noto_widget_info.xml', 'app/src/main/res/xml/noto_widget_info.xml'],
  ['widgets/android/layout/noto_widget_small.xml', 'app/src/main/res/layout/noto_widget_small.xml'],
  ['widgets/android/layout/noto_widget_medium.xml', 'app/src/main/res/layout/noto_widget_medium.xml'],
  ['widgets/android/layout/noto_widget_large.xml', 'app/src/main/res/layout/noto_widget_large.xml'],
  ['widgets/android/drawable/noto_widget_outer_surface.xml', 'app/src/main/res/drawable/noto_widget_outer_surface.xml'],
  ['widgets/android/drawable/noto_widget_card_shell_small.xml', 'app/src/main/res/drawable/noto_widget_card_shell_small.xml'],
  ['widgets/android/drawable/noto_widget_card_shell_medium.xml', 'app/src/main/res/drawable/noto_widget_card_shell_medium.xml'],
  ['widgets/android/drawable/noto_widget_card_inner_paper_small.xml', 'app/src/main/res/drawable/noto_widget_card_inner_paper_small.xml'],
  ['widgets/android/drawable/noto_widget_card_inner_paper_medium.xml', 'app/src/main/res/drawable/noto_widget_card_inner_paper_medium.xml'],
  ['widgets/android/drawable/noto_widget_photo_scrim_small.xml', 'app/src/main/res/drawable/noto_widget_photo_scrim_small.xml'],
  ['widgets/android/drawable/noto_widget_photo_scrim_medium.xml', 'app/src/main/res/drawable/noto_widget_photo_scrim_medium.xml'],
  ['widgets/android/drawable/noto_widget_badge_light.xml', 'app/src/main/res/drawable/noto_widget_badge_light.xml'],
  ['widgets/android/drawable/noto_widget_badge_light_blue.xml', 'app/src/main/res/drawable/noto_widget_badge_light_blue.xml'],
  ['widgets/android/drawable/noto_widget_badge_light_cool.xml', 'app/src/main/res/drawable/noto_widget_badge_light_cool.xml'],
  ['widgets/android/drawable/noto_widget_badge_light_green.xml', 'app/src/main/res/drawable/noto_widget_badge_light_green.xml'],
  ['widgets/android/drawable/noto_widget_badge_light_lavender.xml', 'app/src/main/res/drawable/noto_widget_badge_light_lavender.xml'],
  ['widgets/android/drawable/noto_widget_badge_light_neutral.xml', 'app/src/main/res/drawable/noto_widget_badge_light_neutral.xml'],
  ['widgets/android/drawable/noto_widget_badge_light_pink.xml', 'app/src/main/res/drawable/noto_widget_badge_light_pink.xml'],
  ['widgets/android/drawable/noto_widget_badge_light_teal.xml', 'app/src/main/res/drawable/noto_widget_badge_light_teal.xml'],
  ['widgets/android/drawable/noto_widget_badge_light_warm.xml', 'app/src/main/res/drawable/noto_widget_badge_light_warm.xml'],
  ['widgets/android/drawable/noto_widget_overlay_chip_dark.xml', 'app/src/main/res/drawable/noto_widget_overlay_chip_dark.xml'],
  ['widgets/android/drawable/noto_widget_count_badge_dark.xml', 'app/src/main/res/drawable/noto_widget_count_badge_dark.xml'],
  ['widgets/android/drawable/noto_widget_pin_icon.xml', 'app/src/main/res/drawable/noto_widget_pin_icon.xml'],
  ['widgets/android/drawable/noto_widget_live_photo_icon.xml', 'app/src/main/res/drawable/noto_widget_live_photo_icon.xml'],
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

function patchMainApplication(androidRoot) {
  const mainApplicationPath = path.join(androidRoot, MAIN_APPLICATION_PATH);
  if (!fs.existsSync(mainApplicationPath)) {
    console.warn('[withCustomAndroidWidget] MainApplication.kt not found; Android widget module was not registered.');
    return;
  }

  const original = fs.readFileSync(mainApplicationPath, 'utf8');
  let patched = original;

  if (!patched.includes('import com.acte.app.widget.NotoWidgetPackage')) {
    patched = patched.replace(
      /(package\s+com\.acte\.app\s*\n)/,
      '$1import com.acte.app.widget.NotoWidgetPackage\n'
    );
  }

  if (!patched.includes('add(NotoWidgetPackage())')) {
    patched = patched.replace(
      /(PackageList\(this\)\.packages\.apply\s*\{\n)/,
      '$1          add(NotoWidgetPackage())\n'
    );
  }

  if (patched !== original) {
    fs.writeFileSync(mainApplicationPath, patched);
  }
}

function patchAndroidManifest(androidRoot) {
  const manifestPath = path.join(androidRoot, ANDROID_MANIFEST_PATH);
  if (!fs.existsSync(manifestPath)) {
    console.warn('[withCustomAndroidWidget] AndroidManifest.xml not found; Android widget receiver was not registered.');
    return;
  }

  const original = fs.readFileSync(manifestPath, 'utf8');
  if (original.includes('.widget.NotoWidgetProvider')) {
    return;
  }

  const receiver = `
    <receiver android:name=".widget.NotoWidgetProvider" android:exported="false">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/noto_widget_info"/>
    </receiver>`;
  const patched = original.replace(/(\s*<\/application>)/, `${receiver}$1`);

  if (patched !== original) {
    fs.writeFileSync(manifestPath, patched);
  }
}

function ensureWidgetStringResources(androidRoot) {
  const stringsPath = path.join(androidRoot, 'app/src/main/res/values/strings.xml');
  if (!fs.existsSync(stringsPath)) {
    console.warn('[withCustomAndroidWidget] strings.xml not found; Android widget fallback strings were not ensured.');
    return;
  }

  const original = fs.readFileSync(stringsPath, 'utf8');
  let patched = original;
  const strings = [
    ['noto_widget_description', 'See your nearby memory from your Home Screen.'],
    ['noto_widget_idle_fallback', 'The right note will appear when you are nearby.'],
    ['noto_widget_memory_fallback', 'A memory from this place.'],
  ];

  for (const [name, value] of strings) {
    if (patched.includes(`name="${name}"`)) {
      continue;
    }

    patched = patched.replace(
      /(\s*<\/resources>)/,
      `  <string name="${name}">${value}</string>\n$1`
    );
  }

  if (!patched.includes('name="noto_widget_count_fallback"')) {
    patched = patched.replace(
      /(\s*<\/resources>)/,
      [
        '  <plurals name="noto_widget_count_fallback">',
        '    <item quantity="one">%d memory</item>',
        '    <item quantity="other">%d memories</item>',
        '  </plurals>',
        '$1',
      ].join('\n')
    );
  }

  if (patched !== original) {
    fs.writeFileSync(stringsPath, patched);
  }
}

const withCustomAndroidWidget = (config) =>
  withFinalizedMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidRoot = config.modRequest.platformProjectRoot;

      copyFileIfPresent(projectRoot, androidRoot, PROVIDER_SOURCE_PATH, PROVIDER_TARGET_PATH);
      copyFileIfPresent(projectRoot, androidRoot, MODULE_SOURCE_PATH, MODULE_TARGET_PATH);
      copyFileIfPresent(projectRoot, androidRoot, PACKAGE_SOURCE_PATH, PACKAGE_TARGET_PATH);

      for (const [sourceRelativePath, targetRelativePath] of RESOURCE_MAPPINGS) {
        copyFileIfPresent(projectRoot, androidRoot, sourceRelativePath, targetRelativePath);
      }

      patchMainApplication(androidRoot);
      patchAndroidManifest(androidRoot);
      ensureWidgetStringResources(androidRoot);

      return config;
    },
  ]);

module.exports = withCustomAndroidWidget;
