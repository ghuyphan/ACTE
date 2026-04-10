import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import SharedPostDetailSheet from '../../components/shared/SharedPostDetailSheet';
import { useAuth } from '../../hooks/useAuth';

export default function SharedPostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthAvailable, user } = useAuth();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!id || user || !isAuthAvailable) {
      return;
    }

    router.replace({
      pathname: '/auth',
      params: {
        returnTo: `/shared/${id}`,
      },
    });
  }, [id, isAuthAvailable, router, user]);

  if (!id || (!user && isAuthAvailable)) {
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
