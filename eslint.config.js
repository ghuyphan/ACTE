// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // import/namespace currently mis-parses re-exported TSX modules under Expo flat config.
      'import/namespace': 'off',
    },
  },
]);
