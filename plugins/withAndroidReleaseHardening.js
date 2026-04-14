const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const BUILD_GRADLE_ENV_SNIPPET = `def readEnv = { name ->
    def value = System.getenv(name)
    if (value == null) {
        return null
    }

    value = value.trim()
    return value ? value : null
}
def googleMapsApiKey = readEnv('EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY') ?: ''
def uploadStoreFilePath = readEnv('ACTE_UPLOAD_STORE_FILE')
def uploadStorePassword = readEnv('ACTE_UPLOAD_STORE_PASSWORD')
def uploadKeyAlias = readEnv('ACTE_UPLOAD_KEY_ALIAS')
def uploadKeyPassword = readEnv('ACTE_UPLOAD_KEY_PASSWORD')
def allowDebugSignedRelease = (readEnv('ACTE_ALLOW_DEBUG_SIGNED_RELEASE') ?: 'false').toBoolean()
def isEasBuild = (readEnv('EAS_BUILD') ?: 'false').toBoolean()
def isReleaseTaskRequested = gradle.startParameter.taskNames.any { it.toLowerCase().contains('release') }
def releaseStoreFile = uploadStoreFilePath ? file(uploadStoreFilePath) : null

if (uploadStoreFilePath && !releaseStoreFile.exists()) {
    throw new GradleException("ACTE_UPLOAD_STORE_FILE points to a missing file: \${uploadStoreFilePath}")
}
`;

const BUILD_GRADLE_DEFAULT_CONFIG_SNIPPET = [
  '        manifestPlaceholders = [',
  '            GOOGLE_MAPS_API_KEY: googleMapsApiKey,',
  '        ]',
].join('\n');

const BUILD_GRADLE_SIGNING_CONFIG_SNIPPET = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        if (releaseStoreFile && uploadStorePassword && uploadKeyAlias && uploadKeyPassword) {
            release {
                storeFile releaseStoreFile
                storePassword uploadStorePassword
                keyAlias uploadKeyAlias
                keyPassword uploadKeyPassword
            }
        }
    }`;

const BUILD_GRADLE_RELEASE_SNIPPET = `        release {
            if (signingConfigs.findByName("release") != null) {
                signingConfig signingConfigs.release
            } else if (allowDebugSignedRelease) {
                signingConfig signingConfigs.debug
            } else if (isEasBuild) {
                logger.lifecycle("Using EAS-managed Android signing credentials for release build.")
            } else if (!isReleaseTaskRequested) {
                logger.lifecycle("Skipping release signing enforcement because no release task was requested.")
            } else {
                throw new GradleException(
                    "Release signing credentials are missing. Set ACTE_UPLOAD_STORE_FILE, ACTE_UPLOAD_STORE_PASSWORD, ACTE_UPLOAD_KEY_ALIAS, and ACTE_UPLOAD_KEY_PASSWORD, use EAS remote credentials, or set ACTE_ALLOW_DEBUG_SIGNED_RELEASE=true for local smoke tests."
                )
            }`;

function patchBuildGradle(contents) {
  let nextContents = contents;
  const replaceOrThrow = (searchValue, replacement, label) => {
    if (typeof searchValue === 'string') {
      if (!nextContents.includes(searchValue)) {
        throw new Error(
          `[withAndroidReleaseHardening] Could not find ${label} anchor in android/app/build.gradle`
        );
      }
      nextContents = nextContents.replace(searchValue, replacement);
      return;
    }

    if (!searchValue.test(nextContents)) {
      throw new Error(
        `[withAndroidReleaseHardening] Could not find ${label} pattern in android/app/build.gradle`
      );
    }
    nextContents = nextContents.replace(searchValue, replacement);
  };

  if (!nextContents.includes("def readEnv = { name ->")) {
    replaceOrThrow(
      "def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()\n",
      `def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()\n${BUILD_GRADLE_ENV_SNIPPET}`,
      'projectRoot declaration'
    );
  }

  if (!nextContents.includes('GOOGLE_MAPS_API_KEY: googleMapsApiKey')) {
    replaceOrThrow(
      /(        versionName "[^"]+"\n)(\n        buildConfigField "String", "REACT_NATIVE_RELEASE_LEVEL", [^\n]+)/,
      `$1${BUILD_GRADLE_DEFAULT_CONFIG_SNIPPET}\n$2`,
      'defaultConfig block'
    );
  }

  if (
    !nextContents.includes('if (releaseStoreFile && uploadStorePassword && uploadKeyAlias && uploadKeyPassword)')
  ) {
    replaceOrThrow(
      /    signingConfigs \{\n        debug \{\n            storeFile file\('debug\.keystore'\)\n            storePassword 'android'\n            keyAlias 'androiddebugkey'\n            keyPassword 'android'\n        \}\n    \}/,
      BUILD_GRADLE_SIGNING_CONFIG_SNIPPET,
      'signingConfigs block'
    );
  }

  if (!nextContents.includes('Release signing credentials are missing.')) {
    replaceOrThrow(
      /        release \{\n            \/\/ Caution! In production, you need to generate your own keystore file\.\n            \/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\n            signingConfig signingConfigs\.debug/,
      BUILD_GRADLE_RELEASE_SNIPPET,
      'release signing block'
    );
  }

  return nextContents;
}

function patchManifest(contents) {
  const desiredTag =
    '<meta-data android:name="com.google.android.geo.API_KEY" android:value="${GOOGLE_MAPS_API_KEY}"/>';

  if (contents.includes(desiredTag)) {
    return contents;
  }

  if (contents.includes('android:name="com.google.android.geo.API_KEY"')) {
    return contents.replace(
      /<meta-data android:name="com\.google\.android\.geo\.API_KEY" android:value="[^"]*"\/>/,
      desiredTag
    );
  }

  if (!contents.includes('<application ')) {
    throw new Error(
      '[withAndroidReleaseHardening] Could not find application tag in android/app/src/main/AndroidManifest.xml'
    );
  }

  return contents.replace(
    /(<application\b[^>]*>)/,
    `$1\n    ${desiredTag}`
  );
}

function withAndroidReleaseHardening(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;
      const buildGradlePath = path.join(androidRoot, 'app', 'build.gradle');
      const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');

      if (fs.existsSync(buildGradlePath)) {
        const currentBuildGradle = fs.readFileSync(buildGradlePath, 'utf8');
        const nextBuildGradle = patchBuildGradle(currentBuildGradle);
        if (nextBuildGradle !== currentBuildGradle) {
          fs.writeFileSync(buildGradlePath, nextBuildGradle);
        }
      }

      if (fs.existsSync(manifestPath)) {
        const currentManifest = fs.readFileSync(manifestPath, 'utf8');
        const nextManifest = patchManifest(currentManifest);
        if (nextManifest !== currentManifest) {
          fs.writeFileSync(manifestPath, nextManifest);
        }
      }

      return config;
    },
  ]);
}

module.exports = withAndroidReleaseHardening;
