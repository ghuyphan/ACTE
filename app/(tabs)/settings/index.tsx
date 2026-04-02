import { Platform } from 'react-native';
import SettingsScreenAndroid from '../../../components/screens/settings/SettingsScreen.android';
import SettingsScreenIOS from '../../../components/screens/settings/SettingsScreen.ios';

export default function SettingsScreen() {
  return Platform.OS === 'android' ? <SettingsScreenAndroid /> : <SettingsScreenIOS />;
}
