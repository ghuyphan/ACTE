import { Alert, AlertButton, Platform } from 'react-native';

export type AppAlertOptions = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

class AppAlertManager {
  listener: ((options: AppAlertOptions | null) => void) | null = null;
  
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS !== 'android') {
      Alert.alert(title, message, buttons);
      return;
    }

    if (this.listener) {
      this.listener({ title, message, buttons });
    } else {
      // Fallback in case the provider hasn't mounted yet.
      Alert.alert(title, message, buttons);
    }
  }
}

export const appAlertManager = new AppAlertManager();

export const showAppAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
  appAlertManager.alert(title, message, buttons);
};
