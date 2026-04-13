import type { ComponentType, ReactNode } from 'react';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../constants/i18n';
import { ActiveFeedTargetProvider } from '../../hooks/useActiveFeedTarget';
import { ActiveNoteProvider } from '../../hooks/useActiveNote';
import { AuthProvider } from '../../hooks/useAuth';
import { ConnectivityProvider } from '../../hooks/useConnectivity';
import { FeedFocusProvider } from '../../hooks/useFeedFocus';
import { HapticsProvider } from '../../hooks/useHaptics';
import { HomeStartupReadyProvider } from '../../hooks/app/useHomeStartupReady';
import { NotesProvider } from '../../hooks/useNotes';
import { NoteDetailSheetProvider } from '../../hooks/useNoteDetailSheet';
import { SharedFeedProvider } from '../../hooks/useSharedFeed';
import { SyncStatusProvider } from '../../hooks/useSyncStatus';
import { SubscriptionProvider } from '../../hooks/useSubscription';
import { ThemeProvider } from '../../hooks/useTheme';
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
  HomeStartupReadyProvider,
  NotesProvider,
  SyncStatusProvider,
  SharedFeedProvider,
  NoteDetailSheetProvider,
  BottomSheetModalProvider,
  SavedNoteRevealUiProvider,
];

export default function AppProviders({ children }: AppProvidersProps) {
  const content = providerChain.reduceRight<ReactNode>(
    (wrappedChildren, Provider) => <Provider>{wrappedChildren}</Provider>,
    children
  );

  return (
    <>
      <AppAlertProvider />
      {content}
    </>
  );
}
