const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

const TARGET_NAME = 'ExpoWidgetsTarget';
const WIDGET_FILE_NAME = 'LocketWidget.swift';
const WIDGET_ENTITLEMENTS_PATH = `${TARGET_NAME}/${TARGET_NAME}.entitlements`;

function enableWidgetEntitlementsModification(project) {
  const configurations = project.pbxXCBuildConfigurationSection();

  for (const [key, configuration] of Object.entries(configurations)) {
    if (key.endsWith('_comment')) {
      continue;
    }

    const buildSettings = configuration.buildSettings;
    if (!buildSettings) {
      continue;
    }

    const entitlementsPath = String(buildSettings.CODE_SIGN_ENTITLEMENTS ?? '').replace(/^"(.*)"$/, '$1');
    if (entitlementsPath !== WIDGET_ENTITLEMENTS_PATH) {
      continue;
    }

    buildSettings.CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION = 'YES';
  }
}

function patchProjectBuildSettings(iosRoot) {
  const projectDirectoryName = fs.readdirSync(iosRoot).find((entry) => entry.endsWith('.xcodeproj'));
  if (!projectDirectoryName) {
    return;
  }

  const projectFilePath = path.join(iosRoot, projectDirectoryName, 'project.pbxproj');
  if (!fs.existsSync(projectFilePath)) {
    return;
  }

  const project = xcode.project(projectFilePath);
  project.parseSync();
  enableWidgetEntitlementsModification(project);
  fs.writeFileSync(projectFilePath, project.writeSync());
}

const withCustomWidgetSwift = (config) =>
  withFinalizedMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosRoot = config.modRequest.platformProjectRoot;
      const sourcePath = path.join(projectRoot, 'widgets', 'ios', WIDGET_FILE_NAME);
      const targetPath = path.join(iosRoot, TARGET_NAME, WIDGET_FILE_NAME);

      if (!fs.existsSync(sourcePath)) {
        console.warn(`[withCustomWidgetSwift] Source file not found: ${sourcePath}`);
        return config;
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
      patchProjectBuildSettings(iosRoot);

      return config;
    },
  ]);

module.exports = withCustomWidgetSwift;
