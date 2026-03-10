const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withRNFirebaseAsStaticFramework(config) {
    return withDangerousMod(config, [
        'ios',
        async (config) => {
            const file = path.join(config.modRequest.platformProjectRoot, 'Podfile');
            let contents = fs.readFileSync(file, 'utf8');

            if (!contents.includes('$RNFirebaseAsStaticFramework = true')) {
                contents = `$RNFirebaseAsStaticFramework = true\n\n` + contents;
                fs.writeFileSync(file, contents);
            }
            return config;
        },
    ]);
};
