const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

const TARGET_NAME = 'ExpoWidgetsTarget';
const WIDGET_FILE_NAME = 'LocketWidget.swift';
const WIDGET_LOCALIZATION_FILE_NAME = 'Localizable.strings';
const WIDGET_ENTITLEMENTS_PATH = `${TARGET_NAME}/${TARGET_NAME}.entitlements`;

function withWidgetBuildConfigurations(project, mutateBuildSettings) {
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

    mutateBuildSettings(buildSettings);
    updated += 1;
  }

  return updated;
}

function enableWidgetEntitlementsModification(project) {
  return withWidgetBuildConfigurations(project, (buildSettings) => {
    buildSettings.CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION = 'YES';
  });
}

function setWidgetDisplayName(project, widgetDisplayName) {
  return withWidgetBuildConfigurations(project, (buildSettings) => {
    buildSettings.INFOPLIST_KEY_CFBundleDisplayName = widgetDisplayName;
  });
}

function toProjectRelativePath(...segments) {
  return path.join(...segments).split(path.sep).join('/');
}

function getProjectFilePath(iosRoot) {
  const projectDirectoryName = fs.readdirSync(iosRoot).find((entry) => entry.endsWith('.xcodeproj'));
  if (!projectDirectoryName) {
    throw new Error('[withCustomWidgetSwift] No .xcodeproj directory found in ios output');
  }

  const projectFilePath = path.join(iosRoot, projectDirectoryName, 'project.pbxproj');
  if (!fs.existsSync(projectFilePath)) {
    throw new Error(`[withCustomWidgetSwift] Xcode project file not found: ${projectFilePath}`);
  }

  return projectFilePath;
}

function copyWidgetLocalizationResources(project, projectRoot, iosRoot, targetKey) {
  const widgetSourceRoot = path.join(projectRoot, 'widgets', 'ios');
  if (!fs.existsSync(widgetSourceRoot)) {
    return 0;
  }

  const localizationDirectories = fs
    .readdirSync(widgetSourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.lproj'));

  let copiedCount = 0;

  for (const directory of localizationDirectories) {
    const locale = directory.name.replace(/\.lproj$/, '');
    const sourcePath = path.join(widgetSourceRoot, directory.name, WIDGET_LOCALIZATION_FILE_NAME);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    const targetDirectory = path.join(iosRoot, TARGET_NAME, directory.name);
    const targetPath = path.join(targetDirectory, WIDGET_LOCALIZATION_FILE_NAME);
    fs.mkdirSync(targetDirectory, { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    project.addKnownRegion(locale);
    project.addResourceFile(
      toProjectRelativePath(TARGET_NAME, directory.name, WIDGET_LOCALIZATION_FILE_NAME),
      { target: targetKey }
    );
    copiedCount += 1;
  }

  return copiedCount;
}

function patchWidgetProject(projectRoot, iosRoot, widgetDisplayName) {
  const projectFilePath = getProjectFilePath(iosRoot);
  const project = xcode.project(projectFilePath);
  project.parseSync();

  const targetKey = project.findTargetKey(TARGET_NAME);
  if (!targetKey) {
    throw new Error(`[withCustomWidgetSwift] Could not find ${TARGET_NAME} target in ${projectFilePath}`);
  }

  const entitlementsUpdated = enableWidgetEntitlementsModification(project);
  const displayNameUpdated = setWidgetDisplayName(project, widgetDisplayName);
  const localizationsCopied = copyWidgetLocalizationResources(project, projectRoot, iosRoot, targetKey);
  if (entitlementsUpdated === 0 || displayNameUpdated === 0) {
    throw new Error(
      `[withCustomWidgetSwift] Could not find ${TARGET_NAME} build settings in ${projectFilePath}`
    );
  }
  if (localizationsCopied === 0) {
    console.warn('[withCustomWidgetSwift] No widget localization files were copied.');
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
      patchWidgetProject(projectRoot, iosRoot, widgetDisplayName);

      return config;
    },
  ]);

module.exports = withCustomWidgetSwift;
