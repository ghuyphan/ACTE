/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:react-native'
      + '|@react-native'
      + '|react-native-reanimated'
      + '|react-native-worklets'
      + '|expo(?:nent)?'
      + '|expo-.*'
      + '|@expo(?:nent)?'
      + '|@expo-google-fonts'
      + '|@react-navigation'
      + '|@firebase'
      + '|firebase'
      + ')/)',
  ],
  moduleNameMapper: {
    '^supercluster$': '<rootDir>/node_modules/supercluster/dist/supercluster.js',
    '^firebase/compat/database$': '<rootDir>/test-support/noopFirebaseCompat.js',
    '^firebase/compat/storage$': '<rootDir>/test-support/noopFirebaseCompat.js',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
