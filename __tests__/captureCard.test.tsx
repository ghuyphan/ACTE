import React from 'react';
import { Animated, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import CaptureCard, { type CaptureCardHandle } from '../components/home/CaptureCard';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

jest.mock('expo-camera', () => ({
  CameraView: () => null,
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('../components/ui/GlassView', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

jest.mock('../components/ui/PrimaryButton', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return function MockPrimaryButton({ label, onPress }: any) {
    return (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    );
  };
});

jest.mock('../utils/platform', () => ({
  isOlderIOS: false,
}));

jest.mock('../components/NoteDoodleCanvas', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    __esModule: true,
    default: function MockNoteDoodleCanvas(props: any) {
      return (
        <View testID="mock-doodle-canvas">
          <Text testID="mock-doodle-editable">{String(props.editable)}</Text>
          <Pressable
            testID="mock-doodle-commit"
            onPress={() =>
              props.onChangeStrokes?.([
                { color: '#1C1C1E', points: [0.1, 0.1, 0.2, 0.2] },
                { color: '#1C1C1E', points: [0.3, 0.3, 0.4, 0.4] },
              ])
            }
          />
        </View>
      );
    },
  };
});

function createCaptureCardProps(
  ref: React.RefObject<CaptureCardHandle | null>,
  props: Partial<React.ComponentProps<typeof CaptureCard>> = {}
) {
  const animatedValue = new Animated.Value(1);
  const zeroValue = new Animated.Value(0);

  return {
    ref,
    snapHeight: 700,
    topInset: 0,
    isSearching: false,
    captureMode: 'text' as const,
    cameraSessionKey: 1,
    captureScale: animatedValue,
    captureTranslateY: zeroValue,
    colors: {
      primary: '#FFC107',
      captureButtonBg: '#1C1C1E',
      card: '#FFFFFF',
      border: '#E5E5EA',
      text: '#1C1C1E',
      secondaryText: '#8E8E93',
      captureCardText: '#1C1C1E',
      captureCardPlaceholder: 'rgba(28,28,30,0.48)',
      captureCardBorder: 'rgba(255,255,255,0.22)',
      captureGlassFill: 'rgba(255,252,246,0.62)',
      captureGlassBorder: 'rgba(255,255,255,0.3)',
      captureGlassText: '#2B2621',
      captureGlassIcon: 'rgba(43,38,33,0.52)',
      captureGlassPlaceholder: 'rgba(43,38,33,0.34)',
      captureGlassColorScheme: 'light' as const,
      captureCameraOverlay: 'rgba(28,28,30,0.48)',
      captureCameraOverlayBorder: 'rgba(255,255,255,0.16)',
      captureCameraOverlayText: '#FFFDFC',
      captureFlashOverlay: 'rgba(255,250,242,0.96)',
    },
    t: ((_: string, fallback?: string) => fallback ?? '') as any,
    noteText: 'Draft memory',
    onChangeNoteText: () => undefined,
    restaurantName: 'Cafe',
    onChangeRestaurantName: () => undefined,
    capturedPhoto: null,
    onRetakePhoto: () => undefined,
    needsCameraPermission: false,
    onRequestCameraPermission: () => undefined,
    facing: 'back' as const,
    onToggleFacing: () => undefined,
    onOpenPhotoLibrary: () => undefined,
    cameraRef: { current: null },
    shouldRenderCameraPreview: false,
    flashAnim: zeroValue,
    permissionGranted: true,
    onShutterPressIn: () => undefined,
    onShutterPressOut: () => undefined,
    onTakePicture: () => undefined,
    onSaveNote: () => undefined,
    saving: false,
    shutterScale: animatedValue,
    cameraStatusText: null,
    libraryImportLocked: false,
    importingPhoto: false,
    shareTarget: 'private' as const,
    onChangeShareTarget: () => undefined,
    footerContent: <View />,
    ...props,
  };
}

function renderCaptureCard(
  ref: React.RefObject<CaptureCardHandle | null>,
  props: Partial<React.ComponentProps<typeof CaptureCard>> = {}
) {
  return render(<CaptureCard {...createCaptureCardProps(ref, props)} />);
}

describe('CaptureCard doodle handle', () => {
  it('hides the leading accessory while camera permission is missing', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { queryByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      needsCameraPermission: true,
      permissionGranted: false,
      leadingAccessory: <View testID="leading-accessory" />,
    });

    expect(queryByTestId('leading-accessory')).toBeNull();
  });

  it('tracks local doodle state through the imperative handle', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId } = renderCaptureCard(ref);

    expect(ref.current?.getDoodleSnapshot()).toEqual({ enabled: false, strokes: [] });

    fireEvent.press(getByTestId('capture-doodle-toggle'));
    expect(getByTestId('mock-doodle-editable')).toHaveTextContent('true');

    fireEvent.press(getByTestId('mock-doodle-commit'));
    expect(ref.current?.getDoodleSnapshot()).toEqual({
      enabled: true,
      strokes: [
        { color: '#1C1C1E', points: [0.1, 0.1, 0.2, 0.2] },
        { color: '#1C1C1E', points: [0.3, 0.3, 0.4, 0.4] },
      ],
    });

    fireEvent.press(getByTestId('capture-doodle-undo'));
    expect(ref.current?.getDoodleSnapshot()).toEqual({
      enabled: true,
      strokes: [{ color: '#1C1C1E', points: [0.1, 0.1, 0.2, 0.2] }],
    });

    fireEvent.press(getByTestId('capture-doodle-clear'));
    expect(ref.current?.getDoodleSnapshot()).toEqual({ enabled: true, strokes: [] });

    act(() => {
      ref.current?.resetDoodle();
    });

    expect(ref.current?.getDoodleSnapshot()).toEqual({ enabled: false, strokes: [] });
    expect(getByTestId('mock-doodle-editable')).toHaveTextContent('false');
  });

  it('keeps the raw draft value so typing spaces is not rewritten away', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const handleChangeNoteText = jest.fn();
    const { getByTestId } = renderCaptureCard(ref, {
      noteText: 'coffee ',
      onChangeNoteText: handleChangeNoteText,
    });

    const input = getByTestId('capture-note-input');

    expect(input.props.value).toBe('coffee ');

    fireEvent.changeText(input, 'coffee break ');
    expect(handleChangeNoteText).toHaveBeenCalledWith('coffee break ');
  });

  it('commits the matching emoji into the text after a completed phrase', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const handleChangeNoteText = jest.fn();
    const { getByTestId } = renderCaptureCard(ref, {
      noteText: 'Ca phe',
      onChangeNoteText: handleChangeNoteText,
    });

    fireEvent.changeText(getByTestId('capture-note-input'), 'Ca phe ');
    expect(handleChangeNoteText).toHaveBeenCalledWith('Ca phe ☕️ ');
  });

  it('rotates the text placeholder when the draft becomes empty again', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const view = renderCaptureCard(ref, {
      noteText: '',
    });

    const firstPlaceholder = view.getByTestId('capture-note-input').props.placeholder;

    view.rerender(<CaptureCard {...createCaptureCardProps(ref, { noteText: 'Draft memory' })} />);
    view.rerender(<CaptureCard {...createCaptureCardProps(ref, { noteText: '' })} />);

    expect(view.getByTestId('capture-note-input').props.placeholder).not.toBe(firstPlaceholder);
  });

  it('keeps doodle editing available on captured photos', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const { getByTestId } = renderCaptureCard(ref, {
      captureMode: 'camera',
      capturedPhoto: 'file:///photo.jpg',
    });

    fireEvent.press(getByTestId('capture-doodle-toggle'));
    expect(getByTestId('mock-doodle-editable')).toHaveTextContent('true');

    fireEvent.press(getByTestId('mock-doodle-commit'));
    expect(ref.current?.getDoodleSnapshot().strokes).toHaveLength(2);
  });

  it('keeps text and photo doodle drafts separate', () => {
    const ref = React.createRef<CaptureCardHandle>();
    const view = renderCaptureCard(ref);

    fireEvent.press(view.getByTestId('capture-doodle-toggle'));
    fireEvent.press(view.getByTestId('mock-doodle-commit'));
    expect(ref.current?.getDoodleSnapshot().strokes).toHaveLength(2);

    view.rerender(
      <CaptureCard
        ref={ref}
        snapHeight={700}
        topInset={0}
        isSearching={false}
        captureMode="camera"
        cameraSessionKey={1}
        captureScale={new Animated.Value(1)}
        captureTranslateY={new Animated.Value(0)}
        colors={{
          primary: '#FFC107',
          captureButtonBg: '#1C1C1E',
          card: '#FFFFFF',
          border: '#E5E5EA',
          text: '#1C1C1E',
          secondaryText: '#8E8E93',
          captureCardText: '#1C1C1E',
          captureCardPlaceholder: 'rgba(28,28,30,0.48)',
          captureCardBorder: 'rgba(255,255,255,0.22)',
          captureGlassFill: 'rgba(255,252,246,0.62)',
          captureGlassBorder: 'rgba(255,255,255,0.3)',
          captureGlassText: '#2B2621',
          captureGlassIcon: 'rgba(43,38,33,0.52)',
          captureGlassPlaceholder: 'rgba(43,38,33,0.34)',
          captureGlassColorScheme: 'light',
          captureCameraOverlay: 'rgba(28,28,30,0.48)',
          captureCameraOverlayBorder: 'rgba(255,255,255,0.16)',
          captureCameraOverlayText: '#FFFDFC',
          captureFlashOverlay: 'rgba(255,250,242,0.96)',
        }}
        t={((_: string, fallback?: string) => fallback ?? '') as any}
        noteText="Draft memory"
        onChangeNoteText={() => undefined}
        restaurantName="Cafe"
        onChangeRestaurantName={() => undefined}
        capturedPhoto="file:///photo.jpg"
        onRetakePhoto={() => undefined}
        needsCameraPermission={false}
        onRequestCameraPermission={() => undefined}
        facing="back"
        onToggleFacing={() => undefined}
        onOpenPhotoLibrary={() => undefined}
        cameraRef={{ current: null }}
        shouldRenderCameraPreview={false}
        flashAnim={new Animated.Value(0)}
        permissionGranted
        onShutterPressIn={() => undefined}
        onShutterPressOut={() => undefined}
        onTakePicture={() => undefined}
        onSaveNote={() => undefined}
        saving={false}
        shutterScale={new Animated.Value(1)}
        cameraStatusText={null}
        libraryImportLocked={false}
        importingPhoto={false}
        shareTarget="private"
        onChangeShareTarget={() => undefined}
        footerContent={<View />}
      />
    );

    expect(ref.current?.getDoodleSnapshot()).toEqual({ enabled: false, strokes: [] });
  });
});
