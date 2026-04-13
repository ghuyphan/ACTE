import { Stack } from 'expo-router';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

type RootStackNavigatorProps = {
  homeTitle: string;
  rootScreenOptions: {
    authEntry: NativeStackNavigationOptions;
    profile: NativeStackNavigationOptions;
    plus: NativeStackNavigationOptions;
    notesIndex: NativeStackNavigationOptions;
    stickerLibrary: NativeStackNavigationOptions;
  };
};

export default function RootStackNavigator({
  homeTitle,
  rootScreenOptions,
}: RootStackNavigatorProps) {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/index" options={rootScreenOptions.authEntry} />
      <Stack.Screen name="auth/profile" options={rootScreenOptions.profile} />
      <Stack.Screen name="plus" options={rootScreenOptions.plus} />
      <Stack.Screen name="auth/onboarding" />
      <Stack.Screen
        name="(tabs)"
        options={{
          title: homeTitle,
        }}
      />
      <Stack.Screen
        name="friends/join"
        options={{
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="note/[id]"
        options={{
          presentation: 'transparentModal',
          animation: 'none',
        }}
      />
      <Stack.Screen
        name="notes/index"
        options={{
          ...rootScreenOptions.notesIndex,
          animation: 'slide_from_left',
        }}
      />
      <Stack.Screen name="notes/stickers" options={rootScreenOptions.stickerLibrary} />
      <Stack.Screen name="shared/index" />
      <Stack.Screen
        name="shared/[id]"
        options={{
          presentation: 'transparentModal',
          animation: 'none',
        }}
      />
    </Stack>
  );
}
