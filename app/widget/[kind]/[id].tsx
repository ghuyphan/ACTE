import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useFeedFocus } from '../../../hooks/useFeedFocus';

export default function WidgetFocusRoute() {
  const { kind, id } = useLocalSearchParams<{ kind?: string; id?: string }>();
  const router = useRouter();
  const { requestFeedFocus } = useFeedFocus();

  useEffect(() => {
    if (!id || typeof id !== 'string') {
      router.replace('/(tabs)' as Href);
      return;
    }

    if (kind === 'note') {
      requestFeedFocus({ kind: 'note', id });
      router.replace('/(tabs)' as Href);
      return;
    }

    if (kind === 'shared-post') {
      requestFeedFocus({ kind: 'shared-post', id });
      router.replace('/(tabs)' as Href);
      return;
    }

    router.replace('/(tabs)' as Href);
  }, [id, kind, requestFeedFocus, router]);

  return null;
}
