import { Platform } from 'react-native';
import SettingsScreenAndroid from '../../components/screens/SettingsScreen.android';
import SettingsScreenIOS from '../../components/screens/SettingsScreen.ios';

export default function SettingsScreen() {
  return Platform.OS === 'android' ? <SettingsScreenAndroid /> : <SettingsScreenIOS />;
}
