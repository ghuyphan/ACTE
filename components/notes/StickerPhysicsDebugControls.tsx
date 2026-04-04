import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

export interface DebugTiltState {
  enabled: boolean;
  x: number;
  y: number;
}

export const DEFAULT_DEBUG_TILT_STATE: DebugTiltState = {
  enabled: false,
  x: 0,
  y: 0,
};

const DEBUG_TILT_PRESETS: {
  id: string;
  labelKey: string;
  x: number;
  y: number;
  enabled: boolean;
}[] = [
  { id: 'sensor', labelKey: 'debug.tilt.sensor', x: 0, y: 0, enabled: false },
  { id: 'left', labelKey: 'debug.tilt.left', x: -0.92, y: 0, enabled: true },
  { id: 'right', labelKey: 'debug.tilt.right', x: 0.92, y: 0, enabled: true },
  { id: 'up', labelKey: 'debug.tilt.up', x: 0, y: -0.92, enabled: true },
  { id: 'down', labelKey: 'debug.tilt.down', x: 0, y: 0.92, enabled: true },
  { id: 'drift', labelKey: 'debug.tilt.drift', x: 0.98, y: 0.82, enabled: true },
  { id: 'flat', labelKey: 'debug.tilt.flat', x: 0, y: 0, enabled: true },
];

interface StickerPhysicsDebugControlsProps {
  debugTiltOverride: SharedValue<DebugTiltState>;
  visible: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function StickerPhysicsDebugControls({
  debugTiltOverride,
  visible,
  style,
}: StickerPhysicsDebugControlsProps) {
  const { t } = useTranslation();
  const [activePresetId, setActivePresetId] = useState('sensor');

  useEffect(() => {
    if (visible) {
      return;
    }

    setActivePresetId('sensor');
    debugTiltOverride.value = DEFAULT_DEBUG_TILT_STATE;
  }, [debugTiltOverride, visible]);

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.panel, style]}>
      <Text style={styles.title}>{t('debug.tilt.title', 'Sim Tilt')}</Text>
      <View style={styles.buttonGrid}>
        {DEBUG_TILT_PRESETS.map((preset) => {
          const selected = activePresetId === preset.id;

          return (
            <Pressable
              key={preset.id}
              onPress={() => {
                setActivePresetId(preset.id);
                debugTiltOverride.value = {
                  enabled: preset.enabled,
                  x: preset.x,
                  y: preset.y,
                };
              }}
              style={[styles.button, selected ? styles.buttonActive : null]}
            >
              <Text style={[styles.buttonLabel, selected ? styles.buttonLabelActive : null]}>
                {t(preset.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    maxWidth: 280,
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  button: {
    minWidth: 56,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  buttonActive: {
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  buttonLabel: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonLabelActive: {
    color: '#0F172A',
  },
});
