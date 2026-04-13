import { Platform } from 'react-native';
import TabLayoutAndroid from '../../components/navigation/TabLayoutAndroid';
import TabLayoutIOS from '../../components/navigation/TabLayoutIOS';

const TabLayout = Platform.OS === 'ios' ? TabLayoutIOS : TabLayoutAndroid;

export default TabLayout;
