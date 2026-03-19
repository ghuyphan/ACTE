import { Platform } from 'react-native';
import MapScreenAndroid from '../../components/screens/MapScreen.android';
import MapScreenIOS from '../../components/screens/MapScreen.ios';

export default function MapScreen() {
  return Platform.OS === 'android' ? <MapScreenAndroid /> : <MapScreenIOS />;
}
