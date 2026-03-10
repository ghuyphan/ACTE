import { DeviceEventEmitter } from 'react-native';

export type InteractionFeedbackType = 'favorited' | 'unfavorited' | 'deleted';

interface InteractionFeedbackEvent {
  type: InteractionFeedbackType;
}

const INTERACTION_FEEDBACK_EVENT = 'INTERACTION_FEEDBACK_EVENT';

export function emitInteractionFeedback(type: InteractionFeedbackType) {
  DeviceEventEmitter.emit(INTERACTION_FEEDBACK_EVENT, { type } satisfies InteractionFeedbackEvent);
}

export function addInteractionFeedbackListener(listener: (event: InteractionFeedbackEvent) => void) {
  return DeviceEventEmitter.addListener(INTERACTION_FEEDBACK_EVENT, listener);
}
