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
const withExpoWidgetsBundleFix = (config) => {
    return withXcodeProject(config, (config) => {
        const project = config.modResults;
        const targetName = 'ExpoWidgetsTarget';

        // Find the widget extension target
        const targets = project.pbxNativeTargetSection();
        let widgetTargetKey = null;

        for (const key in targets) {
            if (targets[key].name === targetName) {
                widgetTargetKey = key;
                break;
            }
        }

        if (!widgetTargetKey) {
            console.warn(
                `[withExpoWidgetsBundleFix] Could not find target "${targetName}". Skipping.`
            );
            return config;
        }

        // Check if we already added this script phase
        const buildPhases = targets[widgetTargetKey].buildPhases || [];
        const alreadyAdded = buildPhases.some((phase) => {
            const phaseObj = project.hash.project.objects['PBXShellScriptBuildPhase']?.[phase.value];
            return phaseObj?.name === '"Copy ExpoWidgets JS Bundle"';
        });

        if (alreadyAdded) {
            return config;
        }

        // Add a shell script build phase to copy the JS bundle
        const scriptContent = `
# Fix: Copy ExpoWidgets JS bundle into the resource bundle directory
SOURCE_JS="$PODS_CONFIGURATION_BUILD_DIR/ExpoWidgets/ExpoWidgets.bundle"
DEST_DIR="\${TARGET_BUILD_DIR}/\${UNLOCALIZED_RESOURCES_FOLDER_PATH}/ExpoWidgets.bundle"

if [ -d "$DEST_DIR" ] && [ -f "$SOURCE_JS/ExpoWidgets.bundle" ]; then
  echo "ExpoWidgets JS bundle already present, skipping copy."
elif [ -d "$DEST_DIR" ]; then
  # The resource bundle directory exists but the JS file is missing
  JS_SOURCE="${config.modRequest.projectRoot}/node_modules/expo-widgets/bundle/build/ExpoWidgets.bundle"
  if [ -f "$JS_SOURCE" ]; then
    echo "Copying ExpoWidgets JS bundle from source..."
    cp "$JS_SOURCE" "$DEST_DIR/ExpoWidgets.bundle"
  else
    echo "warning: ExpoWidgets JS bundle source not found at $JS_SOURCE"
  fi
else
  echo "warning: ExpoWidgets.bundle directory not found at $DEST_DIR"
fi
`;

        project.addBuildPhase(
            [],
            'PBXShellScriptBuildPhase',
            'Copy ExpoWidgets JS Bundle',
            widgetTargetKey,
            {
                shellPath: '/bin/sh',
                shellScript: scriptContent,
            }
        );

        return config;
    });
};

module.exports = withExpoWidgetsBundleFix;
