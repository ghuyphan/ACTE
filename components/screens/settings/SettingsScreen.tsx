import { Platform } from 'react-native';
import SettingsScreenAndroid from './SettingsScreen.android';
import SettingsScreenIOS from './SettingsScreen.ios';

const SettingsScreen = Platform.OS === 'android' ? SettingsScreenAndroid : SettingsScreenIOS;

export default SettingsScreen;
