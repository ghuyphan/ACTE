import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { resolveCaptureKeyboardLift, useCaptureCardTextInputState } from '../components/home/useCaptureCardTextInputState';

describe('resolveCaptureKeyboardLift', () => {
  it('returns zero when the focused input already clears the keyboard', () => {
    expect(
      resolveCaptureKeyboardLift({
        extraGap: 14,
        inputHeight: 40,
        inputY: 320,
        keyboardScreenY: 390,
        minimumVisibleInputY: 120,
      })
    ).toBe(0);
  });

  it('returns just enough lift to clear the keyboard when there is available headroom', () => {
    expect(
      resolveCaptureKeyboardLift({
        extraGap: 14,
        inputHeight: 40,
        inputY: 420,
        keyboardScreenY: 450,
        minimumVisibleInputY: 120,
      })
    ).toBe(24);
  });

  it('caps the lift before the focused input would jump into the top safe area', () => {
    expect(
      resolveCaptureKeyboardLift({
        extraGap: 18,
        inputHeight: 44,
        inputY: 150,
        keyboardScreenY: 130,
        minimumVisibleInputY: 120,
      })
    ).toBe(30);
  });

  it('returns zero for invalid keyboard frames', () => {
    expect(
      resolveCaptureKeyboardLift({
        extraGap: 18,
        inputHeight: 44,
        inputY: 200,
        keyboardScreenY: Number.POSITIVE_INFINITY,
        minimumVisibleInputY: 120,
      })
    ).toBe(0);
  });
});

describe('useCaptureCardTextInputState', () => {
  it('keeps text-entry focus active while switching between capture inputs', async () => {
    const noteInputRef = {
      current: {
        measureInWindow: jest.fn(),
      },
    } as any;
    const restaurantInputRef = {
      current: {
        measureInWindow: jest.fn(),
      },
    } as any;
    const { result } = renderHook(() =>
      useCaptureCardTextInputState({
        captureMode: 'text',
        minimumVisibleInputY: 120,
        noteText: '',
        noteInputRef,
        onChangeNoteText: jest.fn(),
        placeholderVariants: ['Note about this place...'],
        reduceMotionEnabled: false,
        restaurantInputRef,
      })
    );

    expect(result.current.isTextEntryFocused).toBe(false);

    act(() => {
      result.current.handleNoteInputFocus();
    });

    expect(result.current.isTextEntryFocused).toBe(true);

    act(() => {
      result.current.handleNoteInputBlur();
      result.current.handleRestaurantInputFocus();
    });

    expect(result.current.isTextEntryFocused).toBe(true);

    act(() => {
      result.current.handleRestaurantInputBlur();
    });

    await waitFor(() => {
      expect(result.current.isTextEntryFocused).toBe(false);
    });
  });

  it('ends the text-entry session when Android hides the keyboard without a blur event', () => {
    const keyboardListeners = new Map<string, (event: any) => void>();
    const addListenerSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation((eventName, listener) => {
      keyboardListeners.set(eventName, listener);
      return {
        remove: jest.fn(() => {
          keyboardListeners.delete(eventName);
        }),
      } as any;
    });
    const noteBlur = jest.fn();
    const restaurantBlur = jest.fn();
    const noteInputRef = {
      current: {
        blur: noteBlur,
        measureInWindow: jest.fn(),
      },
    } as any;
    const restaurantInputRef = {
      current: {
        blur: restaurantBlur,
        measureInWindow: jest.fn(),
      },
    } as any;

    const { result, unmount } = renderHook(() =>
      useCaptureCardTextInputState({
        captureMode: 'text',
        minimumVisibleInputY: 120,
        noteText: '',
        noteInputRef,
        onChangeNoteText: jest.fn(),
        placeholderVariants: ['Note about this place...'],
        reduceMotionEnabled: false,
        restaurantInputRef,
      })
    );

    act(() => {
      result.current.handleNoteInputFocus();
    });

    expect(result.current.isTextEntryFocused).toBe(true);

    act(() => {
      keyboardListeners.get('keyboardDidHide')?.(undefined);
    });

    expect(noteBlur).toHaveBeenCalled();
    expect(restaurantBlur).toHaveBeenCalled();
    expect(result.current.isTextEntryFocused).toBe(false);

    unmount();
    addListenerSpy.mockRestore();
  });
});
