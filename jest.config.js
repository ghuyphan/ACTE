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
      + '|react-native-purchases'
      + '|react-native-purchases-ui'
      + '|expo(?:nent)?'
      + '|expo-.*'
      + '|@expo(?:nent)?'
      + '|@expo-google-fonts'
      + '|@react-navigation'
      + '|@supabase'
      + '|@revenuecat'
      + ')/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^supercluster$': '<rootDir>/node_modules/supercluster/dist/supercluster.js',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
