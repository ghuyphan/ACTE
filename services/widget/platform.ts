import { NativeModules, Platform } from 'react-native';
import {
  getWidgetPropsSignature,
  sanitizeWidgetPropsForBridge,
  type WidgetProps,
  type WidgetTimelineEntry,
} from './contract';

type IOSWidgetModule = {
  updateTimeline?: (entries: Array<{ date: Date; props: { props: WidgetProps } }>) => void;
};

type AndroidWidgetModule = {
  updateSnapshot?: (snapshotJson: string) => void;
};

let widgetInstance: IOSWidgetModule | null = null;

export function getWidgetWarningMessage(error: unknown) {
  if (error instanceof Error && error.message.toLowerCase().includes('hostfunction')) {
    return 'Native widget bridge rejected the timeline update.';
  }

  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim();
    if (message) {
      return message;
    }
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return 'Unknown widget error';
}

function getIOSWidget() {
  if (Platform.OS !== 'ios') {
    return null;
  }

  if (!widgetInstance) {
    try {
      const widgetModule = require('../../widgets/LocketWidget') as { default?: unknown };
      const candidate = widgetModule?.default ?? widgetModule;

      if (candidate && typeof (candidate as IOSWidgetModule).updateTimeline === 'function') {
        widgetInstance = candidate;
      } else {
        console.warn('[widgetService] Widget module loaded without updateTimeline');
      }
    } catch (error) {
      console.warn('[widgetService] Could not load widget:', error);
    }
  }

  return widgetInstance;
}

function getAndroidWidgetModule(): AndroidWidgetModule | null {
  if (Platform.OS !== 'android') {
    return null;
  }

  const androidWidgetModule = (NativeModules as {
    NotoWidgetModule?: AndroidWidgetModule;
  }).NotoWidgetModule;
  return androidWidgetModule ?? null;
}

export function getPlatformWidgetDeliverySignature(entries: WidgetTimelineEntry[]) {
  if (entries.length === 0) {
    return null;
  }

  if (Platform.OS === 'ios') {
    return JSON.stringify(
      entries.map((entry) => ({
        date: entry.date.toISOString(),
        props: sanitizeWidgetPropsForBridge(entry.props),
      }))
    );
  }

  if (Platform.OS === 'android') {
    return getWidgetPropsSignature(entries[0].props);
  }

  return null;
}

export function updatePlatformWidgetTimeline(entries: WidgetTimelineEntry[]) {
  if (entries.length === 0) {
    return 'unavailable' as const;
  }

  if (Platform.OS === 'ios') {
    const widget = getIOSWidget();
    if (!widget?.updateTimeline) {
      return 'unavailable' as const;
    }

    widget.updateTimeline(
      entries.map((entry) => ({
        date: entry.date,
        props: { props: sanitizeWidgetPropsForBridge(entry.props) },
      }))
    );
    return 'updated' as const;
  }

  if (Platform.OS === 'android') {
    const androidWidgetModule = getAndroidWidgetModule();
    if (!androidWidgetModule?.updateSnapshot) {
      return 'unavailable' as const;
    }

    androidWidgetModule.updateSnapshot(
      JSON.stringify(sanitizeWidgetPropsForBridge(entries[0].props))
    );
    return 'updated' as const;
  }

  return 'unavailable' as const;
}

export function __resetWidgetPlatformForTests() {
  widgetInstance = null;
}
