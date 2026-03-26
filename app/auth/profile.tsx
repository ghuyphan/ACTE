import { Platform } from 'react-native';
import ProfileScreenAndroid from '../../components/screens/ProfileScreen.android';
import ProfileScreenIOS from '../../components/screens/ProfileScreen.ios';

export default function ProfileScreen() {
  return Platform.OS === 'android' ? <ProfileScreenAndroid /> : <ProfileScreenIOS />;
}
