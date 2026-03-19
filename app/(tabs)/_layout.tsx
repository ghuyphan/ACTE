import { Platform } from 'react-native';
import TabLayoutAndroid from '../../components/navigation/TabLayoutAndroid';
import TabLayoutIOS from '../../components/navigation/TabLayoutIOS';

export default function TabLayout() {
  return Platform.OS === 'ios' ? <TabLayoutIOS /> : <TabLayoutAndroid />;
}
