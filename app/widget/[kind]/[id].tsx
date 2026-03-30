import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useActiveFeedTarget } from '../../../hooks/useActiveFeedTarget';
import { useActiveNote } from '../../../hooks/useActiveNote';
import { useFeedFocus } from '../../../hooks/useFeedFocus';

export default function WidgetFocusRoute() {
  const { kind, id } = useLocalSearchParams<{ kind?: string; id?: string }>();
  const router = useRouter();
  const { peekActiveFeedTarget } = useActiveFeedTarget();
  const { peekActiveNoteId } = useActiveNote();
  const { requestFeedFocus } = useFeedFocus();

  useEffect(() => {
    if (!id || typeof id !== 'string') {
      router.replace('/' as Href);
      return;
    }

    if (kind === 'note') {
      if (peekActiveNoteId() === id && router.canGoBack()) {
        router.back();
        return;
      }

      const activeFeedTarget = peekActiveFeedTarget();
      if (activeFeedTarget?.kind === 'note' && activeFeedTarget.id === id) {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/' as Href);
        }
        return;
      }

      requestFeedFocus({ kind: 'note', id });
      router.replace('/' as Href);
      return;
    }

    if (kind === 'shared-post') {
      requestFeedFocus({ kind: 'shared-post', id });
      router.replace('/' as Href);
      return;
    }

    router.replace('/' as Href);
  }, [id, kind, peekActiveFeedTarget, peekActiveNoteId, requestFeedFocus, router]);

  return null;
}
