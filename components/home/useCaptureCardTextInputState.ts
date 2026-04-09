import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, type TextInput } from 'react-native';
import { applyCommittedInlineEmoji, resolveCommittedInlineEmoji } from '../../services/noteDecorations';

interface UseCaptureCardTextInputStateOptions {
  captureMode: 'text' | 'camera';
  noteText: string;
  noteInputRef: RefObject<TextInput | null>;
  onChangeNoteText: (nextText: string) => void;
  placeholderVariants: string[];
}

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
  noteText,
  noteInputRef,
  onChangeNoteText,
  placeholderVariants,
}: UseCaptureCardTextInputStateOptions) {
  const [textPlaceholderIndex, setTextPlaceholderIndex] = useState(0);
  const [isNoteInputFocused, setIsNoteInputFocused] = useState(false);
  const [recentAutoEmoji, setRecentAutoEmoji] = useState<{ emoji: string; token: number } | null>(null);
  const focusedInputRef = useRef(false);
  const pendingBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentAutoEmojiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentAutoEmojiTokenRef = useRef(0);
  const isTextEntryFocused = isNoteInputFocused;
  const activeTextPlaceholder =
    placeholderVariants[textPlaceholderIndex % placeholderVariants.length] ?? placeholderVariants[0] ?? '';
  const clearRecentAutoEmoji = useCallback(() => {
    if (recentAutoEmojiTimeoutRef.current == null) {
      return;
    }

    clearTimeout(recentAutoEmojiTimeoutRef.current);
    recentAutoEmojiTimeoutRef.current = null;
  }, []);
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
      focusedInputRef.current = false;
      setIsNoteInputFocused(false);
    }
  }, [cancelPendingBlurResolution]);

  const endTextEntrySession = useCallback(() => {
    cancelPendingBlurResolution();
    focusedInputRef.current = false;
    setIsNoteInputFocused(false);
  }, [cancelPendingBlurResolution]);
  const scheduleBlurResolution = useCallback(() => {
    cancelPendingBlurResolution();
    pendingBlurTimeoutRef.current = setTimeout(() => {
      pendingBlurTimeoutRef.current = null;
      focusedInputRef.current = false;
      setIsNoteInputFocused(false);
    }, 0);
  }, [cancelPendingBlurResolution]);
  const blurCaptureInputs = useCallback(() => {
    noteInputRef.current?.blur();
  }, [noteInputRef]);

  useEffect(() => {
    if (captureMode !== 'text') {
      resetKeyboardLift(true);
    }
  }, [captureMode, resetKeyboardLift]);

  useEffect(() => {
    const keyboardDidHideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      if (!focusedInputRef.current) {
        return;
      }

      blurCaptureInputs();
      endTextEntrySession();
    });

    return () => {
      keyboardDidHideSubscription.remove();
    };
  }, [blurCaptureInputs, endTextEntrySession]);

  useEffect(
    () => () => {
      cancelPendingBlurResolution();
      clearRecentAutoEmoji();
    },
    [cancelPendingBlurResolution, clearRecentAutoEmoji]
  );

  useEffect(() => {
    if (captureMode === 'text') {
      return;
    }

    clearRecentAutoEmoji();
    setRecentAutoEmoji(null);
  }, [captureMode, clearRecentAutoEmoji]);

  const dismissCaptureInputs = useCallback(() => {
    blurCaptureInputs();
    endTextEntrySession();
    Keyboard.dismiss();
  }, [blurCaptureInputs, endTextEntrySession]);

  const handleChangeNoteText = useCallback(
    (nextText: string) => {
      const committedEmoji = resolveCommittedInlineEmoji(noteText, nextText);
      const resolvedText = committedEmoji?.text ?? applyCommittedInlineEmoji(noteText, nextText);
      onChangeNoteText(resolvedText);

      if (!committedEmoji) {
        return;
      }

      clearRecentAutoEmoji();
      recentAutoEmojiTokenRef.current += 1;
      const nextToken = recentAutoEmojiTokenRef.current;
      setRecentAutoEmoji({ emoji: committedEmoji.emoji, token: nextToken });
      recentAutoEmojiTimeoutRef.current = setTimeout(() => {
        setRecentAutoEmoji((current) => (current?.token === nextToken ? null : current));
        recentAutoEmojiTimeoutRef.current = null;
      }, 1300);
    },
    [clearRecentAutoEmoji, noteText, onChangeNoteText]
  );

  const handleNoteInputFocus = useCallback(() => {
    cancelPendingBlurResolution();
    focusedInputRef.current = true;
    setIsNoteInputFocused(true);
  }, [cancelPendingBlurResolution]);

  const handleNoteInputBlur = useCallback(() => {
    scheduleBlurResolution();
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
      isNoteInputFocused,
      recentAutoEmoji,
      isTextEntryFocused,
      rotatePlaceholderIfNeeded,
    }),
    [
      activeTextPlaceholder,
      dismissCaptureInputs,
      handleChangeNoteText,
      handleNoteInputBlur,
      handleNoteInputFocus,
      isNoteInputFocused,
      recentAutoEmoji,
      isTextEntryFocused,
      rotatePlaceholderIfNeeded,
    ]
  );
}
