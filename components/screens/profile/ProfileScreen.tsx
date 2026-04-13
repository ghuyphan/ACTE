import { Platform } from 'react-native';
import ProfileScreenAndroid from './ProfileScreen.android';
import ProfileScreenIOS from './ProfileScreen.ios';

const ProfileScreen = Platform.OS === 'android' ? ProfileScreenAndroid : ProfileScreenIOS;

export default ProfileScreen;
