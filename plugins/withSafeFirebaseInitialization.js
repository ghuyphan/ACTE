const { withAppDelegate } = require('@expo/config-plugins');

const withSafeFirebaseInitialization = (config) => {
    return withAppDelegate(config, (config) => {
        let contents = config.modResults.contents;

        // Match any @react-native-firebase/app-didFinishLaunchingWithOptions block
        const regex = /\/\/ @generated begin @react-native-firebase\/app-didFinishLaunchingWithOptions[\s\S]*?\/\/ @generated end @react-native-firebase\/app-didFinishLaunchingWithOptions\n?/gm;

        if (contents.match(regex)) {
            const enabledInitString = `\
// @generated begin @react-native-firebase/app-didFinishLaunchingWithOptions - safe firebase init
if FirebaseApp.app() == nil {
  FirebaseApp.configure()
}
// @generated end @react-native-firebase/app-didFinishLaunchingWithOptions
`;
            contents = contents.replace(regex, enabledInitString);
            config.modResults.contents = contents;
        }

        return config;
    });
};

module.exports = withSafeFirebaseInitialization;
