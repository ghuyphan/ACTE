import type { ComponentType, ReactNode } from 'react';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../constants/i18n';
import {
  ActiveFeedTargetProvider,
  ActiveNoteProvider,
  AuthProvider,
  ConnectivityProvider,
  FeedFocusProvider,
  HapticsProvider,
  NoteDetailSheetProvider,
  NotesProvider,
  SharedFeedProvider,
  SubscriptionProvider,
  SyncStatusProvider,
  ThemeProvider,
} from '../../hooks';
import { StartupInteractionProvider } from '../../hooks/app/useHomeStartupReady';
import { SavedNoteRevealUiProvider } from '../../hooks/ui/useSavedNoteRevealUi';
import { AppAlertProvider } from '../ui/AppAlertProvider';

type AppProvidersProps = {
  children: ReactNode;
};

type ProviderComponent = ComponentType<AppProvidersProps>;

const providerChain: ProviderComponent[] = [
  ({ children }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>,
  ThemeProvider,
  HapticsProvider,
  ConnectivityProvider,
  AuthProvider,
  SubscriptionProvider,
  ActiveNoteProvider,
  ActiveFeedTargetProvider,
  FeedFocusProvider,
  StartupInteractionProvider,
  NotesProvider,
  SyncStatusProvider,
  SharedFeedProvider,
  SavedNoteRevealUiProvider,
  // Android bottom-sheet modals portal through this provider. Keep any context
  // sheet content reads above it, and any provider that renders sheet content below it.
  BottomSheetModalProvider,
  AppAlertProvider,
  NoteDetailSheetProvider,
];

export default function AppProviders({ children }: AppProvidersProps) {
  return providerChain.reduceRight<ReactNode>(
    (wrappedChildren, Provider) => <Provider>{wrappedChildren}</Provider>,
    children
  );
}
