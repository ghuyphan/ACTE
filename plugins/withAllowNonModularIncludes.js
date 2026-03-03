const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withAllowNonModularIncludes(config) {
    return withDangerousMod(config, [
        'ios',
        async (config) => {
            const file = path.join(config.modRequest.platformProjectRoot, 'Podfile');
            let contents = fs.readFileSync(file, 'utf8');

            const hookEnd = `post_install do |installer|`;

            const snippet = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
`;

            if (contents.includes(hookEnd) && !contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
                contents = contents.replace(hookEnd, `${hookEnd}\n${snippet}`);
                fs.writeFileSync(file, contents);
            }
            return config;
        },
    ]);
}

module.exports = withAllowNonModularIncludes;
