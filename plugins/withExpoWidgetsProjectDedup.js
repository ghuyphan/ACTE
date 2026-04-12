const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

const TARGET_NAME = 'ExpoWidgetsTarget';
const EMBED_PHASE_NAME = 'Embed Foundation Extensions';
const APPLICATION_PRODUCT_TYPE = 'com.apple.product-type.application';

function normalize(value) {
  return typeof value === 'string' ? value.replace(/^"(.*)"$/, '$1') : '';
}

function getRefValue(reference) {
  if (typeof reference === 'string') {
    return reference;
  }

  return typeof reference?.value === 'string' ? reference.value : null;
}

function getRefComment(reference) {
  if (typeof reference === 'string') {
    return '';
  }

  return normalize(reference?.comment);
}

function getProjectFilePath(iosRoot) {
  const projectDirectoryName = fs.readdirSync(iosRoot).find((entry) => entry.endsWith('.xcodeproj'));
  if (!projectDirectoryName) {
    throw new Error('[withExpoWidgetsProjectDedup] No .xcodeproj directory found in ios output');
  }

  const projectFilePath = path.join(iosRoot, projectDirectoryName, 'project.pbxproj');
  if (!fs.existsSync(projectFilePath)) {
    throw new Error(`[withExpoWidgetsProjectDedup] Xcode project file not found: ${projectFilePath}`);
  }

  return projectFilePath;
}

function findFirstMatchingReference(references, predicate) {
  for (const reference of references ?? []) {
    if (predicate(reference)) {
      return getRefValue(reference);
    }
  }

  return null;
}

function dedupeSectionReferences(references, predicate, keepValue) {
  let changed = false;

  const nextReferences = (references ?? []).filter((reference) => {
    if (!predicate(reference)) {
      return true;
    }

    const value = getRefValue(reference);
    const keep = value === keepValue;
    if (!keep) {
      changed = true;
    }
    return keep;
  });

  return {
    changed,
    references: nextReferences,
  };
}

function dedupeWidgetGroupChildren(group) {
  if (!group || !Array.isArray(group.children)) {
    return false;
  }

  const seenComments = new Set();
  let changed = false;
  group.children = group.children.filter((reference) => {
    const comment = getRefComment(reference);
    if (!comment) {
      return true;
    }

    if (seenComments.has(comment)) {
      changed = true;
      return false;
    }

    seenComments.add(comment);
    return true;
  });

  return changed;
}

function findMainAppTargetKey(projectTargets, nativeTargets) {
  const explicitTarget = findFirstMatchingReference(
    projectTargets,
    (reference) => nativeTargets[getRefValue(reference)]?.productType === APPLICATION_PRODUCT_TYPE
  );

  if (explicitTarget) {
    return explicitTarget;
  }

  return findFirstMatchingReference(
    projectTargets,
    (reference) => normalize(nativeTargets[getRefValue(reference)]?.name) !== TARGET_NAME
  );
}

function dedupeExpoWidgetsProject(project) {
  const objects = project.hash.project.objects;
  const projectSection = objects.PBXProject?.[project.getFirstProject().uuid];
  const nativeTargets = objects.PBXNativeTarget ?? {};
  const groups = objects.PBXGroup ?? {};
  const copyFilesBuildPhases = objects.PBXCopyFilesBuildPhase ?? {};
  const buildFiles = objects.PBXBuildFile ?? {};
  const targetDependencies = objects.PBXTargetDependency ?? {};

  if (!projectSection) {
    return { changed: false, removedWidgetTargets: 0 };
  }

  const projectTargets = projectSection.targets ?? [];
  const widgetTargetIds = projectTargets
    .map((reference) => getRefValue(reference))
    .filter((value) => value && normalize(nativeTargets[value]?.name) === TARGET_NAME);

  if (widgetTargetIds.length <= 1) {
    return { changed: false, removedWidgetTargets: 0 };
  }

  const keepWidgetTargetId = widgetTargetIds[0];
  const keepWidgetTarget = nativeTargets[keepWidgetTargetId];
  const keepWidgetProductRef = getRefValue(keepWidgetTarget?.productReference);
  const removedWidgetTargets = widgetTargetIds.length - 1;
  let changed = false;

  const dedupedTargets = dedupeSectionReferences(
    projectTargets,
    (reference) => normalize(nativeTargets[getRefValue(reference)]?.name) === TARGET_NAME,
    keepWidgetTargetId
  );
  if (dedupedTargets.changed) {
    projectSection.targets = dedupedTargets.references;
    changed = true;
  }

  const targetAttributes = projectSection.attributes?.TargetAttributes;
  if (targetAttributes) {
    for (const widgetTargetId of widgetTargetIds.slice(1)) {
      if (widgetTargetId in targetAttributes) {
        delete targetAttributes[widgetTargetId];
        changed = true;
      }
    }
  }

  const mainGroupId = getRefValue(projectSection.mainGroup);
  const mainGroup = mainGroupId ? groups[mainGroupId] : null;
  if (mainGroup) {
    const widgetGroupIds = (mainGroup.children ?? [])
      .map((reference) => getRefValue(reference))
      .filter((value) => value && normalize(groups[value]?.name) === TARGET_NAME);
    const keepWidgetGroupId = widgetGroupIds[0] ?? null;

    if (keepWidgetGroupId) {
      const dedupedWidgetGroups = dedupeSectionReferences(
        mainGroup.children,
        (reference) => normalize(groups[getRefValue(reference)]?.name) === TARGET_NAME,
        keepWidgetGroupId
      );
      if (dedupedWidgetGroups.changed) {
        mainGroup.children = dedupedWidgetGroups.references;
        changed = true;
      }

      if (dedupeWidgetGroupChildren(groups[keepWidgetGroupId])) {
        changed = true;
      }
    }

    const productGroupId = findFirstMatchingReference(
      mainGroup.children,
      (reference) => normalize(groups[getRefValue(reference)]?.name) === 'Products'
    );
    const productsGroup = productGroupId ? groups[productGroupId] : null;
    if (productsGroup && keepWidgetProductRef) {
      const dedupedProducts = dedupeSectionReferences(
        productsGroup.children,
        (reference) => getRefComment(reference) === `${TARGET_NAME}.appex`,
        keepWidgetProductRef
      );
      if (dedupedProducts.changed) {
        productsGroup.children = dedupedProducts.references;
        changed = true;
      }
    }
  }

  const mainAppTargetId = findMainAppTargetKey(projectTargets, nativeTargets);
  const mainAppTarget = mainAppTargetId ? nativeTargets[mainAppTargetId] : null;
  if (mainAppTarget) {
    const dedupedDependencies = dedupeSectionReferences(
      mainAppTarget.dependencies,
      (reference) => normalize(nativeTargets[targetDependencies[getRefValue(reference)]?.target]?.name) === TARGET_NAME,
      findFirstMatchingReference(
        mainAppTarget.dependencies,
        (reference) => targetDependencies[getRefValue(reference)]?.target === keepWidgetTargetId
      )
    );
    if (dedupedDependencies.changed) {
      mainAppTarget.dependencies = dedupedDependencies.references;
      changed = true;
    }

    const embedPhaseIds = (mainAppTarget.buildPhases ?? [])
      .map((reference) => getRefValue(reference))
      .filter((value) => value && normalize(copyFilesBuildPhases[value]?.name) === EMBED_PHASE_NAME);
    const keepEmbedPhaseId =
      embedPhaseIds.find((value) => (copyFilesBuildPhases[value]?.files ?? []).length > 0) ??
      embedPhaseIds[0] ??
      null;

    if (keepEmbedPhaseId) {
      const dedupedBuildPhases = dedupeSectionReferences(
        mainAppTarget.buildPhases,
        (reference) => normalize(copyFilesBuildPhases[getRefValue(reference)]?.name) === EMBED_PHASE_NAME,
        keepEmbedPhaseId
      );
      if (dedupedBuildPhases.changed) {
        mainAppTarget.buildPhases = dedupedBuildPhases.references;
        changed = true;
      }

      const keepEmbedPhase = copyFilesBuildPhases[keepEmbedPhaseId];
      if (keepEmbedPhase && keepWidgetProductRef) {
        const keepBuildFileId =
          findFirstMatchingReference(
            keepEmbedPhase.files,
            (reference) => getRefValue(buildFiles[getRefValue(reference)]?.fileRef) === keepWidgetProductRef
          ) ??
          findFirstMatchingReference(
            keepEmbedPhase.files,
            (reference) => getRefComment(reference) === `${TARGET_NAME}.appex in ${EMBED_PHASE_NAME}`
          );

        if (keepBuildFileId) {
          const dedupedBuildFiles = dedupeSectionReferences(
            keepEmbedPhase.files,
            (reference) => getRefComment(reference) === `${TARGET_NAME}.appex in ${EMBED_PHASE_NAME}`,
            keepBuildFileId
          );
          if (dedupedBuildFiles.changed) {
            keepEmbedPhase.files = dedupedBuildFiles.references;
            changed = true;
          }
        }
      }
    }
  }

  return {
    changed,
    removedWidgetTargets,
  };
}

function dedupeExpoWidgetsProjectFile(projectFilePath) {
  const project = xcode.project(projectFilePath);
  project.parseSync();

  const result = dedupeExpoWidgetsProject(project);
  if (result.changed) {
    fs.writeFileSync(projectFilePath, project.writeSync());
  }

  return result;
}

const withExpoWidgetsProjectDedup = (config) =>
  withFinalizedMod(config, [
    'ios',
    async (config) => {
      const projectFilePath = getProjectFilePath(config.modRequest.platformProjectRoot);
      const result = dedupeExpoWidgetsProjectFile(projectFilePath);
      if (result.changed) {
        console.log(
          `[withExpoWidgetsProjectDedup] Removed ${result.removedWidgetTargets} duplicate ${TARGET_NAME} target entries.`
        );
      }

      return config;
    },
  ]);

module.exports = withExpoWidgetsProjectDedup;
module.exports.__internal = {
  dedupeExpoWidgetsProject,
  dedupeExpoWidgetsProjectFile,
  getProjectFilePath,
};
