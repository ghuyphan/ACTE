import { Platform } from 'react-native';
import ProfileScreenAndroid from '../../components/screens/profile/ProfileScreen.android';
import ProfileScreenIOS from '../../components/screens/profile/ProfileScreen.ios';

export default function ProfileScreen() {
  return Platform.OS === 'android' ? <ProfileScreenAndroid /> : <ProfileScreenIOS />;
}
