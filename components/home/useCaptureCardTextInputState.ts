import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, type TextInput, type ViewStyle } from 'react-native';
import { applyCommittedInlineEmoji } from '../../services/noteDecorations';

interface UseCaptureCardTextInputStateOptions {
  captureMode: 'text' | 'camera';
  minimumVisibleInputY: number;
  noteText: string;
  noteInputRef: RefObject<TextInput | null>;
  onChangeNoteText: (nextText: string) => void;
  placeholderVariants: string[];
  reduceMotionEnabled: boolean;
  restaurantInputRef: RefObject<TextInput | null>;
}

type CaptureInputTarget = 'note' | 'restaurant';

type CaptureKeyboardLiftOptions = {
  extraGap: number;
  inputHeight: number;
  inputY: number;
  keyboardScreenY: number;
  minimumVisibleInputY: number;
};

export function resolveCaptureKeyboardLift({
  extraGap,
  inputHeight,
  inputY,
  keyboardScreenY,
  minimumVisibleInputY,
}: CaptureKeyboardLiftOptions) {
  if (
    !Number.isFinite(inputHeight) ||
    !Number.isFinite(inputY) ||
    !Number.isFinite(keyboardScreenY) ||
    inputHeight <= 0 ||
    keyboardScreenY <= 0
  ) {
    return 0;
  }

  const overlap = inputY + inputHeight + extraGap - keyboardScreenY;

  if (overlap <= 0) {
    return 0;
  }

  const maxLiftBeforeHittingTopGuard = Math.max(inputY - minimumVisibleInputY, 0);
  return Math.min(overlap, maxLiftBeforeHittingTopGuard);
}
export function useCaptureCardTextInputState({
  captureMode,
  minimumVisibleInputY,
  noteText,
  noteInputRef,
  onChangeNoteText,
  placeholderVariants,
  reduceMotionEnabled,
  restaurantInputRef,
}: UseCaptureCardTextInputStateOptions) {
  void minimumVisibleInputY;
  void reduceMotionEnabled;
  const [textPlaceholderIndex, setTextPlaceholderIndex] = useState(0);
  const [isNoteInputFocused, setIsNoteInputFocused] = useState(false);
  const [isRestaurantInputFocused, setIsRestaurantInputFocused] = useState(false);
  const focusedInputRef = useRef<CaptureInputTarget | null>(null);
  const pendingBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTextEntryFocused = captureMode === 'text' && (isNoteInputFocused || isRestaurantInputFocused);
  const activeTextPlaceholder =
    placeholderVariants[textPlaceholderIndex % placeholderVariants.length] ?? placeholderVariants[0] ?? '';
  const cancelPendingBlurResolution = useCallback(() => {
    if (pendingBlurTimeoutRef.current == null) {
      return;
    }

    clearTimeout(pendingBlurTimeoutRef.current);
    pendingBlurTimeoutRef.current = null;
  }, []);
  const resetKeyboardLift = useCallback((clearFocus = false) => {
    cancelPendingBlurResolution();
    if (clearFocus) {
      focusedInputRef.current = null;
      setIsNoteInputFocused(false);
      setIsRestaurantInputFocused(false);
    }
  }, [cancelPendingBlurResolution]);

  const endTextEntrySession = useCallback((target?: CaptureInputTarget) => {
    cancelPendingBlurResolution();
    if (!target || focusedInputRef.current === target) {
      focusedInputRef.current = null;
    }
    if (!target || target === 'note') {
      setIsNoteInputFocused(false);
    }
    if (!target || target === 'restaurant') {
      setIsRestaurantInputFocused(false);
    }
  }, [cancelPendingBlurResolution]);
  const scheduleBlurResolution = useCallback((target: CaptureInputTarget) => {
    cancelPendingBlurResolution();
    pendingBlurTimeoutRef.current = setTimeout(() => {
      pendingBlurTimeoutRef.current = null;

      if (focusedInputRef.current === target) {
        focusedInputRef.current = null;
      }

      if (target === 'note') {
        setIsNoteInputFocused(false);
      } else {
        setIsRestaurantInputFocused(false);
      }
    }, 0);
  }, [cancelPendingBlurResolution]);
  const blurCaptureInputs = useCallback(() => {
    noteInputRef.current?.blur();
    restaurantInputRef.current?.blur();
  }, [noteInputRef, restaurantInputRef]);

  useEffect(() => {
    if (captureMode !== 'text') {
      resetKeyboardLift(true);
    }
  }, [captureMode, resetKeyboardLift]);

  useEffect(() => {
    const keyboardDidHideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      if (captureMode !== 'text' || focusedInputRef.current == null) {
        return;
      }

      blurCaptureInputs();
      endTextEntrySession();
    });

    return () => {
      keyboardDidHideSubscription.remove();
    };
  }, [blurCaptureInputs, captureMode, endTextEntrySession]);

  useEffect(
    () => () => {
      cancelPendingBlurResolution();
    },
    [cancelPendingBlurResolution]
  );
  const keyboardLiftAnimatedStyle = useMemo<ViewStyle>(() => ({}), []);

  const dismissCaptureInputs = useCallback(() => {
    blurCaptureInputs();
    endTextEntrySession();
    Keyboard.dismiss();
  }, [blurCaptureInputs, endTextEntrySession]);

  const handleChangeNoteText = useCallback(
    (nextText: string) => {
      onChangeNoteText(applyCommittedInlineEmoji(noteText, nextText));
    },
    [noteText, onChangeNoteText]
  );

  const handleNoteInputFocus = useCallback(() => {
    cancelPendingBlurResolution();
    focusedInputRef.current = 'note';
    setIsNoteInputFocused(true);
    setIsRestaurantInputFocused(false);
  }, [cancelPendingBlurResolution]);

  const handleNoteInputBlur = useCallback(() => {
    scheduleBlurResolution('note');
  }, [scheduleBlurResolution]);

  const handleRestaurantInputFocus = useCallback(() => {
    cancelPendingBlurResolution();
    focusedInputRef.current = 'restaurant';
    setIsRestaurantInputFocused(true);
    setIsNoteInputFocused(false);
  }, [cancelPendingBlurResolution]);

  const handleRestaurantInputBlur = useCallback(() => {
    scheduleBlurResolution('restaurant');
  }, [scheduleBlurResolution]);

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
