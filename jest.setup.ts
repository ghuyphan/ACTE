import '@testing-library/jest-native/extend-expect';

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');

  Reanimated.default.call = () => undefined;

  return Reanimated;
});
