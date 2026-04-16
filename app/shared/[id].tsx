import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import SharedPostDetailSheet from '../../components/shared/SharedPostDetailSheet';
import { useAuth } from '../../hooks/useAuth';

export default function SharedPostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthAvailable, isReady: authReady, user } = useAuth();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!id || !authReady || user || !isAuthAvailable) {
      return;
    }

    router.replace({
      pathname: '/auth',
      params: {
        returnTo: `/shared/${id}`,
      },
    });
  }, [authReady, id, isAuthAvailable, router, user]);

  if (!id || (!authReady && isAuthAvailable) || (!user && isAuthAvailable)) {
    return null;
  }

  return (
    <SharedPostDetailSheet
      key={id}
      postId={id}
      visible={visible}
      onClose={() => {
        setVisible(false);
      }}
      onClosed={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }

        router.replace('/shared');
      }}
    />
  );
}
