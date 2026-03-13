import '@testing-library/jest-native/extend-expect';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');

  Reanimated.default.call = () => undefined;
  Reanimated.CurvedTransition.easingX = () => Reanimated.CurvedTransition;
  Reanimated.CurvedTransition.easingY = () => Reanimated.CurvedTransition;
  Reanimated.CurvedTransition.easingWidth = () => Reanimated.CurvedTransition;
  Reanimated.CurvedTransition.easingHeight = () => Reanimated.CurvedTransition;

  return Reanimated;
});
