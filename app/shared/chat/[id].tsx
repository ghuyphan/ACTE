import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import SharedPostChatScreen from '../../../components/screens/shared/SharedPostChatScreen';
import { useAuth } from '../../../hooks/useAuth';

export default function SharedPostChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthAvailable, isReady: authReady, user } = useAuth();

  useEffect(() => {
    if (!id || !authReady || user || !isAuthAvailable) {
      return;
    }

    router.replace({
      pathname: '/auth',
      params: {
        returnTo: `/shared/chat/${id}`,
      },
    });
  }, [authReady, id, isAuthAvailable, router, user]);

  if (!id || (!authReady && isAuthAvailable) || (!user && isAuthAvailable)) {
    return null;
  }

  return <SharedPostChatScreen postId={id} />;
}
