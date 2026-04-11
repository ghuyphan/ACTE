import type { ReactNode } from 'react';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../constants/i18n';
import { ActiveFeedTargetProvider } from '../../hooks/useActiveFeedTarget';
import { ActiveNoteProvider } from '../../hooks/useActiveNote';
import { AuthProvider } from '../../hooks/useAuth';
import { ConnectivityProvider } from '../../hooks/useConnectivity';
import { FeedFocusProvider } from '../../hooks/useFeedFocus';
import { HapticsProvider } from '../../hooks/useHaptics';
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

function CoreProviders({ children }: AppProvidersProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <HapticsProvider>
          <ConnectivityProvider>
            <AuthProvider>
              <SubscriptionProvider>{children}</SubscriptionProvider>
            </AuthProvider>
          </ConnectivityProvider>
        </HapticsProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}

function FeatureProviders({ children }: AppProvidersProps) {
  return (
    <ActiveNoteProvider>
      <ActiveFeedTargetProvider>
        <FeedFocusProvider>
          <NotesProvider>
            <SyncStatusProvider>
              <SharedFeedProvider>
                <NoteDetailSheetProvider>{children}</NoteDetailSheetProvider>
              </SharedFeedProvider>
            </SyncStatusProvider>
          </NotesProvider>
        </FeedFocusProvider>
      </ActiveFeedTargetProvider>
    </ActiveNoteProvider>
  );
}

function UiProviders({ children }: AppProvidersProps) {
  return (
    <BottomSheetModalProvider>
      <SavedNoteRevealUiProvider>
        <AppAlertProvider />
        {children}
      </SavedNoteRevealUiProvider>
    </BottomSheetModalProvider>
  );
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <CoreProviders>
      <FeatureProviders>
        <UiProviders>{children}</UiProviders>
      </FeatureProviders>
    </CoreProviders>
  );
}
