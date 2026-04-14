import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? '#000000' : '#F7F2EB';
  const textColor = isDark ? '#FFFFFF' : '#2B2621';
  const linkColor = isDark ? '#FFC107' : '#E0B15B';

  return (
    <>
      <Stack.Screen options={{ title: t('not_found.title', 'Oops!') }} />
      <View style={[styles.container, { backgroundColor }]}>
        <Text style={[styles.title, { color: textColor }]}>
          {t('not_found.message', 'This screen doesn\'t exist.')}
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: linkColor }]}>
            {t('not_found.go_home', 'Go to home screen!')}
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 16,
  },
});
