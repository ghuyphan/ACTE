const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

const TARGET_NAME = 'ExpoWidgetsTarget';
const WIDGET_CONFIG_NAME = 'LocketWidget';
const EXPO_WIDGETS_PLUGIN_NAME = 'expo-widgets';
const WIDGET_FILE_NAME = 'LocketWidget.swift';
const WIDGET_LOCALIZATION_FILE_NAME = 'Localizable.strings';
const WIDGET_ENTITLEMENTS_PATH = `${TARGET_NAME}/${TARGET_NAME}.entitlements`;

function normalize(value) {
  return typeof value === 'string' ? value.replace(/^"(.*)"$/, '$1') : '';
}

function getRefValue(reference) {
  if (typeof reference === 'string') {
    return reference;
  }

  return typeof reference?.value === 'string' ? reference.value : null;
}

function getProjectObjects(project) {
  return project.hash?.project?.objects ?? {};
}

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

function getWidgetDisplayName(config) {
  const widgetConfig = (config.plugins ?? []).find(
    (pluginEntry) => Array.isArray(pluginEntry) && pluginEntry[0] === EXPO_WIDGETS_PLUGIN_NAME
  )?.[1];

  const widget =
    widgetConfig?.widgets?.find(
      (candidate) => candidate?.targetName === TARGET_NAME || candidate?.name === WIDGET_CONFIG_NAME
    ) ?? widgetConfig?.widgets?.[0];

  const configuredDisplayName =
    typeof widget?.displayName === 'string' ? widget.displayName.trim() : '';

  return configuredDisplayName || config.name || 'Noto';
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

function findGroupKeyByName(project, groupName) {
  const explicitKey =
    typeof project.findPBXGroupKey === 'function' ? project.findPBXGroupKey({ name: groupName }) : null;
  if (explicitKey) {
    return explicitKey;
  }

  const groups = getProjectObjects(project).PBXGroup ?? {};
  for (const [key, group] of Object.entries(groups)) {
    if (key.endsWith('_comment')) {
      continue;
    }

    if (normalize(group?.name) === groupName) {
      return key;
    }
  }

  return null;
}

function findVariantGroupKeyInGroup(project, groupKey, variantGroupName) {
  const objects = getProjectObjects(project);
  const parentGroup = objects.PBXGroup?.[groupKey];
  const variantGroups = objects.PBXVariantGroup ?? {};

  for (const child of parentGroup?.children ?? []) {
    const childKey = getRefValue(child);
    if (childKey && normalize(variantGroups[childKey]?.name) === variantGroupName) {
      return childKey;
    }
  }

  return null;
}

function hasBuildFileForFileRef(project, buildPhase, fileRef) {
  const buildFiles = getProjectObjects(project).PBXBuildFile ?? {};

  return (buildPhase?.files ?? []).some((reference) => {
    const buildFile = buildFiles[getRefValue(reference)];
    return getRefValue(buildFile?.fileRef) === fileRef || buildFile?.fileRef === fileRef;
  });
}

function ensureLocalizationVariantGroup(project, targetKey) {
  const parentGroupKey = findGroupKeyByName(project, TARGET_NAME) ?? findGroupKeyByName(project, 'Resources');
  if (!parentGroupKey) {
    throw new Error('[withCustomWidgetSwift] Could not find a widget or Resources group in the Xcode project.');
  }

  let variantGroupKey = findVariantGroupKeyInGroup(project, parentGroupKey, WIDGET_LOCALIZATION_FILE_NAME);
  if (!variantGroupKey) {
    variantGroupKey = project.pbxCreateVariantGroup(WIDGET_LOCALIZATION_FILE_NAME);
    project.addToPbxGroup(variantGroupKey, parentGroupKey);
  }

  const resourcesBuildPhase =
    typeof project.pbxResourcesBuildPhaseObj === 'function' ? project.pbxResourcesBuildPhaseObj(targetKey) : null;
  if (!resourcesBuildPhase) {
    throw new Error(`[withCustomWidgetSwift] Could not find a Resources build phase for target ${TARGET_NAME}.`);
  }

  if (!hasBuildFileForFileRef(project, resourcesBuildPhase, variantGroupKey)) {
    const variantGroupBuildFile = {
      uuid: project.generateUuid(),
      fileRef: variantGroupKey,
      basename: WIDGET_LOCALIZATION_FILE_NAME,
      group: 'Resources',
      target: targetKey,
    };
    project.addToPbxBuildFileSection(variantGroupBuildFile);
    project.addToPbxResourcesBuildPhase(variantGroupBuildFile);
  }

  return variantGroupKey;
}

function variantGroupHasFile(project, variantGroupKey, projectRelativePath) {
  const objects = getProjectObjects(project);
  const variantGroup = objects.PBXVariantGroup?.[variantGroupKey];
  const fileReferences = objects.PBXFileReference ?? {};

  return (variantGroup?.children ?? []).some((reference) => {
    const fileReference = fileReferences[getRefValue(reference)];
    return normalize(fileReference?.path) === projectRelativePath;
  });
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
  let localizationVariantGroupKey = null;

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

    if (!localizationVariantGroupKey) {
      localizationVariantGroupKey = ensureLocalizationVariantGroup(project, targetKey);
    }

    const projectRelativePath = toProjectRelativePath(TARGET_NAME, directory.name, WIDGET_LOCALIZATION_FILE_NAME);
    if (!variantGroupHasFile(project, localizationVariantGroupKey, projectRelativePath)) {
      project.addResourceFile(projectRelativePath, { target: targetKey, variantGroup: true }, localizationVariantGroupKey);
    }

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
      const widgetDisplayName = getWidgetDisplayName(config);

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
module.exports.__internal = {
  copyWidgetLocalizationResources,
  getWidgetDisplayName,
  setWidgetDisplayName,
};
