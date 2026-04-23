import { readFileSync } from 'node:fs';
import path from 'node:path';
import { WIDGET_PAYLOAD_FIELD_NAMES } from '../services/widget/contract';

const iosWidgetSource = readFileSync(
  path.join(__dirname, '..', 'widgets', 'ios', 'LocketWidget.swift'),
  'utf8'
);
const androidWidgetModuleSource = readFileSync(
  path.join(__dirname, '..', 'widgets', 'android', 'NotoWidgetModule.kt'),
  'utf8'
);
const androidWidgetProviderSource = readFileSync(
  path.join(__dirname, '..', 'widgets', 'android', 'NotoWidgetProvider.kt'),
  'utf8'
);

describe('widget payload contract parity', () => {
  it('keeps the iOS widget parser aligned with the shared payload fields', () => {
    for (const fieldName of WIDGET_PAYLOAD_FIELD_NAMES) {
      expect(iosWidgetSource).toContain(`"${fieldName}"`);
    }
  });

  it('keeps the Android snapshot model and parser aligned with the shared payload fields', () => {
    for (const fieldName of WIDGET_PAYLOAD_FIELD_NAMES) {
      expect(androidWidgetModuleSource).toContain(`val ${fieldName}:`);
      expect(androidWidgetProviderSource).toContain(`"${fieldName}"`);
    }
  });

  it('does not let the Android snapshot model drift beyond the shared payload contract', () => {
    const androidSnapshotFieldNames = Array.from(
      androidWidgetModuleSource.matchAll(/val\s+([A-Za-z0-9_]+):/g),
      (match) => match[1]
    );

    expect(androidSnapshotFieldNames).toEqual([...WIDGET_PAYLOAD_FIELD_NAMES]);
  });
});
