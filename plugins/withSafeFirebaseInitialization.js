const { withAppDelegate } = require('@expo/config-plugins');

const withSafeFirebaseInitialization = (config) => {
    return withAppDelegate(config, (config) => {
        let contents = config.modResults.contents;

        // Match any @react-native-firebase/app-didFinishLaunchingWithOptions block
        const regex = /\/\/ @generated begin @react-native-firebase\/app-didFinishLaunchingWithOptions[\s\S]*?\/\/ @generated end @react-native-firebase\/app-didFinishLaunchingWithOptions\n?/gm;

        if (contents.match(regex)) {
            // Disable Firebase initialization — no valid GoogleService-Info.plist yet.
            // When you have a real Firebase project, replace this with:
            //   if FirebaseApp.app() == nil { FirebaseApp.configure() }
            const disabledInitString = `\
// @generated begin @react-native-firebase/app-didFinishLaunchingWithOptions - safe firebase init
// Firebase initialization disabled - no valid GoogleService-Info.plist yet
// Uncomment once you have a real Firebase project:
// if FirebaseApp.app() == nil {
//   FirebaseApp.configure()
// }
// @generated end @react-native-firebase/app-didFinishLaunchingWithOptions
`;
            contents = contents.replace(regex, disabledInitString);
            config.modResults.contents = contents;
        }

        return config;
    });
};

module.exports = withSafeFirebaseInitialization;
