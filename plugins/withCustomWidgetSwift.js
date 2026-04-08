const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

const TARGET_NAME = 'ExpoWidgetsTarget';
const WIDGET_FILE_NAME = 'LocketWidget.swift';
const WIDGET_ENTITLEMENTS_PATH = `${TARGET_NAME}/${TARGET_NAME}.entitlements`;

function enableWidgetEntitlementsModification(project) {
  const configurations = project.pbxXCBuildConfigurationSection();
  let updated = 0;

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
    updated += 1;
  }

  return updated;
}

function setWidgetDisplayName(project, widgetDisplayName) {
  const configurations = project.pbxXCBuildConfigurationSection();
  let updated = 0;

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

    buildSettings.INFOPLIST_KEY_CFBundleDisplayName = widgetDisplayName;
    updated += 1;
  }

  return updated;
}

function patchProjectBuildSettings(iosRoot, widgetDisplayName) {
  const projectDirectoryName = fs.readdirSync(iosRoot).find((entry) => entry.endsWith('.xcodeproj'));
  if (!projectDirectoryName) {
    throw new Error('[withCustomWidgetSwift] No .xcodeproj directory found in ios output');
  }

  const projectFilePath = path.join(iosRoot, projectDirectoryName, 'project.pbxproj');
  if (!fs.existsSync(projectFilePath)) {
    throw new Error(`[withCustomWidgetSwift] Xcode project file not found: ${projectFilePath}`);
  }

  const project = xcode.project(projectFilePath);
  project.parseSync();
  const entitlementsUpdated = enableWidgetEntitlementsModification(project);
  const displayNameUpdated = setWidgetDisplayName(project, widgetDisplayName);
  if (entitlementsUpdated === 0 || displayNameUpdated === 0) {
    throw new Error(
      `[withCustomWidgetSwift] Could not find ${TARGET_NAME} build settings in ${projectFilePath}`
    );
  }
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
      const widgetDisplayName = config.name || 'Noto';

      if (!fs.existsSync(sourcePath)) {
        throw new Error(`[withCustomWidgetSwift] Source file not found: ${sourcePath}`);
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
      patchProjectBuildSettings(iosRoot, widgetDisplayName);

      return config;
    },
  ]);

module.exports = withCustomWidgetSwift;
