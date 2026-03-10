const { withXcodeProject } = require('expo/config-plugins');

/**
 * Config plugin that fixes the ExpoWidgets.bundle JS file not being
 * included in the built resource bundle.
 *
 * The expo-widgets podspec creates an empty ExpoWidgets.bundle resource
 * bundle directory, and its "Prepare ExpoWidgets Resources" script phase
 * runs at `before_compile`, so the JS file gets overwritten when the
 * resource bundle directory is recreated later.
 *
 * This plugin adds a post-build "Copy ExpoWidgets JS Bundle" script phase
 * to the ExpoWidgetsTarget that copies the JS file into the final
 * ExpoWidgets.bundle directory after it's been created.
 */
const TARGET_NAME = 'ExpoWidgetsTarget';
const SCRIPT_NAME = 'Copy ExpoWidgets JS Bundle';

const normalize = (value) =>
    typeof value === 'string' ? value.replace(/^"(.*)"$/, '$1') : '';

function ensureBundleCopyPhase(project, projectRoot) {
    const targets = project.pbxNativeTargetSection();
    let widgetTargetKey = null;

    for (const key in targets) {
        if (key.endsWith('_comment')) {
            continue;
        }
        const name = normalize(targets[key]?.name);
        const productName = normalize(targets[key]?.productName);
        if (name === TARGET_NAME || productName === TARGET_NAME) {
            widgetTargetKey = key;
            break;
        }
    }

    if (!widgetTargetKey) {
        return false;
    }

    const buildPhases = targets[widgetTargetKey].buildPhases || [];
    const alreadyAdded = buildPhases.some((phase) => {
        const phaseObj = project.hash.project.objects['PBXShellScriptBuildPhase']?.[phase.value];
        return normalize(phaseObj?.name) === SCRIPT_NAME;
    });
    if (alreadyAdded) {
        return true;
    }

    const scriptContent = `
# Fix: Copy ExpoWidgets JS bundle into the resource bundle directory
DEST_DIR="\${TARGET_BUILD_DIR}/\${UNLOCALIZED_RESOURCES_FOLDER_PATH}/ExpoWidgets.bundle"
PODS_JS_SOURCE="$PODS_CONFIGURATION_BUILD_DIR/ExpoWidgets/ExpoWidgets.bundle/ExpoWidgets.bundle"
NODE_JS_SOURCE="${projectRoot}/node_modules/expo-widgets/bundle/build/ExpoWidgets.bundle"
DEST_JS="$DEST_DIR/ExpoWidgets.bundle"

if [ -f "$DEST_JS" ]; then
  echo "ExpoWidgets JS bundle already present, skipping copy."
elif [ -d "$DEST_DIR" ]; then
  if [ -f "$PODS_JS_SOURCE" ]; then
    echo "Copying ExpoWidgets JS bundle from Pods build products..."
    cp "$PODS_JS_SOURCE" "$DEST_JS"
  elif [ -f "$NODE_JS_SOURCE" ]; then
    echo "Copying ExpoWidgets JS bundle from node_modules source..."
    cp "$NODE_JS_SOURCE" "$DEST_JS"
  else
    echo "warning: ExpoWidgets JS bundle source not found in Pods or node_modules"
  fi
else
  echo "warning: ExpoWidgets.bundle directory not found at $DEST_DIR"
fi
`;

    project.addBuildPhase([], 'PBXShellScriptBuildPhase', SCRIPT_NAME, widgetTargetKey, {
        shellPath: '/bin/sh',
        shellScript: scriptContent,
    });
    return true;
}

const withExpoWidgetsBundleFix = (config) => {
    return withXcodeProject(config, (config) => {
        const applied = ensureBundleCopyPhase(config.modResults, config.modRequest.projectRoot);
        if (!applied) {
            console.warn(
                `[withExpoWidgetsBundleFix] Could not find target "${TARGET_NAME}" in withXcodeProject step.`
            );
        }
        return config;
    });
};

module.exports = withExpoWidgetsBundleFix;
