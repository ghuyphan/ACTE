import { useCallback, useEffect, useMemo, useState } from 'react';
import { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';
import { applyCommittedInlineEmoji } from '../../services/noteDecorations';

interface UseCaptureCardTextInputStateOptions {
  captureMode: 'text' | 'camera';
  noteText: string;
  onChangeNoteText: (nextText: string) => void;
  placeholderVariants: string[];
  reduceMotionEnabled: boolean;
}

export function useCaptureCardTextInputState({
  captureMode,
  noteText,
  onChangeNoteText,
  placeholderVariants,
  reduceMotionEnabled,
}: UseCaptureCardTextInputStateOptions) {
  const [textPlaceholderIndex, setTextPlaceholderIndex] = useState(0);
  const [isNoteInputFocused, setIsNoteInputFocused] = useState(false);
  const [isRestaurantInputFocused, setIsRestaurantInputFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const keyboardLift = useSharedValue(0);
  const isTextEntryFocused = captureMode === 'text' && (isNoteInputFocused || isRestaurantInputFocused);
  const activeTextPlaceholder =
    placeholderVariants[textPlaceholderIndex % placeholderVariants.length] ?? placeholderVariants[0] ?? '';
  const resetKeyboardLift = useCallback((clearFocus = false) => {
    setKeyboardHeight(0);
    setIsKeyboardVisible(false);
    if (clearFocus) {
      setIsNoteInputFocused(false);
      setIsRestaurantInputFocused(false);
    }
    keyboardLift.value = withTiming(0, {
      duration: reduceMotionEnabled ? 110 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [keyboardLift, reduceMotionEnabled]);

  useEffect(() => {
    if (captureMode !== 'text') {
      resetKeyboardLift(true);
    }
  }, [captureMode, resetKeyboardLift]);

  useEffect(() => {
    const handleKeyboardShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
      setIsKeyboardVisible(event.endCoordinates.height > 0);
    };
    const handleKeyboardFrame = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
      setIsKeyboardVisible(event.endCoordinates.height > 0);
    };
    const handleKeyboardHide = () => {
      resetKeyboardLift(true);
    };
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const frameEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const frameSubscription = Keyboard.addListener(frameEvent, handleKeyboardFrame);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSubscription.remove();
      frameSubscription.remove();
      hideSubscription.remove();
    };
  }, [resetKeyboardLift]);

  useEffect(() => {
    const nextLift = isTextEntryFocused && isKeyboardVisible
      ? Math.min(Math.max(keyboardHeight - 150, 0), 170)
      : 0;

    keyboardLift.value = withTiming(nextLift, {
      duration: reduceMotionEnabled ? 110 : 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [isKeyboardVisible, isTextEntryFocused, keyboardHeight, keyboardLift, reduceMotionEnabled]);

  const keyboardLiftAnimatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: -keyboardLift.value }],
    }),
    [keyboardLift]
  );

  const dismissCaptureInputs = useCallback(() => {
    Keyboard.dismiss();
    resetKeyboardLift();
  }, [resetKeyboardLift]);

  const handleChangeNoteText = useCallback(
    (nextText: string) => {
      onChangeNoteText(applyCommittedInlineEmoji(noteText, nextText));
    },
    [noteText, onChangeNoteText]
  );

  const handleNoteInputFocus = useCallback(() => {
    setIsNoteInputFocused(true);
  }, []);

  const handleNoteInputBlur = useCallback(() => {
    setIsNoteInputFocused(false);
  }, []);

  const handleRestaurantInputFocus = useCallback(() => {
    setIsRestaurantInputFocused(true);
  }, []);

  const handleRestaurantInputBlur = useCallback(() => {
    setIsRestaurantInputFocused(false);
  }, []);

  const rotatePlaceholderIfNeeded = useCallback(
    (previousCaptureMode: 'text' | 'camera', wasTextDraftEmpty: boolean) => {
      const isTextDraftEmpty = noteText.length === 0;
      const enteredFreshEmptyTextDraft =
        captureMode === 'text' &&
        isTextDraftEmpty &&
        (!wasTextDraftEmpty || previousCaptureMode !== 'text');

      if (enteredFreshEmptyTextDraft) {
        setTextPlaceholderIndex((current) => current + 1);
      }

      return isTextDraftEmpty;
    },
    [captureMode, noteText.length]
  );

  return useMemo(
    () => ({
      activeTextPlaceholder,
      dismissCaptureInputs,
      handleChangeNoteText,
      handleNoteInputBlur,
      handleNoteInputFocus,
      handleRestaurantInputBlur,
      handleRestaurantInputFocus,
      isNoteInputFocused,
      isTextEntryFocused,
      keyboardLiftAnimatedStyle,
      rotatePlaceholderIfNeeded,
    }),
    [
      activeTextPlaceholder,
      dismissCaptureInputs,
      handleChangeNoteText,
      handleNoteInputBlur,
      handleNoteInputFocus,
      handleRestaurantInputBlur,
      handleRestaurantInputFocus,
      isNoteInputFocused,
      isTextEntryFocused,
      keyboardLiftAnimatedStyle,
      rotatePlaceholderIfNeeded,
    ]
  );
}
