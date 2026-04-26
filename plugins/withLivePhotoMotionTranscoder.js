const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

const SOURCE_FILES = [
  'LivePhotoMotionTranscoder.swift',
  'LivePhotoMotionTranscoderBridge.m',
];

function normalizeValue(value) {
  return typeof value === 'string' ? value.replace(/^"(.*)"$/, '$1') : '';
}

function findAppTarget(project, appName) {
  const targets = project.pbxNativeTargetSection();

  for (const [key, target] of Object.entries(targets)) {
    if (key.endsWith('_comment')) {
      continue;
    }

    const name = normalizeValue(target?.name);
    const productName = normalizeValue(target?.productName);
    if (name === appName || productName === appName) {
      return key;
    }
  }

  return project.getFirstTarget()?.uuid ?? null;
}

function addSourceFilesToProject(project, appName) {
  const targetUuid = findAppTarget(project, appName);
  const groupKey = project.findPBXGroupKey({ name: appName });

  if (!targetUuid || !groupKey) {
    return false;
  }

  for (const filename of SOURCE_FILES) {
    const relativePath = `${appName}/${filename}`;
    if (project.hasFile(relativePath)) {
      continue;
    }

    project.addSourceFile(relativePath, { target: targetUuid }, groupKey);
  }

  return true;
}

function patchProjectFile(iosRoot, appName) {
  const projectDirectoryName = fs.readdirSync(iosRoot).find((entry) => entry.endsWith('.xcodeproj'));
  if (!projectDirectoryName) {
    return false;
  }

  const projectFilePath = path.join(iosRoot, projectDirectoryName, 'project.pbxproj');
  if (!fs.existsSync(projectFilePath)) {
    return false;
  }

  const project = xcode.project(projectFilePath);
  project.parseSync();

  const didPatch = addSourceFilesToProject(project, appName);
  if (didPatch) {
    fs.writeFileSync(projectFilePath, project.writeSync());
  }

  return didPatch;
}

function copyLivePhotoSourceFiles(projectRoot, iosRoot, appName, shouldFailFast) {
  const sourceDirectory = path.join(projectRoot, 'native', 'ios');
  const destinationDirectory = path.join(iosRoot, appName);
  fs.mkdirSync(destinationDirectory, { recursive: true });

  let copiedCount = 0;
  for (const filename of SOURCE_FILES) {
    const sourcePath = path.join(sourceDirectory, filename);
    const destinationPath = path.join(destinationDirectory, filename);

    if (!fs.existsSync(sourcePath)) {
      const message = `[withLivePhotoMotionTranscoder] Source file not found: ${sourcePath}`;
      if (shouldFailFast) {
        throw new Error(message);
      }
      console.warn(message);
      continue;
    }

    fs.copyFileSync(sourcePath, destinationPath);
    copiedCount += 1;
  }

  return copiedCount;
}

const withLivePhotoMotionTranscoder = (config) =>
  withFinalizedMod(config, [
    'ios',
    async (config) => {
      const isEasBuild = process.env.EAS_BUILD?.trim() === 'true';
      const isProductionBuild = process.env.EAS_BUILD_PROFILE?.trim() === 'production';
      const shouldFailFast = isEasBuild || isProductionBuild;
      const projectRoot = config.modRequest.projectRoot;
      const iosRoot = config.modRequest.platformProjectRoot;
      const projectDirectoryName = fs.readdirSync(iosRoot).find((entry) => entry.endsWith('.xcodeproj'));
      const appName = projectDirectoryName ? path.basename(projectDirectoryName, '.xcodeproj') : 'Noto';
      copyLivePhotoSourceFiles(projectRoot, iosRoot, appName, shouldFailFast);

      const didPatchProject = patchProjectFile(iosRoot, appName);
      if (!didPatchProject) {
        const message = '[withLivePhotoMotionTranscoder] Could not patch the iOS project for native sources.';
        if (shouldFailFast) {
          throw new Error(message);
        }
        console.warn(message);
      }

      return config;
    },
  ]);

module.exports = withLivePhotoMotionTranscoder;
module.exports.__internal = {
  copyLivePhotoSourceFiles,
  SOURCE_FILES,
};
